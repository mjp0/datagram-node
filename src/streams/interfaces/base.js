const descriptors = require('../../descriptors')
const { errors, encryptData, decryptData } = require('../../utils')

exports.base = function(stream_reference) {
  const stream = stream_reference
  const API = {
    '@id': 'base',
    get: async (package_number) => {
      return new Promise(async (done, error) => {
        if (!stream.readable) return error(new Error('STREAM_NOT_READABLE'))
        if (!stream.password) return error(new Error('STREAM_PASSWORD_NOT_AVAILABLE'))

        stream.get(package_number, { wait: true }, async (err, stored_pkg) => {
          if (err) return error(err)

          // extract the nonce
          const nonce = stored_pkg.slice(0, 24).toString('hex')
          const encrypted_pkg = stored_pkg.slice(24)

          // decrypt pkg
          const pkg = await decryptData({ data: encrypted_pkg, key: stream.password, nonce }).catch(error)

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
    add: async (pkg, descriptor) => {
      return new Promise(async (done, error) => {
        // if (!descriptor) return error(new Error('DESCRIPTOR_NOT_PROVIDED'))
        if (!stream.writable) return error(new Error('STREAM_NOT_WRITABLE'))
        if (!Buffer.isBuffer(pkg)) return error(new Error('PACKAGE_NOT_BUFFER'))
        if (!stream.password) return error(new Error('STREAM_PASSWORD_NOT_AVAILABLE'))

        // encrypt pkg
        const encrypted_pkg = await encryptData({ data: pkg, key: stream.password }).catch(error)
        if (!encrypted_pkg) return error(new Error('ENCRYPTED_PKG_MISSING'))

        // Combine nonce and encrypted_data
        const nonce = Buffer.from(encrypted_pkg.password.split('|')[1], 'hex')
        const finalized_pkg = Buffer.concat([ nonce, encrypted_pkg.encrypted_data ])

        stream.append(finalized_pkg, async (err, position) => {
          if (err) return error(err)
          if (typeof API.index === 'object' && descriptor) {
            if (typeof API.index.indexer.addRow === 'function') {
              await API.index.indexer.addRow(descriptor).catch(error)
            } else {
              return error(new Error(errors.BAD_INDEX), { index: API.index })
            }
          }
          return done(position)
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
      return new Promise(async (done, error) => {
        done(stream.replicate(opts))
      })
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
    getTemplate: async () => {
      return new Promise(async (done, error) => {
        const packed_template = await API.get(0).catch(error)
        const template = await descriptors.read(packed_template).catch(error)
        done(template)
      })
    },
    addInterface: async (iface) => {
      return new Promise(async (done, error) => {
        // Do some checking to make sure everything is as it should
        if (typeof iface !== 'object') {
          console.log(iface)
          return error(new Error('NOT_AN_INTERFACE'), { iface })
        }
        if (!iface['@id']) return error(new Error('@ID_MISSING'))
        if (API.hasOwnProperty(iface['@id'])) return error(new Error('INTERFACE_EXISTS'), { '@id': iface['@id'] })

        // Reserve namespace
        API[iface['@id']] = {}

        // Apply the methods
        for (const method in iface) {
          if (iface.hasOwnProperty(method)) {
            if (!method.match(/@/)) {
              if (typeof iface[method] !== 'function') {
                return error(new Error('INTERFACE_METHOD_MUST_BE_FUNCTION'), { method })
              }
              API[iface['@id']][method] = iface[method](API, stream)
            }
          }
        }
        done(API)
      })
    },
    getOwner: async () => {
      return new Promise(async (done, error) => {
        done(stream_reference.user_id || null)
      })
    },
    getPassword: async () => {
      return new Promise(async (done, error) => {
        done(stream_reference.password || null)
      })
    },
  }
  return API
}
