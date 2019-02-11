const promcall = require('promised-callback').default

const API = {
  build: (DG) => {
    return async (args, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback) //
        // builds a stream based on the template
        done('build')
      })
    }
  },
  add: (stream) => {
    // adds stream to the container
  },
}

module.exports = API
