const async = require('async')

exports.meta = (() => {
  // State
  let core_references = {}

  return {
    '@id': 'meta',
    attachCore: (API, stream) => {
      return async (core) => {
        return new Promise(async (done, error) => {
          // Get definition from the core to-be-added
          const definition = await core.getDefinition().catch(error)

          // Create a reference to initialized hypercore
          await API.meta.addCoreReference(definition.datagramKey, core)

          done()
        })
      }
    },
    addCore: (API, stream) => {
      return async (core) => {
        return new Promise(async (done, error) => {
          // Get definition from the core to-be-added
          const definition = await core.getDefinition().catch(error)

          // Create a reference to initialized hypercore
          await API.meta.addCoreReference(definition.datagramKey, core)

          // Add core details to the meta core
          await API.meta.addCoreDetails(definition.datagramKey, definition).catch(error)

          done()
        })
      }
    },
    addCoreDetails: (API, stream) => {
      return async (key, definition) => {
        return new Promise(async (done, error) => {
          // load blocklist and verify key is not there
          // create details:key={name, key, type}
          await API.kv.set(`details:${key}`, definition).catch(error)
          done()
        })
      }
    },
    addCoreReference: (API, stream) => {
      return async (reference, core) => {
        return new Promise(async (done, error) => {
          core_references[reference] = core
          done(core)
        })
      }
    },
    removeCoreReference: (API, stream) => {
      return async (reference) => {
        return new Promise(async (done, error) => {
          if (!core_references) return done()
          delete core_references[reference]
          done()
        })
      }
    },
    getCoreDetails: (API, stream) => {
      return function(key, callback) {
        // get details:key
        exports.meta.get_kv(`details:${key}`, callback)
      }
    },
    removeCore: (API, stream) => {
      return async (key) => {
        return new Promise(async (done, error) => {
          // remove details:key
          await API.kv.rem(`details:${key}`).catch(error)

          await API.meta.removeCoreReference(key).catch(error)

          // addToBlocklist(key)
          await API.kv.set(`blocked:${key}`, new Date().getTime()).catch(error)

          done()
        })
      }
    },
    getCoreReferences: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          done(core_references)
        })
      }
    },
    getBlocklist: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          const keys = await API.kv.getAllKeys().catch(error)

          // reject everything that doesn't start with "blocked:"
          const blocked_keys = keys
            .filter((key) => {
              return key.match(/^blocked:/)
            })
            .map((bkeys) => bkeys.replace('blocked:', ''))

          done(blocked_keys)
        })
      }
    },
    getAllUnopenedCores: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          const all_core_details = await API.meta.getAllCoreDetails().catch(error)

          const unopened_cores = all_core_details.filter((c) => {
            if (typeof core_references[c.datagramKey] === 'undefined') return true
          })
          done(unopened_cores)
        })
      }
      // return function(name, callback) {
      // TODO: Move to Container
      // find all keys
      // exports.meta.getAllCoreDetails((err, cores) => {
      //   if (err) return callback(err)
      //   async.waterfall(
      //     [
      //       (next) => {
      //         // Find the key based on name
      //         cores.forEach((API, stream) => {
      //           if (exports.meta.name === name) return next(null, exports.meta.key)
      //         })
      //       },
      //       (key, next) => {
      //         // Check if core is already in core references aka initialized
      //         if (core_references[key]) return callback(null, core_references[key])
      //         else next(null, key)
      //       },
      //       (key, next) => {
      //         // If not in references, load it
      //         load(key, exports.meta.default_storage, (err, initd_core) => {
      //           if (err) return next(err)
      //           else if (initd_core && initd_exports.meta.key) {
      //             exports.meta.addCoreReference(key, initd_core)
      //             return next(null, core)
      //           } else {
      //             return next()
      //           }
      //         })
      //       },
      //     ],
      //     callback,
      //   )
      // })
      // }
    },
    loadCoresFromStorage: (API, stream) => {
      return function(keys, callback) {
        // Make keys optional
        if (typeof keys === 'function' && !callback) {
          callback = keys
        }
        // find all keys
        exports.meta.getAllCoreDetails((err, cores) => {
          if (err) return callback(err)

          // TODO: Move initialization to Container

          // initialize cores
          // async.forEach(
          //   cores,
          //   (uninitd_core, core_done) => {
          //     load({ key: uninitd_core.meta.key }, exports.meta.default_storage, (err, initd_core) => {
          //       if (err) return core_done(err)
          //       else if (initd_core && initd_core.meta.key) {
          //         exports.meta.addCoreReference(uninitd_core.meta.key.toString('hex'), initd_core)

          //         return core_done()
          //       } else {
          //         return core_done()
          //       }
          //     })
          //   },
          //   callback,
          // )
        })
        // return { key: core }
      }
    },
    addToBlocklist: () => {
      return function() {
        // add block=true in key's details
        // add key to blocklist=[..., key]
      }
    },
    getAllCoreDetails: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          // Get all the keys in the meta
          const keys = await API.kv.getAllKeys().catch(error)

          // reject everything that doesn't start with "details:"
          const cores_keys = keys.filter((key) => {
            return key.match(/^details:/)
          })

          // Let's expand each core key
          const core_details = []
          const kv_fetches = []
          cores_keys.forEach((core_key) => {
            kv_fetches.push(
              new Promise(async (key_done, key_error) => {
                const value = await API.kv.get(core_key).catch(key_error)
                if (value) {
                  core_details.push(value)
                }
                key_done()
              }),
            )
          })
          await Promise.all(kv_fetches)

          done(core_details)
        })
      }
    },
    getAllCores: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          const core_details = await API.meta.getAllCoreDetails().catch(error)
          const cores = []
          async.forEach(
            core_details,
            (cd, core_done) => {
              if (core_references[cd.datagramKey]) {
                cores.push(core_references[cd.datagramKey])
              }
              core_done()
            },
            (err) => {
              if (err) return error(err)
              done(cores)
            },
          )
        })
      }
    },
    exportLegacy: (API, stream) => {
      return function(callback) {
        // first get all the core keys
        exports.meta.getAllCoreDetails((err, cores) => {
          if (err) return callback(err)

          const _cores = {}
          const _coreKeyToCore = {}
          cores.forEach((c) => {
            _cores[c.name] = core_references[c.datagramKey]
            _coreKeyToCore[c.datagramKey] = core_references[c.datagramKey]
          })
          callback(null, { _cores, _coreKeyToCore })
        })
      }
    },
    close: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          core_references = {}
          stream.close()
          API = null
          done()
        })
      }
    },
  }
})()
