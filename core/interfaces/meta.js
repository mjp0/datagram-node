const async = require('async')
const { create, load } = require('../')

module.exports = exports = {
  '@id': 'meta',
  attach_core: (API, stream) => {
    return function(name, hypercore, type, callback) {
      // Get a key from core
      const key = stream.key.toString('hex')

      // Create a reference to initialized hypercore
      exports.meta.add_core_reference(key, hypercore)
      exports.meta.add_core_reference(name, hypercore)

      // Add core details to the meta core
      exports.meta.add_core_details(name, key, type, (err) => {
        if (err) callback(err)
        else callback(null, hypercore)
      })
    }
  },
  add_core: (API, stream) => {
    return function(name, type, callback) {
      // Create new hypercore
      create(type, exports.meta.default_storage || null, null, (err, hypercore) => {
        if (err) return callback(err)

        // Get a key from core
        const key = stream.key.toString('hex')

        // Create a reference to initialized hypercore
        exports.meta.add_core_reference(key, hypercore)
        exports.meta.add_core_reference(name, hypercore)

        // Add core details to the meta core
        exports.meta.add_core_details(name, key, type, (err) => {
          if (err) callback(err)
          else callback(null, hypercore)
        })
      })
    }
  },
  add_core_details: (API, stream) => {
    return function(name, key, type, callback) {
      // load blocklist and verify key is not there
      // create details:key={name, key, type}
      exports.meta.set_kv(`details:${key}`, { name, key, type }, callback)
    }
  },
  add_core_reference: (API, stream) => {
    return function(reference, hypercore) {
      if (!exports.meta.core_references) exports.meta.core_references = {}
      exports.meta.core_references[reference] = hypercore
    }
  },
  remove_core_reference: (API, stream) => {
    return function(reference) {
      if (!exports.meta.core_references) return
      delete exports.meta.core_references[reference]
    }
  },
  get_core_details: (API, stream) => {
    return function(key, callback) {
      // get details:key
      exports.meta.get_kv(`details:${key}`, callback)
    }
  },
  remove_core: (API, stream) => {
    return function(key, callback) {
      // remove details:key
      exports.meta.rem_kv(`details:${key}`, (err) => {
        if (err) return callback(err)

        exports.meta.remove_core_reference(key)

        // add_to_blocklist(key)
        exports.meta.set_kv(`blocked:${key}`, new Date().getTime(), (err) => {
          callback(err, core)
        })
      })
    }
  },
  get_blocklist: (API, stream) => {
    return function(callback) {
      exports.meta.get_all_keys((err, keys) => {
        if (err) return callback(err)

        // reject everything that doesn't start with "blocked:"
        const blocked_keys = keys
          .filter((key) => {
            return key.match(/^blocked:/)
          })
          .map((bkeys) => bkeys.replace('blocked:', ''))

        callback(err, blocked_keys)
      })
    }
  },
  open_core: (API, stream) => {
    return function(name, callback) {
      // find all keys
      exports.meta.get_all_core_details((err, cores) => {
        if (err) return callback(err)

        async.waterfall(
          [
            (next) => {
              // Find the key based on name
              cores.forEach((API, stream) => {
                if (exports.meta.name === name) return next(null, exports.meta.key)
              })
            },
            (key, next) => {
              // Check if core is already in core references aka initialized
              if (exports.meta.core_references[key]) return callback(null, exports.meta.core_references[key])
              else next(null, key)
            },
            (key, next) => {
              // If not in references, load it
              load(key, exports.meta.default_storage, (err, initd_core) => {
                if (err) return next(err)
                else if (initd_core && initd_exports.meta.key) {
                  exports.meta.add_core_reference(key, initd_core)
                  return next(null, core)
                } else {
                  return next()
                }
              })
            },
          ],
          callback,
        )
      })
    }
  },
  load_cores_from_storage: (API, stream) => {
    return function(keys, callback) {
      // Make keys optional
      if (typeof keys === 'function' && !callback) {
        callback = keys
      }
      // find all keys
      exports.meta.get_all_core_details((err, cores) => {
        if (err) return callback(err)

        // initialize cores
        async.forEach(
          cores,
          (uninitd_core, core_done) => {
            load({ key: uninitd_exports.meta.key }, exports.meta.default_storage, (err, initd_core) => {
              if (err) return core_done(err)
              else if (initd_core && initd_exports.meta.key) {
                exports.meta.add_core_reference(uninitd_exports.meta.key.toString('hex'), initd_core)

                return core_done()
              } else {
                return core_done()
              }
            })
          },
          callback,
        )
      })
      // return { key: core }
    }
  },
  add_to_blocklist: () => {
    return function() {
      // add block=true in key's details
      // add key to blocklist=[..., key]
    }
  },
  get_all_core_details: (API, stream) => {
    return function(callback) {
      // Get all the keys in the meta
      exports.meta.get_all_keys((err, keys) => {
        if (err) return callback(err)

        // reject everything that doesn't start with "details:"
        const cores_keys = keys.filter((key) => {
          return key.match(/^details:/)
        })

        // Let's expand each core key
        const core_details = []
        async.forEach(
          cores_keys,
          (core_key, key_done) => {
            exports.meta.get_kv(core_key, (err, value) => {
              if (err) return key_done(err)
              if (value) {
                core_details.push(value)
              }
              return key_done()
            })
          },
          (err) => {
            callback(err, core_details)
          },
        )
      })
    }
  },
  get_all_cores: (API, stream) => {
    return function(callback) {
      exports.meta.get_all_core_details((err, core_details) => {
        if (err) return callback(err)
        const cores = []
        async.forEach(
          core_details,
          (cd, done) => {
            if (exports.meta.core_references[cd.key]) {
              cores.push(exports.meta.core_references[cd.key])
            }
            done()
          },
          (err) => {
            callback(err, cores)
          },
        )
      })
    }
  },
  export_legacy: (API, stream) => {
    return function(callback) {
      // first get all the core keys
      exports.meta.get_all_core_details((err, cores) => {
        if (err) return callback(err)

        const _cores = {}
        const _coreKeyToCore = {}
        cores.forEach((c) => {
          _cores[c.name] = exports.meta.core_references[c.key]
          _coreKeyToCore[c.key] = exports.meta.core_references[c.key]
        })
        callback(null, { _cores, _coreKeyToCore })
      })
    }
  },
}

