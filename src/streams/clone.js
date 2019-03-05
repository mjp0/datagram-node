const { log } = require('../utils/debug')(__filename)
const hyperdb = require('hyperdb')
const { _open_storage } = require('../utils')
const { getInterface } = require('./interfaces/index')

exports.clone = async (args = { keys: { read: null }, storage: null, encryption_password: null }, opts = { user_id: null, remote: false, peer: false }) => {
  return new Promise(async (done, error) => {
    const { storage, keys, encryption_password, user_id, remote, peer } = { ...args, ...opts }

    opts = {
      valueEncoding: 'binary', // Binary encoding is enforced
      sparse: true
    }

    // Make sure we have the key
    if (!keys.read) throw new Error('KEY_REQUIRED')

    if (keys && keys.read) {
      opts.key = Buffer.from(keys.read, 'hex')
    }

    log('Cloning stream', opts.key.toString('hex'))

    const store = _open_storage(opts.key.toString('hex'), storage)

    const stream = hyperdb(store, opts.key, opts)
    stream.on('ready', async (err) => {
      if (err) return error(err)

      // Set stream password
      stream.encryption_password = encryption_password

      // If user_id was provided, put that as user_id, else generate from user_id
      stream.user_id = user_id

      // TODO: Support generating key from user_password (update CDR)
      if (!stream.user_id) return error(new Error('USER_ID_MISSING'))

      // Generate the stream around the data stream
      const base = await getInterface('base')
      const Stream = base(stream)

      // Start listening for the updates
      if (remote) {
        await Stream.connect({ address: await Stream.getAddress().catch(error) })
      }

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
              }),
            )
          } else error(new Error('REQUESTED_INTERFACE_MISSING'))
        })
        await Promise.all(ifaces).catch(error)
      }
      
      return done(Stream)
    })
  })
}
