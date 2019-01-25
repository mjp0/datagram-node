const debug = require('../utils/debug')(__filename)
const kv_ui = require('../cores/interfaces/kv')
const meta_ui = require('../cores/interfaces/meta')
const { createNewCore } = require('../cores/create_core')
const load_core = require('../cores/load_core')
/*

DESIGN
- add type, key and name of cores
- change the name of cores
- remove cores
- holds block list for unwanted or removed cores
- must output an object {key: feed}

*/

exports.create = function(storage, callback) {
  // Make storage optional
  if(storage && !callback) {
    callback = storage
    storage = null
  }

  debug("[META] creating new meta core")
  createNewCore("meta", storage, (err, core) => {

    // This is where a good old hypercore turns into meta-core
    applyInterface(kv_ui, core)
    applyInterface(meta_ui, core)

    // It's likely we want to use the same storage used here with
    // new cores so let's make our lives easier
    core.default_storage = storage

    callback(err, core)
  })
}

exports.open = function(key, storage, callback) {
  // Make storage optional
  if (storage && !callback) {
    callback = storage
    storage = null
  }

  debug("Open meta core", key)
  load_core(key, storage, (err, core) => {
    if(err) return callback(err)

    if(core) {

      debug("core", core)
      // This is where a good old hypercore turns into meta-core
      applyInterface(kv_ui, core)
      applyInterface(meta_ui, core)
      
      // It's likely we want to use the same storage used here with
      // new cores so let's make our lives easier
      core.default_storage = storage  
      return callback(err, core)

    } else {
      return callback()
    }
  })
}


function applyInterface(interface, core) {
  for (const method in interface) {
    if (interface.hasOwnProperty(method)) {
      core[method] = interface[method](core);
    }
  }
  return core
}