const debug = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const _open_storage = require('../utils/storage')._open_storage
const crypto = require('hypercore-crypto')

exports.createNewCore = function(type, storage, callback) {
  // Make storage optional
  if (storage && !callback) {
    callback = storage
    storage = null
  }

  const opts = { }
  if (!opts.key) {
    const keyPair = crypto.keyPair()
    opts.key = keyPair.publicKey
    opts.secretKey = keyPair.secretKey
  }
  
  debug("Creating new core", opts.key.toString("hex"), type)

  const store = _open_storage(opts.key.toString("hex"), storage)
  let core = hypercore(store, opts)
  core.ready((err) => {
    if(err) return callback(err)
    return callback(err, core)
  })
}