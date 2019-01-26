const debug = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const _open_storage = require('../utils/storage')._open_storage
const crypto = require('hypercore-crypto')

exports.createNewCore = function(type, storage, keys, callback) {
  // Make storage optional
  if (storage && !callback) {
    callback = storage
    storage = null
  }
  
  const opts = { }
  // If this is meta core, use generated keys
  if(type === "meta") {
    if(typeof keys !== "object") return callback("META_REQUIRES_KEYS")
    opts.key = Buffer.from(keys.key, "hex")
    opts.secretKey = Buffer.from(keys.secret, "hex")
  } else if(keys) {
    opts.key = Buffer.from(keys.key, "hex")
    opts.secretKey = keys.secret ? Buffer.from(keys.secret, "hex") : null // secret is not required
  } else {
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