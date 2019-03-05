const promcall = require('promised-callback')
const { err, checkVariables, fromB58, deriveKeyPair, getNested, toB58 } = require('./utils')
const streams = require('./streams')
const templates = require('./templates/streams')

const API = {
  share: (DG, _) => {
    return async (args = { realtime: false, odi: false }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)

        const stream_keys = Object.keys(_.streams)

        if (stream_keys.length === 0) return error(new Error('NO_STREAMS_FOUND'))
        try {
          await _.streams[stream_keys[0]].publish({ realtime: getNested(args, 'realtime') || false, odi: getNested(args, 'odi') || false })
          const keys = await _.streams[stream_keys[0]].getKeys()
          if (!keys || !keys.read) return error(new Error('READ_KEY_MISSING'))
          const encryption_key = await _.streams[stream_keys[0]].getUserId()
          if (!encryption_key) return error(new Error('USER_ID_MISSING'))
          done(`${toB58(keys.read)}|${toB58(encryption_key)}`)
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
  getSettings: (DG, _) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        done(_.settings)
      })
    }
  },
  destroy: (DG, _) => {
    return async (args = { template: null }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        const missing = await checkVariables(args, [ '' ])
        if (missing) return error(new Error('MISSING_VARIABLES'), { missing })
        done()
      })
    }
  },
  connect: (DG, _) => {
    return async (args = { template: null }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        const missing = await checkVariables(args, [ '' ])
        if (missing) return error(new Error('MISSING_VARIABLES'), { missing })
        done()
      })
    }
  },
  authorizeDevice: (DG, _) => {
    return async (args = { template: null }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        const missing = await checkVariables(args, [ '' ])
        if (missing) return error(new Error('MISSING_VARIABLES'), { missing })
        done()
      })
    }
  },
}

module.exports = API
