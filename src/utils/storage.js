const { log } = require('./debug')(__filename)
const raf = require('random-access-file')
const ram = require('random-access-memory')
const path = require('path')
const home = require('home')

// TODO: what if the new data is shorter than the old data? things will break!
exports.writeStringToStorage = function(string, storage, cb) {
  const buf = Buffer.from(string, 'utf8')
  storage.write(0, buf, cb)
}

exports.readStringFromStorage = function(storage, cb) {
  // This is here due some weird API inconsistences with raf and ram
  if (!storage.stat) {
    storage.stat = function(callback) {
      callback(null, { size: this.length })
    }
  }
  storage.stat(function(err, stat) {
    if (err) return cb(err)
    const len = stat.size
    storage.read(0, len, function(err, buf) {
      if (err) return cb(err)
      const str = buf.toString()
      cb(null, str)
    })
  })
}

exports.readFromStorage = (storage, cb) => {
  // This is here due some weird API inconsistences with raf and ram
  if (!storage.stat) {
    storage.stat = function (callback) {
      callback(null, { size: this.length })
    }
  }
  storage.stat(function (err, stat) {
    if (err) return cb(err)
    const len = stat.size
    storage.read(0, len, function (err, buf) {
      if (err) return cb(err)
      cb(null, buf)
    })
  })
}

exports._open_storage = function(dir, storage) {
  return function(name) {
    // If no storage was provided, use RAM
    const s = storage || ram
    name = name || '.datagram'
    if (typeof storage === 'string') {
      const fname = path.join(storage, dir, name)
      if (process.env['VERBOSE']) log('Opening FS storage', fname)
      return raf(fname)
    } else {
      if (process.env['VERBOSE']) log('Opening RAM storage', name)
      return s(dir + '/' + name)
    }
  }
}

exports.defaultStorage = (path, dir) => {
  const base = path || `${home()}/.datagram/}`
  const d = Buffer.isBuffer(dir) ? dir.toString('hex') : dir
  return exports._open_storage(d, base)
}
