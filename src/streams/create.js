const promcall = require('promised-callback').default
const { log } = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const crypto = require('hypercore-crypto')
const { _open_storage, errors, deriveKeyPair, generatePassword, checkVariables } = require('../utils')
const descriptors = require('../descriptors')
const stream_templates = require('../templates/streams')
const { getInterface } = require('./interfaces/index')

const create = async (
  args = { template: null, storage: null, user_id: null },
  opts = {
    keys: { key: null, secret: null },
    index: true,
    meta_stream: null,
  },
  callback,
) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    // Check that key & action exists
    const missing = checkVariables(args, [ 'template', 'storage', 'user_id' ])
    if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

    const { template, storage, keys, index, user_id } = { ...args, ...opts }
    opts.valueEncoding = 'binary' // Binary encoding is enforced

    // Make sure we have the template
    if (!template) return error(new Error(errors.TEMPLATE_MISSING), { args })

    // If this is meta stream, use generated keys
    if (template && template.id === 'meta') {
      if (typeof keys !== 'object') return error(new Error(errors.KEYS_MISSING))
      opts.key = Buffer.from(keys.key, 'hex')
      opts.secretKey = Buffer.from(keys.secret, 'hex')
    } else if (keys && keys.key) {
      opts.key = Buffer.from(keys.key, 'hex')
      opts.secretKey = keys.secret ? Buffer.from(keys.secret, 'hex') : null // secret is not required
    } else {
      const keyPair = crypto.keyPair()
      opts.key = keyPair.publicKey
      opts.secretKey = keyPair.secretKey
    }

    log('Creating new stream', opts.key.toString('hex'), template['@type'])

    const store = _open_storage(opts.key.toString('hex'), storage)

    const stream = hypercore(store, opts)

    stream.ready(async (err) => {
      if (err) return error(err)

      // Add user_id directly to the stream
      stream.user_id = user_id

      // Generate encryption password and add it directly to the stream
      stream.password = await generatePassword({ len: 64 }).catch(error)
      if (!stream.password) return error(new Error('PASSWORD_MISSING'))

      // Create and add indexer if requested
      let created_index = null
      if (index) {
        log('Generating keys for indexer stream...')
        const indexer_keys = await deriveKeyPair({
          master_key: Buffer.from(this._container_password + 'indexer'),
        }).catch(error)
        created_index = await create(
          { template: stream_templates.index, storage, user_id },
          { index: false, keys: indexer_keys },
        )
        if (!created_index) return error(new Error(errors.INDEX_CREATION_FAILED))
      }

      // Generate the stream around the data stream
      const base = await getInterface('base')
      if (!base) return error(new Error(errors.BASE_INTERFACE_MISSING))
      const Stream = base(stream)

      // Add index
      if (created_index) {
        Stream.index = created_index
      }

      // Add type templates
      template.DatagramStreamID = stream.discoveryKey.toString('hex')
      template.ReleaseDate = new Date().toISOString()
      template.Manufacturer = 'Machianists'
      template.DatagramKey = stream.key.toString('hex')
      template.EncryptionKey = stream.password

      if (index) template.IndexKey = created_index.toString('hex')
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
                  if (!iface) return iferror(new Error(errors.REQUESTED_INTERFACE_MISSING), { requested_iface })
                  await Stream.addInterface(iface).catch(iferror)
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
      await Stream.add(stream_descriptor).catch(error)

      done(Stream)
    })
  })
}

exports.create = create
