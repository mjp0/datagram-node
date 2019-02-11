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
const utils = require('./utils')
const { error, err } = utils
const promcall = require('promised-callback').default
const { log } = require('./utils/debug')(__filename)
const home = require('home')
const DGAPI = require('./api.dg')
const STREAMSAPI = require('./api.streams')
const waterfall = require('async/waterfall')

// LET'S GET STARTED
// comments in log() statements
module.exports = class {
  constructor(
    credentials = { user_id: null, password: null },
    settings = { action: null, realtime: false, storage: null, path: null },
  ) {
    log('Initializing state...')
    const state = {
      ...this,
      credentials: { ...credentials },
      settings: { ...settings },
      _: { container_checked: false },
    }

    state.debug = () => {
      state._.debug = true
    }

    log('Executing initialization sequence...')
    waterfall(
      [
        (next) => {
          log('Validating username and password...')
          if (!state.credentials || !state.credentials.password) {
            log('No password, generating a new one...')
            utils.generatePassword({ len: 32 }, (err, generated_password) => {
              if (err) return next(err)
              state.credentials.password = utils.toB58(generated_password)
              state._.new_password_generated = true
              if (!state.credentials.password) return next(err.PASSWORD_REQUIRED)
              else next()
            })
          } else {
            log('Password provided')
            next()
          }
        },
        (next) => {
          if (!state.credentials || !state.credentials.user_id) {
            log('No user_id, generating a new one...')
            utils.createKeyPair((err, key_pair) => {
              if (err) return next(err)
              state.credentials.user_id = utils.toB58(key_pair.secret)
              state._.new_user_id_generated = true
              if (!state.credentials.user_id) return next(err.USER_ID_REQUIRED)
              else next()
            })
          } else {
            log('User id provided')
            next()
          }
        },
        (next) => {
          log('Generating id for the Datagram...')
          utils.hash({ str: state.credentials.user_id + state.credentials.password }, (err, hash) => {
            if (err) return next(err)
            state.id = hash
            next()
          })
        },
        (next) => {
          if (state._.new_password_generated || state._.new_user_id_generated) {
            log('Generating keys for the Datagram...')
            if (!state.credentials.password) return next(err.PASSWORD_REQUIRED)
            utils.deriveKeyPair({ master_key: state.credentials.password }, (err, keys) => {
              if (err) return next(err)

              state.credentials.datagram_keys = keys

              // Deleting password if not new because it's not needed anymore
              if (!state._.new_password_generated) {
                log('Removing password from credentials to improve security')
                delete state.credentials.password
              } else {
                log('> "Remember to backup your user_id and password"')
              }

              next()
            })
          } else {
            log('Datagram keys provided')
            next()
          }
        },
        (next) => {
          log('Adding APIs...')
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
                  return next({ err: err.UNKNOWN_ACTION, meta: { action, api } })
                }
              }
            }
          }
          addApi(null, DGAPI)
          addApi('stream', STREAMSAPI)
          next()
        },
        (next) => {
          const storage_path = state.path || `${home()}/.datagram/`
          if (!state.settings.storage) state.settings.storage = storage_path
          if (state._.new_password_generated || state._.new_user_id_generated) {
            log('Creating new Datagram...')

            const storage = utils._open_storage(state.id, state.settings.storage || storage_path)
            storage('keys').read(0, 1, (err, result) => {
              if (err) {
                log(
                  `Existing Datagram not found, creating new with address ${utils.toB58(
                    state.credentials.datagram_keys.key,
                  )}...`,
                )

                // encrypt credentials with user_id+password and store them to "keys"
                log('Encrypting keys...')
                utils.encryptData(
                  {
                    data: state.credentials.datagram_keys,
                    key: state.id,
                  },
                  (err, encrypted_datagram_keys) => {
                    if (err) return next(err)

                    log('Storing encrypted keys in the storage...')
                    storage('keys').write(0, encrypted_datagram_keys.encrypted_data, (err) => {
                      if (err) return next(err)

                      // Store nonce to "nonce"
                      log('Storing nonce to storage...')
                      const nonce = encrypted_datagram_keys.password.split('|')[1]
                      utils.writeStringToStorage(nonce, storage('nonce'), (err) => {
                        if (err) return next(err)

                        log('Datagram initialized')
                        state._.container_checked = true
                        next()
                      })
                    })
                  },
                )
              }
            })
          } else {
            log(`Datagram ${state.id} found, restoring data...`)

            const storage = utils._open_storage(state.id, state.settings.storage || storage_path)

            log('Reading nonce from storage...')
            utils.readStringFromStorage(storage('nonce'), (err, nonce) => {
              if (err) return next(err)

              log('Reading encrypted keys from storage...')
              utils.readFromStorage(storage('keys'), (err, encrypted_keys) => {
                if (err) return next(err)

                log('Decrypting keys...')
                utils.decryptData(
                  {
                    data: encrypted_keys,
                    key: state.id,
                    nonce,
                  },
                  (err, decrypted_keys) => {
                    if (err) return next(err)

                    if (decrypted_keys && decrypted_keys.key && decrypted_keys.secret) {
                      state.credentials.datagram_keys = decrypted_keys
                      state._.container_checked = true

                      log(`Datagram ${nonce} restored`)
                      next()
                    } else return next('FAILED_DECRYPTING_DATAGRAM_KEYS')
                  },
                )
              })
            })
          }
        },
      ],
      (err) => {
        if (err) return error(err)
      },
    )

    state.ready = async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        const state_check = () => {
          if (state._.container_checked && state.settings.action) {
            log('Executing action...')

            // Make sure that action exists if one was requested
            if (state.settings.action) {
              log(`Executing the requested action ${state.settings.action}`)
              // const action = utils.getNested(state, state.settings.action)
              state.settings.action = state.settings.action
                .split('.')
                .reduce((obj, key) => (obj && obj[key] !== 'undefined' ? obj[key] : undefined), state)
              if (!state.settings.action) return error(err.UNKNOWN_ACTION)

              // Run the action
              state
                .compute(state)
                .then((result) => {
                  // Cleaning up
                  if (!state._.debug) {
                    delete state.ready
                    delete state.settings.action
                    delete state._

                    for (const key in state) {
                      if (state.hasOwnProperty(key)) {
                        if (utils.getNested(state[key], 'test_ok')) {
                          delete state[key].test_ok
                          if (state[key].test_fail) {
                            delete state[key].test_fail
                          }
                        }
                      }
                    }
                  }
                  if (state._.debug) console.log(state)
                  return done(result)
                })
                .catch((err) => {
                  return error(err)
                })
            }
          } else if (state._.container_checked && !state.settings.action) return done(state)
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
    if (err) throw err
    console.log(dg)
  })
}
