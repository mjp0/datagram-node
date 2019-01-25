const debug = require('../utils/debug')(__filename)
const readStringFromStorage = require("../utils/storage").readStringFromStorage

/**
 * Finds all previously stored cores and adds them to this hypervisor
 *
 * @private
 * @param {Function} cb callback() is called when all cores are loaded
 */
module.exports = function (cb) {
  let self = this

  // Hypercores are stored starting at 0 and incrementing by 1. A failed read
  // at position 0 implies non-existance of the hypercore.
  function getNextFeed(n) {
    debug("[INIT] loading core #" + n)

    // Try to open a new storage at slot N
    let storage = self._open_storage("" + n)

    // Create or open storage item "key"
    let st = storage("key")

    // Read first 4 bytes
    st.read(0, 4, function (err, bytes) {
      // If there's an error, it's empty which means that it does not exist
      // and that we are at the end of the core list
      if (err) {
        return cb()
      }

      // Check if core has been removed
      let head = bytes.toString()
      if (head === "REMV") {
        getNextFeed(n + 1)
        return
      }

      // Since "key" exists, this is a hypercore and we shall initialize it
      let core = self._hypercore(storage, self._opts)

      // After core is ready
      core.ready(function () {
        // If core has a special name, it should be found under "localname"
        readStringFromStorage(storage("localname"), function (err, name) {
          if (!err && name) {
            // Name found, adding core with name
            self._add_core_to_meta(core, name)
          } else {
            // Name not found, adding core with slot number as a name
            self._add_core_to_meta(core, String(n))
          }

          // Calculate the next slot number and run this function again
          getNextFeed(n + 1)
        })
      })
    })
  }
  this.updateIgnoreList(() => {
    getNextFeed(0)
  })
}