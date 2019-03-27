const { log } = require('../utils/debug')(__filename)
const hyperdb = require('hyperdb')
const { _open_storage } = require('../utils')
const { getInterface } = require('./interfaces/index')

exports.clone = async (
  args = { keys: { read: null }, storage: null, encryption_password: null, user_id: null, user_password: null },
  opts = { remote: false, peer: false, realtime: false, host: false, odi: false, full_sync: false },
) => {
  return new Promise(async (done, error) => {
    const { storage, keys, encryption_password, user_id, user_password, remote, realtime, host, odi, full_sync } = {
      ...args,
      ...opts,
    }

    opts = {
      valueEncoding: 'binary', // Binary encoding is enforced
      sparse: full_sync === true ? false : true,
    }

    // Make sure we have the key
    if (!keys.read) throw new Error('KEY_REQUIRED')

    if (keys && keys.read) {
      opts.key = Buffer.from(keys.read, 'hex')
    }

    log(`Cloning stream ${opts.key.toString('hex')} | fullsync: ${!opts.sparse}, rl: ${realtime}`)

    const store = _open_storage(opts.key.toString('hex')+'-clone', storage)

    const stream = hyperdb(store, opts.key, opts)
    stream.on('ready', async (err) => {
      if (err) return error(err)

      // Add user_password
      stream.user_password = user_password

      // Set stream password
      stream.encryption_password = encryption_password

      // If user_id was provided, put that as user_id, else generate from user_id
      stream.user_id = user_id

      // TODO: Support generating key from user_password (update CDR)
      if (!stream.user_id) return error(new Error('USER_ID_MISSING'))

      // Generate the stream around the data stream
      const base = await getInterface('base')
      const Stream = {
        base: base(stream),
      }

      async function finishInitialization() {
        return new Promise(async (init_done, error) => {
          log('Connection receiving, waiting for template download...')

          // Get the template
          Stream.template = await Stream.base.getTemplate().catch(error)
          const failsafe = 10
          if (!Stream.template) {
            async function checkTemplate() {
              Stream.template = await Stream.base.getTemplate().catch(error)
              failsafe--
              console.log(failsafe)
              if(!Stream.template && failsafe > 0) setTimeout(checkTemplate, 200)
              else {
                return error(new Error('INITIALIZATION_FAIL_MISSING_TEMPLATE'))
              }
            }
            checkTemplate()
            // await Stream.base.watchKey('_template', checkTemplate)
          }
          
          log('Template received, finishing initialization...')

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
          init_done(Stream)
        })
      }

      // Start listening for the updates
      if (remote) {
        let init_run = false
        await Stream.base.connect({
          address: await Stream.base.getAddress().catch(error),
          realtime,
          odi,
          host,
          onConnection: async (details) => {
            if (!init_run) await finishInitialization()
            init_run = true
            return done(Stream)
          },
        })
      } else return done(Stream)
    })
  })
}
