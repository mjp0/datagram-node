const debug = require('./debug')(__filename)
const raf = require('random-access-file')
const ram = require('random-access-memory')
const path = require('path')

// TODO: what if the new data is shorter than the old data? things will break!
exports.writeStringToStorage = function(string, storage, cb) {
  let buf = Buffer.from(string, 'utf8')
  storage.write(0, buf, cb)
}

exports.readStringFromStorage = function(storage, cb) {
  // This is here due some weird API inconsistences with raf and ram
  if (!storage.stat) {
    storage.stat = function(callback) {
      callback(callback, null, { size: this.length })
    }
  }
  storage.stat(function(err, stat) {
    if (err) return cb(err)
    let len = stat.size
    storage.read(0, len, function(err, buf) {
      if (err) return cb(err)
      let str = buf.toString()
      cb(null, str)
    })
  })
}

exports._open_storage = function(dir, storage) {
  return function(name) {
    // If no storage was provided, use RAM
    let s = storage || ram
    if (typeof storage === 'string') {
      const fname = path.join(storage, dir, name)
      debug('Opening FS storage', fname)
      return raf(fname)
    } else {
      debug('Opening RAM storage', name)
      return s(dir + '/' + name)
    }
  }
}
