const promcall = require('promised-callback')
const { log } = require('../utils/debug')(__filename)
const hyperdb = require('hyperdb')
const { _open_storage, errors, deriveKeyPair, checkVariables, toB58 } = require('../utils')
const descriptors = require('../descriptors')
const stream_templates = require('../templates/streams')
const { getInterface } = require('./interfaces/index')

const create = async (
  args = { template: null, storage: null, user_password: null, user_id: null },
  opts = {
    keys: { read: null, write: null },
    no_index: false,
    meta_stream: null,
  },
  callback,
) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    try {
      // Check that key & action exists
      const missing = checkVariables(args, [ 'template', 'storage', 'user_password', 'user_id' ])
      if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

      if (!opts) opts = {}

      const { template, storage, keys, no_index, user_password, user_id } = { ...args, ...opts }
      opts.valueEncoding = 'binary' // Binary encoding is enforced
      opts.storeSecretKey = false
      opts.sparse = true

      // Make sure we have the template
      if (!template) return error(new Error(errors.TEMPLATE_MISSING), { args })

      // Either use the provided keys or generate new ones
      if (keys && keys.read) {
        log('Stream keys provided')
        opts.key = Buffer.from(keys.read, 'hex')
        if (keys.write) {
          opts.secretKey = keys.write ? Buffer.from(keys.write, 'hex') : null // secret is not required
        }
      } else {
        const key_pair = await deriveKeyPair({ master_key: user_password }).catch(error)
        opts.key = key_pair.read
        opts.secretKey = key_pair.write
        log('Stream keys not provided, generating new ones...')
      }

      // Make sure keys are in hex
      if (Buffer.isBuffer(opts.key)) opts.key = opts.key.toString('hex')
      if (opts.write && Buffer.isBuffer(opts.write)) opts.key = opts.key.toString('hex')

      log('Creating new stream', opts.key, template['@type'])

      const store = _open_storage(opts.key, storage)

      const stream = hyperdb(store, opts.key, opts)

      stream.on('ready', async (err) => {
        if (err) return error(err)

        // Add user_id
        stream.user_id = user_id

        // Add user_password directly to the stream
        stream.user_password = user_password

        // Encryption is the same as the user_id
        stream.encryption_password = user_id

        if (!stream.encryption_password) return error(new Error('PASSWORD_MISSING'))

        // Create and add indexer if requested
        let created_index = null
        // if (!no_index) {
        //   log('Generating keys for indexer stream...')
        //   const indexer_keys = await deriveKeyPair({
        //     master_key: Buffer.from(opts.key + 'indexer'),
        //   }).catch(error)
        //   created_index = await create(
        //     { template: stream_templates.index, storage, user_password, user_id },
        //     { no_index: true, keys: indexer_keys },
        //   ).catch(error)
        //   if (!created_index) return error(new Error(errors.INDEX_CREATION_FAILED))
        // }

        // Generate the stream around the data stream
        const base = await getInterface('base')
        if (!base) return error(new Error(errors.BASE_INTERFACE_MISSING))
        const Stream = {
          base: base(stream),
        }

        // Add index
        if (created_index) {
          Stream.index = created_index
          template.IndexKey = await created_index.getKeys().key
        }

        // Add type templates
        template.DatagramStreamID = toB58(stream.discoveryKey.toString('hex'))
        template.ReleaseDate = new Date().toISOString()
        template.Manufacturer = 'Machian Collective'
        template.DatagramKey = toB58(stream.key.toString('hex'))
        template.EncryptionKey = toB58(stream.encryption_password)

        Stream.template = template

        // Apply interfaces
        if (Array.isArray(template.interfaces)) {
          const ifaces = []
          template.interfaces.forEach(async (requested_iface) => {
            if (requested_iface) {
              if (requested_iface !== 'base') {
                ifaces.push(
                  new Promise(async (iface_done, iferror) => {
                    const iface = await getInterface(requested_iface)
                    if (!iface) {
                      return iferror(new Error(errors.REQUESTED_INTERFACE_MISSING), { requested_iface })
                    }
                    await Stream.base.addInterface(iface, Stream).catch(iferror)
                    iface_done()
                  }),
                )
              }
            }
          })
          await Promise.all(ifaces).catch(error)
        } else {
          return error(new Error(errors.INTERFACES_MISSING))
        }

        // Store template at 0 position
        const stream_descriptor = await descriptors.create('DatagramStream', template).catch(error)
        await Stream.base.add(stream_descriptor, { arguments: { key: '_template' } }).catch(error)

        done(Stream)
      })
    } catch (e) {
      return error(e)
    }
  })
}

exports.create = create
