const descriptors = require('../../descriptors')

exports.base = (stream) => {
  const API = {
    get: async (package_number) => {
      return new Promise(async (done, error) => {
        if (!stream.readable) return error(new Error('STREAM_NOT_READABLE'))
        stream.get(package_number, { wait: true }, (err, pkg) => {
          if (err) return error(err)
          return done(pkg)
        })
      })
    },
    getBatch: async (package_number1, package_number2) => {
      return new Promise(async (done, error) => {
        if (!stream.readable) return error(new Error('STREAM_NOT_READABLE'))
        stream.get(package_number1, package_number2, { wait: true }, (err, pkgs) => {
          if (err) return error(err)
          return done(pkgs)
        })
      })
    },
    add: async (pkg) => {
      return new Promise(async (done, error) => {
        if (!stream.writable) return error(new Error('STREAM_NOT_WRITABLE'))
        if (!Buffer.isBuffer(pkg)) return error(new Error('PACKAGE_NOT_BUFFER'))
        stream.append(pkg, (err, ok) => {
          if (err) return error(err)
          return done(ok)
        })
      })
    },
    getDownloadProgress: async (package_number1, package_number2) => {
      return new Promise(async (done, error) => {
        stream.downloaded(package_number1, package_number2, { wait: true }, (err, pkgs) => {
          if (err) return error(err)
          return done(pkgs)
        })
      })
    },
    isAvailableLocally: async (package_number1, package_number2) => {
      return new Promise(async (done, error) => {
        stream.has(package_number1, package_number2, (err, has) => {
          if (err) return error(err)
          return done(has)
        })
      })
    },
    clearLocalCache: async (package_number1, package_number2) => {
      return new Promise(async (done, error) => {
        stream.clear(package_number1, package_number2, (err, ok) => {
          if (err) return error(err)
          return done(ok)
        })
      })
    },
    runWhenUpdated: async () => {
      return new Promise(async (done, error) => {
        stream.update((err) => {
          if (err) return error(err)
          API.get(stream.length, (err, pkg) => {
            done(err, pkg)
          })
        })
      })
    },
    abortDownload: async (package_number1, package_number2) => {
      return new Promise(async (done) => {
        stream.undownload({ start: package_number1, end: package_number2 })
        done()
      })
    },
    readStream: async (package_number1, package_number2) => {
      if (!stream.readable) return new Error('STREAM_NOT_READABLE')
      const opts = {
        start: package_number1 || 0, // read from this index
        end: package_number2 || stream.length, // read until this index
        snapshot: true, // if set to false it will update `end` to `feed.length` on every read
        timeout: 0, // timeout for each data event (0 means no timeout)
        wait: true, // wait for data to be downloaded
      }
      return stream.createReadStream(opts)
    },
    tail: async (start_package_number) => {
      if (!stream.readable) return new Error('STREAM_NOT_READABLE')

      const opts = {
        start: start_package_number || 0, // read from this index
        end: stream.length, // read until this index
        snapshot: false, // if set to false it will update `end` to `feed.length` on every read
        tail: true, // sets `start` to `feed.length`
        live: true, // set to true to keep reading forever
        timeout: 0, // timeout for each data event (0 means no timeout)
        wait: true, // wait for data to be downloaded
      }
      return stream.createReadStream(opts)
    },
    writeStream: async () => {
      if (!stream.writable) return new Error('STREAM_NOT_WRITABLE')

      return stream.createWriteStream()
    },
    replicate: async (opts) => {
      return stream.replicate(opts)
    },
    verifyData: async () => {
      return new Promise(async (done, error) => {
        return stream.audit((err, ok) => {
          if (err) return error(err)
          return done(ok)
        })
      })
    },
    close: async () => {
      return new Promise(async (done, error) => {
        return stream.close((err, ok) => {
          if (err) return error(err)
          return done(ok)
        })
      })
    },
    getStats: async () => {
      return {
        blocks: stream.length,
        bytes: stream.byteLength,
      }
    },
    getKeys: async () => {
      return {
        key: stream.key,
        secret: stream.secretKey,
        discovery: stream.discoveryKey,
      }
    },
    getDefinition: async () => {
      return new Promise(async (done, error) => {
        const packed_definition = await API.get(0).catch(error)
        const definition = await descriptors.read(packed_definition).catch(error)
        done(definition)
      })
    },
  }
  return API
}
