const debug = require('../utils/debug')(__filename)
const writeStringToStorage = require('../utils/storage').writeStringToStorage
const readStringFromStorage = require('../utils/storage').readStringFromStorage
const path = require('path')
const fs = require('fs-extra')

exports.remove_core = function(key) {
  const self = this
  // Get core
  const core = this._coreKeyToCore[key]

  // Loop through _cores to find the right one and mark it REMOVED
  // then update storage as well
  const core_names = Object.keys(this._cores)
  function _getNextFeed(cb) {
    const idx = core_names.pop()
    if (idx) {
      if (self._cores[idx].key.toString('hex') === key) {
        // Fetch the storage slot for the core
        const storage = self._open_storage('' + idx)
        const st = storage('key')

        // Remove files if random-access-file is used
        if (self._storage_path) {
          debug('path', path.join(self._storage_path, idx))
          fs.removeSync(path.join(self._storage_path, idx))
        }

        // Mark it REMOVED
        writeStringToStorage('REMV', st, (err) => {
          if (err) throw err
          self._cores[idx] = 'REMOVED'

          self._add_to_ignore_list(key, () => {
            _getNextFeed(cb)
          })
        })
      } else _getNextFeed(cb)
    } else {
      cb()
    }
  }
  _getNextFeed(() => {
    // debug(this._cores, this._coreKeyToCore, core)

    // Remove from hex string key list
    delete this._coreKeyToCore[core.key.toString('hex')]

    // Clean the core
    core.clear(0, core.length)

    // Remove from name list
    delete this._cores[key]

    // Tell everybody interested that there's core was removed available
    this.emit('core_removed', key)
  })
}

exports._add_to_ignore_list = function(key, cb) {
  const self = this
  // Add it to IGNORELIST
  const storage = self._open_storage('IGNORELIST')
  const ignorelist = storage('ignorelist')
  readStringFromStorage(ignorelist, (err, list) => {
    // Ignore list doesn't exist yet
    if (err || !list) list = `${key}|`
    else {
      self._ignoreList = list.split('|')
      if (self._ignoreList.indexOf(key) === -1) {
        // Add key to the ignorelist
        self._ignoreList.push(key)
        list += `${key}|`
      }
    }
    debug('[IGNORELIST]', `Added ${key} to the list `)
    writeStringToStorage(list, ignorelist, (err) => {
      if (err) return cb(err)
      else if (typeof cb === 'function') cb()
    })
  })
}
