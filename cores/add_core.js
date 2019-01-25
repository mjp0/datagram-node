const debug = require('../utils/debug')(__filename)
const writeStringToStorage = require("../utils/storage").writeStringToStorage

/**
 * Creates a new core where you can write to
 *
 * @public
 * @todo should be able to pass own core
 * @param {string} name core name
 * @param {function} cb callback(err, core, core_index_number)
 */
exports.add_core = function (name, cb) {
  // Supports calls without a speficied name
  if (typeof name === "function" && !cb) {
    cb = name
    name = undefined
  }
  let self = this

  this.ready(function () {
    // Short-circuit if already loaded
    if (self._cores[name]) {
      process.nextTick(cb, null, self._cores[name])
      return
    }

    debug("[CORE] creating new core: " + name)

    // core lock enforces execution order and helps to avoid
    // race conditions and other timing problems
    self.coreLock(function (release) {
      // How many cores do we have in storage?
      let len = Object.keys(self._cores).length

      // Create a new storage instance for the new core
      // and give it the next available slot number
      let storage = self._open_storage("" + len)

      // If name wasn't provided, use the slot number as a name
      let idx = name || String(len)

      // Create or open localname storage to make a note the core name
      let nameStore = storage("localname")
      writeStringToStorage(idx, nameStore, function (err) {
        if (err) {
          release(function () {
            cb(err)
          })
          return
        }

        // Create hypercore for new core
        let core = self._hypercore(storage, self._opts)

        // Finalize new core and wait until its done
        core.ready(function () {
          // Add new core to this hypervisor
          self._add_core_to_meta(core, String(idx))

          // Everything is done so release the core lock and pass on
          // the new core and its name
          release(function () {
            if (err) return cb(err)
            else cb(null, core, idx)
          })
        })
      })
    })
  })
}

/**
 * Adds a new core to the core list and key to core key list
 *
 * @private
 * @param {HypercoreFeed} core
 * @param {string} name
 */
exports._add_core_to_meta = function (core, name) {
  // List by name
  this._cores[name] = core

  // List by hex string key
  this._coreKeyToCore[core.key.toString("hex")] = core

  // Tell everybody interested that there's a new core available
  this.emit("core", core, name)
}