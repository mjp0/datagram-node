const { log } = require('../utils/debug')(__filename)
const { errors, checkVariables } = require('../utils')
const hypercore = require('hypercore')
const hyperdb = require('hyperdb')
const _open_storage = require('../utils/storage')._open_storage
const { getInterface } = require('./interfaces')

exports.load = async (
  args = { keys: { read: null, write: null }, storage: null, encryption_password: null, user_password: null },
  opts = { user_id: null },
) => {
  return new Promise(async (done, error) => {
    // Check that key & action exists
    const missing = checkVariables(args, [ 'keys.read', 'storage', 'encryption_password', 'user_password' ])
    if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

    const { storage, keys, encryption_password, user_password, user_id } = { ...args, ...opts }

    const hex_key = Buffer.isBuffer(keys.read) ? keys.read.toString('hex') : keys.read

    log('Trying to open stream with key')

    // Open storage for the stream
    const store = _open_storage(hex_key, storage)

    // Everything seems to be cool so let's try to initialize it
    const stream = hyperdb(store, hex_key, {
      secretKey: keys.write ? (Buffer.isBuffer(keys.write) ? keys.write : Buffer.from(keys.write, 'hex')) : null,
      sparse: true,
    })
    // Wait until everything is loaded and then deliver stream forward
    stream.on('ready', async (err) => {
      if (err) return error(err)

      // Check if you can find _template, if not, this is empty
      stream.get('_template', async (err, tmpl) => {
        if (err) return error(err)
        if (!tmpl || tmpl.length === 0) return done('NO_STREAM_FOUND_WITH_KEY')

        // Add user_password
        stream.user_password = user_password

        // Add encryption password
        stream.encryption_password = encryption_password

        // If user_id was provided, put that as user_id
        stream.user_id = user_id

        // TODO: Support generating key from user_password (update CDR)
        if (!stream.user_id) return error(new Error('USER_ID_MISSING'))

        // Generate the stream around the data stream
        const base = await getInterface('base')
        if (!base) return error(new Error(errors.BASE_INTERFACE_MISSING))
        const Stream = {
          base: base(stream),
        }

        // Get the template
        Stream.template = await Stream.base.getTemplate().catch(error)

        // Apply interfaces
        if (Array.isArray(Stream.template.interfaces)) {
          const ifaces = []
          Stream.template.interfaces.forEach(async (requested_iface) => {
            if (requested_iface) {
              ifaces.push(
                new Promise(async (iface_done, iferror) => {
                  const iface = await getInterface(requested_iface)
                  if (!iface) return iferror(new Error(errors.REQUESTED_INTERFACE_MISSING), { requested_iface })
                  await Stream.base.addInterface(iface, Stream).catch(iferror)
                  iface_done()
                }),
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
