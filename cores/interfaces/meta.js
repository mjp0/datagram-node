const async = require('async')
const { createNewCore } = require('../create_core')
const load_core = require('../load_core')

const API = {
  attach_core: (core) => {
    return function(name, hypercore, type, callback) {
      // Get a key from core
      const key = hypercore.key.toString('hex')

      // Create a reference to initialized hypercore
      core.add_core_reference(key, hypercore)
      core.add_core_reference(name, hypercore)

      // Add core details to the meta core
      core.add_core_details(name, key, type, (err) => {
        if (err) callback(err)
        else callback(null, hypercore)
      })
    }
  },
  add_core: (core) => {
    return function(name, type, callback) {
      // Create new hypercore
      createNewCore(type, core.default_storage || null, null, (err, hypercore) => {
        if (err) return callback(err)

        // Get a key from core
        const key = hypercore.key.toString('hex')

        // Create a reference to initialized hypercore
        core.add_core_reference(key, hypercore)
        core.add_core_reference(name, hypercore)

        // Add core details to the meta core
        core.add_core_details(name, key, type, (err) => {
          if (err) callback(err)
          else callback(null, hypercore)
        })
      })
    }
  },
  add_core_details: (core) => {
    return function(name, key, type, callback) {
      // load blocklist and verify key is not there
      // create details:key={name, key, type}
      core.set_kv(`details:${key}`, { name, key, type }, callback)
    }
  },
  add_core_reference: (core) => {
    return function(reference, hypercore) {
      if (!core.core_references) core.core_references = {}
      core.core_references[reference] = hypercore
    }
  },
  remove_core_reference: (core) => {
    return function(reference) {
      if (!core.core_references) return
      delete core.core_references[reference]
    }
  },
  get_core_details: (core) => {
    return function(key, callback) {
      // get details:key
      core.get_kv(`details:${key}`, callback)
    }
  },
  remove_core: (core) => {
    return function(key, callback) {
      core.rem_kv(`details:${key}`, (err) => {
        if (err) return callback(err)

        core.remove_core_reference(key)
        callback()
      })
      // remove details:key

      // add_to_blocklist(key)
    }
  },
  add_meta: () => {
    return function() {
      // fetch details:key
      // add or replace existing meta_key data
      // create details:key={name, key, type, meta_key, ...}
    }
  },
  remove_meta: () => {
    return function() {
      // fetch details:key
      // delete meta_key data
      // create details:key={name, key, type, ...}
    }
  },
  open_core: (core) => {
    return function(name, callback) {
      // find all keys
      core.get_all_core_details((err, cores) => {
        if (err) return callback(err)

        async.waterfall(
          [
            (next) => {
              // Find the key based on name
              cores.forEach((core) => {
                if (core.name === name) return next(null, core.key)
              })
            },
            (key, next) => {
              // Check if core is already in core references aka initialized
              if (core.core_references[key]) return callback(null, core.core_references[key])
              else next(null, key)
            },
            (key, next) => {
              // If not in references, load it
              load_core(key, core.default_storage, (err, initd_core) => {
                if (err) return next(err)
                else if (initd_core && initd_core.key) {
                  core.add_core_reference(key, initd_core)
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
  load_cores_from_storage: (core) => {
    return function(keys, callback) {
      // Make keys optional
      if (typeof keys === 'function' && !callback) {
        callback = keys
      }
      // find all keys
      core.get_all_core_details((err, cores) => {
        if (err) return callback(err)

        // initialize cores
        async.forEach(
          cores,
          (uninitd_core, core_done) => {
            load_core({ key: uninitd_core.key }, core.default_storage, (err, initd_core) => {
              if (err) return core_done(err)
              else if (initd_core && initd_core.key) {
                core.add_core_reference(uninitd_core.key.toString('hex'), initd_core)

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
  get_all_core_details: (core) => {
    return function(callback) {
      // Get all the keys in the meta
      core.get_all_keys((err, keys) => {
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
            core.get_kv(core_key, (err, value) => {
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
  get_all_cores: (core) => {
    return function(callback) {
      core.get_all_core_details((err, core_details) => {
        if (err) return callback(err)
        const cores = []
        async.forEach(
          core_details,
          (cd, done) => {
            if (core.core_references[cd.key]) {
              cores.push(core.core_references[cd.key])
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
  export_legacy: (core) => {
    return function(callback) {
      // first get all the core keys
      core.get_all_core_details((err, cores) => {
        if (err) return callback(err)

        const _cores = {}
        const _coreKeyToCore = {}
        cores.forEach((c) => {
          _cores[c.name] = core.core_references[c.key]
          _coreKeyToCore[c.key] = core.core_references[c.key]
        })
        callback(null, { _cores, _coreKeyToCore })
      })
    }
  },
}

module.exports = API
