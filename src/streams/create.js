const promcall = require('promised-callback').default
const { log } = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const hyperdb = require('hyperdb')
const crypto = require('hypercore-crypto')
const { _open_storage, errors, deriveKeyPair, generatePassword, checkVariables } = require('../utils')
const descriptors = require('../descriptors')
const stream_templates = require('../templates/streams')
const { getInterface } = require('./interfaces/index')

const create = async (
  args = { template: null, storage: null, user_password: null },
  opts = {
    keys: { key: null, secret: null },
    no_index: false,
    meta_stream: null,
    owner_public_key: null,
  },
  callback,
) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    // Check that key & action exists
    const missing = checkVariables(args, [ 'template', 'storage', 'user_password' ])
    if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

    const { template, storage, keys, no_index, user_password, owner_public_key } = { ...args, ...opts }
    opts.valueEncoding = 'binary' // Binary encoding is enforced
    opts.storeSecretKey = false

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

    const stream = hyperdb(store, opts.key.toString('hex'), opts)

    stream.on('ready', async (err) => {
      if (err) return error(err)

      // Add user_password directly to the stream
      stream.user_password = user_password

      // If owner_public_key was provided, put that as owner_public_key, else generate from user_id
      stream.owner_public_key = owner_public_key

      // TODO: Support generating key from user_password (update CDR)
      if (!stream.owner_public_key) return error(new Error('OWNER_PUBLIC_KEY_MISSING'))

      // Generate encryption password and add it directly to the stream
      stream.password = await generatePassword({ len: 64 }).catch(error)
      if (!stream.password) return error(new Error('PASSWORD_MISSING'))

      // Create and add indexer if requested
      let created_index = null
      if (!no_index) {
        log('Generating keys for indexer stream...')
        const indexer_keys = await deriveKeyPair({
          master_key: Buffer.from(this._container_password + 'indexer'),
        }).catch(error)
        created_index = await create(
          { template: stream_templates.index, storage, user_password },
          { no_index: true, keys: indexer_keys, owner_public_key },
        ).catch(error)
        if (!created_index) return error(new Error(errors.INDEX_CREATION_FAILED))
      }

      // Generate the stream around the data stream
      const base = await getInterface('base')
      if (!base) return error(new Error(errors.BASE_INTERFACE_MISSING))
      const Stream = base(stream)

      // Add index
      if (created_index) {
        Stream.index = created_index
        template.IndexKey = await created_index.getKeys().key
      }

      // Add type templates
      template.DatagramStreamID = stream.discoveryKey.toString('hex')
      template.ReleaseDate = new Date().toISOString()
      template.Manufacturer = 'Machianists'
      template.DatagramKey = stream.key.toString('hex')
      template.EncryptionKey = stream.password

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
      await Stream.add(stream_descriptor, { arguments: { key: '_template' } }).catch(error)

      done(Stream)
    })
  })
}

exports.create = create
