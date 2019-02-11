const promcall = require('promised-callback').default

const API = {
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
  add: (stream) => {
    // adds stream to the container
  },
}

module.exports = API
