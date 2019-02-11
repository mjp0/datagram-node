const debug = require('../utils/debug')(__filename)
const ikv = require('../core/interfaces/kv')
const imeta = require('../core/interfaces/meta')
const { createNewCore, loadCore } = require('../core')

exports.create = function(args = { storage: null }, opts = { keys: { key: null, secret: null } }, callback) {
  debug('[META] creating new meta core')
  createNewCore({ definition: { id: 'meta' }, storage: args.storage }, { keys: opts.keys }, (err, core) => {
    if (err) return callback(err)

    // This is where a good old hypercore turns into meta-core
    applyInterface(ikv, core)
    applyInterface(imeta, core)

    // It's likely we want to use the same storage used here with
    // new cores so let's make our lives easier
    core.default_storage = args.storage

    callback(err, core)
  })
}

exports.open = function (args = { storage: null, keys: { key: null, secret: null } }, callback) {
  const { storage, keys } = { ...args }
  debug('Open meta core', keys.key)
  loadCore(keys, storage, (err, core) => {
    if (err) return callback(err)

    if (core) {
      // This is where a good old hypercore turns into meta-core
      applyInterface(ikv, core)
      applyInterface(imeta, core)

      // It's likely we want to use the same storage used here with
      // new cores so let's make our lives easier
      core.default_storage = storage
      return callback(err, core)
    } else {
      return callback()
    }
  })
}

function applyInterface(interf, core) {
  for (const method in interf) {
    if (interf.hasOwnProperty(method)) {
      core[method] = interf[method](core)
    }
  }
  return core
}
