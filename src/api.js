const promcall = require('promised-callback')
const { checkVariables, fromB58, getNested, toB58 } = require('./utils')


const API = {
  share: (DG, _) => {
    return async (args = { realtime: false, odi: false }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)

        const stream_keys = Object.keys(_.streams)

        if (stream_keys.length === 0) return error(new Error('NO_STREAMS_FOUND'))
        try {
          await API.disconnect()
          await _.streams[stream_keys[0]].base.publish({
            realtime: getNested(args, 'realtime') || false,
            odi: getNested(args, 'odi') || false,
          })
          const keys = await _.streams[stream_keys[0]].base.getKeys()
          const missing = checkVariables(keys, ['read', 'encryption_password'])
          if (missing) return error(errors.MISSING_VARIABLES, { missing, keys })

          done(`${toB58(keys.read)}/${toB58(keys.encryption_password)}`)
        } catch (e) {
          error(e)
        }
      })
    }
  },
  getCredentials: (DG, _) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        done(_.credentials)
      })
    }
  },
  getKeys: (DG, _) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        try {
          const stream_keys = Object.keys(_.streams)
          if (stream_keys.length === 0) return error(new Error('NO_STREAMS_FOUND'))
          const keys = await _.streams[stream_keys[0]].base.getKeys()
          keys.read = toB58(keys.read.toString('hex'))
          keys.write = toB58(keys.write.toString('hex'))
          keys.auth = toB58(keys.auth.toString('hex'))
          keys.encryption_password = toB58(keys.encryption_password.toString('hex'))
          done(keys)
        } catch (e) {
          error(e)
        }
      })
    }
  },
  getSettings: (DG, _) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        done(_.settings)
      })
    }
  },
  monitor: (DG, _) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        const stream_keys = Object.keys(_.streams)
        if (stream_keys.length === 0) return error(new Error('NO_STREAMS_FOUND'))
        done(await _.streams[stream_keys[0]].base.getStats())
      })
    }
  },
  disconnect: (DG, _) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        try {
          const stream_keys = Object.keys(_.streams)
          if (stream_keys.length === 0) return error(new Error('NO_STREAMS_FOUND'))
          await _.streams[stream_keys[0]].base.disconnect()
          done()
        } catch (e) {
          error(e)
        }
      })
    }
  },
  authorizeDevice: (DG, _) => {
    return async (args = { auth_token: null }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        const missing = await checkVariables(args, [ 'auth_token' ])
        if (missing) return error(new Error('MISSING_VARIABLES'), { missing })
        try {
          const stream_keys = Object.keys(_.streams)

          if (stream_keys.length === 0) return error(new Error('NO_STREAMS_FOUND'))
          const auth_token = fromB58(args.auth_token)
          await _.streams[stream_keys[0]].base.authorize({ key: auth_token })
          if (await _.streams[stream_keys[0]].base.isAuthorized({ key: auth_token })) {
            console.log(_.streams[stream_keys[0]].base.feeds)
            done(true)
          } else {
            done(false)
          }
        } catch (e) {
          error(e)
        }
      })
    }
  },
  getAuthToken: (DG, _) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        try {
          const stream_keys = Object.keys(_.streams)

          if (stream_keys.length === 0) return error(new Error('NO_STREAMS_FOUND'))
          const keys = await _.streams[stream_keys[0]].base.getKeys()
          done(toB58(keys.auth))
        } catch (e) {
          error(e)
        }
      })
    }
  },
}

module.exports = API
