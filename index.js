const MOTD = `
██████╗  █████╗ ████████╗ █████╗  ██████╗ ██████╗  █████╗ ███╗   ███╗
██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔════╝ ██╔══██╗██╔══██╗████╗ ████║
██║  ██║███████║   ██║   ███████║██║  ███╗██████╔╝███████║██╔████╔██║
██║  ██║██╔══██║   ██║   ██╔══██║██║   ██║██╔══██╗██╔══██║██║╚██╔╝██║
██████╔╝██║  ██║   ██║   ██║  ██║╚██████╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
                          version 0.1
    Resources at datagramjs.com | Follow project at @machianists
---------------------------------------------------------------------
`

// DEPENDENCIES
const {
  error,
  err,
  deriveKeyPairSync,
  createKeyPairSync,
  generatePasswordSync,
  readStringFromStorage,
  _open_storage,
  toB58, fromB58
} = require('./utils')
const promcall = require('promised-callback').default
const { log } = require('./utils/debug')(__filename)
const home = require('home')
const DGAPI = require('./api.dg')
const STREAMSAPI = require('./api.streams')

// LET'S GET STARTED
module.exports = class {
  constructor(
    credentials = { user_id: null, password: null },
    settings = { action: null, realtime: false, storage: null, path: null },
  ) {
    const state = { ...this, credentials: { ...credentials }, settings: { ...settings }, experience: {} }

    log('Validating username and password...')
    if (!state.credentials.password) {
      log('No password, generating a new one...')
      state.credentials.password = toB58(generatePasswordSync())
      state.experience.new_password_generated = true
      if (!state.credentials.password) return error(err.PASSWORD_REQUIRED)
    }
    if (!state.credentials.user_id) {
      log('No user_id, generating a new one...')
      const key_pair = createKeyPairSync()
      state.credentials.user_id = toB58(key_pair.secret)
      if (!state.credentials.user_id) return error(err.USER_ID_REQUIRED)
    }

    log('Generating keys for this Datagram...')
    state.credentials.datagram_keys = deriveKeyPairSync(state.credentials.password)

    // Deleting password if not new because it's not needed anymore
    if (!state.experience.new_password_generated) delete state.credentials.password

    log('Adding APIs to the instance...')
    function addApi(namespace, api) {
      for (const action in api) {
        if (api.hasOwnProperty(action)) {
          if (typeof api[action] === 'function') {
            if (!namespace) {
              state[action] = api[action](state)
            } else {
              if (!state[namespace]) state[namespace] = {}
              state[namespace][action] = api[action](state)
            }
          } else {
            return error(err.UNKNOWN_ACTION, { action, api })
          }
        }
      }
    }
    addApi(null, DGAPI)
    addApi('stream', STREAMSAPI)

    let _container_checked = false

    log('Initializing existing or creating new container...')
    const storage =
      state.storage ||
      _open_storage(toB58(state.credentials.datagram_keys.key), state.path || `${home()}/.datagram/`)
    readStringFromStorage(storage('container_key'), (err, result) => {
      if (err) {
        log(
          `Container not found, creating a new container with address ${state.credentials.datagram_keys.key.toString(
            'hex',
          )}...`,
        )
      } else {
        log(
          `Container ${toB58(state.credentials.datagram_keys.key)} found, initializing container and streams...`,
        )
      }
      log('Container initialized')
      _container_checked = true
    })

    state.ready = async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        const state_check = () => {
          if (_container_checked && state.settings.action) {
            log('Executing action...')

            // Make sure that action exists if one was requested
            if (state.settings.action) {
              log(`Executing the requested action ${state.settings.action}`)
              const action = state.settings.action
                .split('.')
                .reduce((obj, key) => (obj && obj[key] !== 'undefined' ? obj[key] : undefined), state)
              if (!action) return error(err.UNKNOWN_ACTION)
              state.action = state.settings.action

              // Run the action
              state
                .compute(state)
                .then((result) => {
                  // Cleaning up
                  delete state.ready
                  delete state.action
                  delete state.settings.action

                  console.log(state)
                  return done(result)
                })
                .catch((err) => {
                  error(err)
                })
            }
          } else if (_container_checked && !state.settings.action) return done(state)
          else {
            setTimeout(state_check, 1)
          }
        }
        setTimeout(state_check, 1)
      })
    }

    return state
  }
}

// COMMAND LINE INTERFACE SUPPORT
if (process.argv[2] && !process.argv[2].match('.js')) {
  console.log(MOTD)

  // Let's check we have both user_id and password
  if (!process.argv[3] && !process.env['DB_USER_ID']) {
    error(err.USER_ID_REQUIRED)
    process.exit()
  }
  if (!process.argv[4] && !process.env['DB_PASSWORD']) {
    error(err.PASSWORD_REQUIRED)
    process.exit()
  }

  const DG = new exports.Datagram(
    {
      user_id: process.argv[3] || process.env['DB_USER_ID'],
      password: process.argv[4] || process.env['DB_PASSWORD'],
    },
    {
      action: process.argv[2],
      realtime: process.argv.indexOf('--realtime') !== -1 ? process.argv[process.argv.indexOf('--realtime')] : false,
    },
  )
  DG.ready((err, dg) => {
    console.log(dg)
  })
}

// ;(async () => {
//   const DG = new exports.Datagram({
//     user_id: '0fork',
//     password: '3l173m4D5K1ll5',
//   })
//   const b = await DG.stream.build({})
//   console.log('output', b)
// })()
