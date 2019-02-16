const { log } = require('../utils/debug')(__filename)
const { errors, checkVariables } = require('../utils')
const hypercore = require('hypercore')
const _open_storage = require('../utils/storage')._open_storage
const { getInterface } = require('./interfaces')

exports.load = async (args = { keys: { key: null, secret: null }, storage: null, password: null, user_id: null }) => {
  return new Promise(async (done, error) => {
    // Check that key & action exists
    const missing = checkVariables(args, [ 'keys.key', 'storage', 'password' ])
    if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

    const { storage, keys, password, user_id } = { ...args }

    const hex_key = Buffer.isBuffer(keys.key) ? keys.key.toString('hex') : keys.key

    log('Trying to open stream with key', hex_key)

    // Open storage for the stream
    const store = _open_storage(hex_key, storage)

    // Open key
    const store_key = store('key')

    // Let's check whether the key exists
    store_key.read(0, 4, (err, bytes) => {
      // If there's an error, it's empty which means that it does not exist
      if (err) {
        log('No stream found with key', hex_key)
        return done()
      }

      // Everything seems to be cool so let's try to initialize it
      const stream = hypercore(store, {
        key: Buffer.isBuffer(keys.key) ? keys.key : Buffer.from(keys.key, 'hex'),
        secretKey: keys.secret ? (Buffer.isBuffer(keys.secret) ? keys.secret : Buffer.from(keys.secret, 'hex')) : null,
      })
      // Wait until everything is loaded and then deliver stream forward
      stream.ready(async (err) => {
        if (err) return error(err)

        // Add user_id
        stream.user_id = user_id

        // Add password
        stream.password = password

        // Generate the stream around the data stream
        const base = await getInterface('base')
        if (!base) return error(new Error(errors.BASE_INTERFACE_MISSING))
        const Stream = base(stream)

        // Get the template
        Stream.template = await Stream.getTemplate().catch(error)

        // Apply interfaces
        if (Array.isArray(Stream.template.interfaces)) {
          const ifaces = []
          Stream.template.interfaces.forEach(async (requested_iface) => {
            if (requested_iface) {
              ifaces.push(
                new Promise(async (iface_done, iferror) => {
                  const iface = await getInterface(requested_iface)
                  if (!iface) return iferror(new Error(errors.REQUESTED_INTERFACE_MISSING), { requested_iface })
                  await Stream.addInterface(iface).catch(iferror)
                  iface_done()
                })
              )
            } else error(new Error('REQUESTED_INTERFACE_MISSING'))
          })
          await Promise.all(ifaces).catch(error)
        }

        done(Stream)
      })
    })
  })
}
