const debug = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const _open_storage = require('../utils/storage')._open_storage

module.exports = function(keys, storage, callback) {
  // Make storage optional
  if (storage && !callback) {
    callback = storage
    storage = null
  }
  debug('Trying to open core with key', keys.key)

  // Open storage for the core
  const store = _open_storage(keys.key, storage)

  // Open key
  const store_key = store('key')

  // Let's check whether the key exists
  store_key.read(0, 4, (err, bytes) => {
    // If there's an error, it's empty which means that it does not exist
    if (err) {
      debug('No core found with key', keys.key)
      return callback()
    }

    // Everything seems to be cool so let's try to initialize it
    const core = hypercore(store, {
      key: Buffer.from(keys.key, 'hex'),
      secretKey: keys.secret ? Buffer.from(keys.secret, 'hex') : null,
    })
    // Wait until everything is loaded and then deliver core forward
    core.ready((err) => {
      callback(err, core)
    })
  })
}
