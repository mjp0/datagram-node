const debug = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const _open_storage = require('../utils/storage')._open_storage
const crypto = require('hypercore-crypto')

exports.createNewCore = function(
  args = { definition: null, storage: null },
  opts = { keys: { key: null, secret: null } },
  callback,
) {
  const { definition, storage, keys } = { ...args, ...opts }

  opts.valueEncoding = 'binary' // Binary encoding is enforced

  // Make sure we have the definition
  if (!definition) throw new Error('DEFINITION_REQUIRED')

  // If this is meta core, use generated keys
  if (definition && definition.id === 'meta') {
    if (typeof keys !== 'object') return callback(new Error('META_REQUIRES_KEYS'))
    opts.key = Buffer.from(keys.key, 'hex')
    opts.secretKey = Buffer.from(keys.secret, 'hex')
  } else if (keys) {
    opts.key = Buffer.from(keys.key, 'hex')
    opts.secretKey = keys.secret ? Buffer.from(keys.secret, 'hex') : null // secret is not required
  } else {
    const keyPair = crypto.keyPair()
    opts.key = keyPair.publicKey
    opts.secretKey = keyPair.secretKey
  }

  debug('Creating new core', opts.key.toString('hex'), definition.id)

  const store = _open_storage(opts.key.toString('hex'), storage)

  const stream = hypercore(store, opts)
  stream.ready((err) => {
    if (err) return callback(err)

    // Generate the core around the data stream
    const Core = generateCoreAPI(stream)
    return callback(err, Core)
  })
}

function generateCoreAPI(stream) {
  const API = {
    get: () => {
      return (package_number, callback) => {
        if (!stream.readable) return callback(new Error('STREAM_NOT_READABLE'))
        stream.get(package_number, { wait: true }, callback)
      }
    },
    getBatch: () => {
      return (package_number1, package_number2, callback) => {
        if (!stream.readable) return callback(new Error('STREAM_NOT_READABLE'))
        stream.get(package_number1, package_number2, { wait: true }, callback)
      }
    },
    add: () => {
      return (pkg, callback) => {
        if (!stream.writable) return callback(new Error('STREAM_NOT_WRITABLE'))
        stream.append(pkg, callback)
      }
    },
    getDownloadProgress: () => {
      return (package_number1, package_number2, callback) => {
        stream.downloaded(package_number1, package_number2, { wait: true }, callback)
      }
    },
    isAvailableLocally: () => {
      return (package_number1, package_number2, callback) => {
        stream.has(package_number1, package_number2, callback)
      }
    },
    clearLocalCache: () => {
      return (package_number1, package_number2, callback) => {
        stream.clear(package_number1, package_number2, callback)
      }
    },
    runWhenUpdated: () => {
      return (callback) => {
        stream.update((err) => {
          if (err) return callback(err)
          API.get(stream.length, (err, pkg) => {
            callback(err, pkg)
          })
        })
      }
    },
    abortDownload: () => {
      return (package_number1, package_number2) => {
        return stream.undownload({ start: package_number1, end: package_number2 })
      }
    },
    readStream: () => {
      return (package_number1, package_number2) => {
        if (!stream.readable) return new Error('STREAM_NOT_READABLE')
        const opts = {
          start: package_number1 || 0, // read from this index
          end: package_number2 || stream.length, // read until this index
          snapshot: true, // if set to false it will update `end` to `feed.length` on every read
          timeout: 0, // timeout for each data event (0 means no timeout)
          wait: true, // wait for data to be downloaded
        }
        return stream.createReadStream(opts)
      }
    },
    tail: () => {
      return (start_package_number) => {
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
      }
    },
    writeStream: () => {
      return () => {
        if (!stream.writable) return new Error('STREAM_NOT_WRITABLE')

        return stream.createWriteStream()
      }
    },
    replicate: () => {
      return (opts) => {
        return stream.replicate(opts)
      }
    },
    verifyData: () => {
      return (callback) => {
        return stream.audit(callback)
      }
    },
    close: () => {
      return (callback) => {
        return stream.close(callback)
      }
    },
    getStats: () => {
      return () => {
        return {
          blocks: stream.length,
          bytes: stream.byteLength,
        }
      }
    },
    getKey: () => {
      return () => {
        return stream.key
      }
    },
    getDiscoveryKey: () => {
      return () => {
        return stream.discoveryKey
      }
    },
  }
  return API
}
