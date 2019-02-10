const promcall = require('promised-callback').default

const API = {
  compute: (DG) => {
    return (DG) => {
      return new Promise(async (done, error) => {
        const action = DG.action
          .split('.')
          .reduce((obj, key) => (obj && obj[key] !== 'undefined' ? obj[key] : undefined), DG)

        const result = await action(DG).catch(error)
        done(result)
      })
    }
  },
  create: (DG) => {
    return async function(args, callback) {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        done('create')
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
  build: (template) => {
    // uses template to build container and stream set
  },
  share: () => {
    // creates a share link to container
  },
}

module.exports = API
