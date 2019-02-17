const promcall = require('promised-callback').default
const ContainerService = require('./container')
const { err, checkVariables } = require('./utils')

const API = {
  createFromTemplate: (container) => {
    return async (args = { template: null, password: null, user_password: null }, callback) => {
      return new Promise(async (resolve, reject) => {
        const { done, error } = promcall(resolve, reject, callback)
        // Check variables
        const missing = checkVariables(args, [ 'template', 'password', 'user_password' ])
        if (missing) return error(err.MISSING_VARIABLES, { missing, args })

        // Create container
        const container = await ContainerService({ password: args.password, user_password: args.user_password }, { template: args.template }).catch(error)

        done(container)
      })
    }
  },
}

module.exports = API
