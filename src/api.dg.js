const promcall = require('promised-callback').default
const { err, getNested } = require('./utils')

const API = {
  build: (DG) => {
    return async (args = { template: null }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        if (!getNested(args, 'template')) return error(new Error(err.TEMPLATE_MISSING))

        done(DG)
      })
    }
  },
  compute: (DG) => {
    return (DG) => {
      return new Promise(async (done, error) => {
        if (!getNested(DG, 'settings.action')) return error(new Error(err.ACTION_REQUIRED))

        // Run the action and return the result
        try {
          const result = await DG.settings.action(DG)
          done(result)
        } catch (e) {
          error(e)
        }
      })
    }
  },
  getCredentials: (DG) => {
    return async (callback) => {
      return new Promise(async (resolve, reject) => {
        const { done } = promcall(resolve, reject, callback)
        done(DG.credentials)
      })
    }
  },
  test_ok: (DG) => {
    return async (args, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done } = promcall(resolve, reject, callback) //
        done('OK')
      })
    }
  },
  test_fail: (DG) => {
    return async (args, callback) => {
      return new Promise(async (resolve, reject) => {
        const { error } = promcall(resolve, reject, callback) //
        error('ERROR')
      })
    }
  },
}

module.exports = API
