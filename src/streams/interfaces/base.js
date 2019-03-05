const descriptors = require('../../descriptors')
const { getNested, hash, errors, encryptData, decryptData, signData, verifySignature } = require('../../utils')
const msgpack = require('msgpack5')()
const network = require('@hyperswarm/network')

async function getNetwork(args) {
  return new Promise(async (done, error) => {
    const bootstrap = getNested(args, 'odi') || [
      'server1.datagram.network:10000',
      'server1.datagram.network:10001',
      'server1.datagram.network:10002',
    ]
    const nwrk = network({ bootstrap })
    done(nwrk)
  })
}

exports.base = function(stream_reference) {
  let stream = stream_reference
  const API = {
    '@id': 'base',
    get: async (package_number) => {
      return new Promise(async (done, error) => {
        // if (!stream.readable) return error(new Error('STREAM_NOT_READABLE'))
        if (!stream.encryption_password) return error(new Error('ENCRYPTION_PASSWORD_MISSING'))
        if (!stream.user_id) return error(new Error('STREAM_USER_ID_MISSING'))

        stream.get(package_number, async (err, stored_pkgs) => {
          if (err) return error(err)

          if (!stored_pkgs || stored_pkgs.length === 0 || !stored_pkgs[0].value) {
            return done(null)
          }
          // open the package
          const opened_pkg = msgpack.decode(stored_pkgs[0].value)

          // verify the signature if present
          if (opened_pkg.signature && opened_pkg.user_id) {
            const is_valid = await verifySignature({
              signature: opened_pkg.signature,
              data: opened_pkg.data,
              key: stream.user_id,
            }).catch(error)
            if (!is_valid) return error(new Error('SIGNATURE_VERIFICATION_FAIL'), { opened_pkg })
          }

          // extract the nonce
          const nonce = opened_pkg.data.slice(0, 24).toString('hex')
          const encrypted_pkg = opened_pkg.data.slice(24)
          // decrypt pkg
          const pkg = await decryptData({ data: encrypted_pkg, key: stream.encryption_password, nonce }).catch(error)

          return done(pkg)
        })
      })
    },
    getBatch: async (package_number1, package_number2) => {
      return new Promise(async (done, error) => {
        if (!stream.readable) return error(new Error('STREAM_NOT_READABLE'))
        stream.get(package_number1, package_number2, (err, pkgs) => {
          if (err) return error(err)
          return done(pkgs)
        })
      })
    },
    add: async (pkg, descriptor) => {
      return new Promise(async (done, error) => {
        // if (!descriptor) return error(new Error('DESCRIPTOR_NOT_PROVIDED'))
        // if (!stream.writable) return error(new Error('STREAM_NOT_WRITABLE'))
        if (!Buffer.isBuffer(pkg)) return error(new Error('PACKAGE_NOT_BUFFER'))
        if (!stream.encryption_password) return error(new Error('ENCRYPTION_PASSWORD_MISSING'))

        // encrypt pkg
        const encrypted_pkg = await encryptData({ data: pkg, key: stream.encryption_password }).catch(error)
        if (!encrypted_pkg) return error(new Error('ENCRYPTED_PKG_MISSING'))
        // Separate nonce
        const nonce = Buffer.from(encrypted_pkg.password.split('|')[1], 'hex')
        if (nonce.length !== 24) return error(new Error('BAD_NONCE'), { nonce })

        // Create final package and sign
        let finalized_pkg = {
          data: Buffer.concat([ nonce, encrypted_pkg.encrypted_data ]),
          user_id: stream.user_id,
          signature: null,
        }

        finalized_pkg.signature = await signData({ data: finalized_pkg.data, key: stream.user_password }).catch(error)

        finalized_pkg = msgpack.encode(finalized_pkg)

        let position = null
        if (getNested(descriptor, 'arguments.key')) {
          position = descriptor.arguments.key
        } else {
          position = await hash({ data: finalized_pkg }).catch(error)
        }
        stream.put(position, finalized_pkg, async (err, saved_position) => {
          if (err) return error(err)

          // Check that value was indeed saved
          stream.get(saved_position.key, async (err, stored_finalized_pkgs) => {
            if (err) return error(err)
            if (!stored_finalized_pkgs || stored_finalized_pkgs.length === 0 || !stored_finalized_pkgs[0].value) {
              return error(new Error('STORED_DATA_MISSING'))
            } else if (finalized_pkg.compare(stored_finalized_pkgs[0].value) === 0) {
              if (typeof API.index === 'object' && descriptor) {
                if (typeof API.index.indexer.addRow === 'function') {
                  await API.index.indexer.addRow(descriptor).catch(error)
                } else {
                  return error(new Error(errors.BAD_INDEX), { index: API.index })
                }
              }
              return done(saved_position.key)
            } else {
              return error(new Error('STORED_DATA_MISSING'))
            }
          })
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
    authorize: async (opts = { key: null }) => {
      const key = Buffer.isBuffer(opts.key) ? opts.key : Buffer.from(opts.key, 'hex')
      return new Promise(async (done, error) => {
        stream.authorize(key, (err) => {
          if (err) return error(err)
          done()
        })
      })
    },
    isAuthorized: async (opts = { key: null }) => {
      const key = Buffer.isBuffer(opts.key) ? opts.key : Buffer.from(opts.key, 'hex')
      return new Promise(async (done, error) => {
        stream.authorized(key, (err, is_valid) => {
          if (err) return error(err)
          else if (is_valid === true) done(true)
          else done(false)
        })
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
        stream = null
        return done(true)
      })
    },
    getStats: async () => {
      return {
        blocks: stream.length,
        bytes: stream.byteLength,
      }
    },
    getKeys: async () => {
      return new Promise(async (done, error) => {
        const address = await API.getAddress().catch(error)
        done({
          read: stream.key,
          write: stream.secretKey,
          address,
        })
      })
    },
    getAddress: async (callback) => {
      return new Promise(async (done, error) => {
        done(
          await hash({
            data: stream.key.toString('hex'),
          }).catch(error),
        )
      })
    },
    getTemplate: async () => {
      return new Promise(async (done, error) => {
        const packed_template = await API.get('_template').catch(error)
        if (!packed_template) return error(new Error('NO_TEMPLATE_FOUND'))

        const template = await descriptors.read(packed_template).catch(error)
        done(template)
      })
    },
    addInterface: async (iface) => {
      return new Promise(async (done, error) => {
        // Do some checking to make sure everything is as it should
        if (typeof iface !== 'object') {
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
    getUserId: async () => {
      return new Promise(async (done, error) => {
        done(stream_reference.user_id || null)
      })
    },
    getUserPassword: async () => {
      return new Promise(async (done, error) => {
        done(stream_reference.user_password || null)
      })
    },
    publish: async (args = { realtime: false, odi: false }, callback) => {
      return new Promise(async (done, error) => {
        stream.net = await getNetwork(args)
        stream.net.discovery.holepunchable(async (err, is_valid) => {
          if (err || !is_valid) return error(new Error('NO_CONNECTIVITY'))

          const topic = Buffer.from(await API.getAddress().catch(error), 'hex')
          // console.log('p', topic)
          stream.net.join(topic, {
            lookup: true, // find & connect to peers
            announce: true, // optional- announce self as a connection target
          })

          stream.net.on('connection', async (socket, details) => {
            // console.log('got connection (publish)', socket)
            const _replication_stream = await stream.replicate({ live: getNested(args, 'realtime') || false })
            _replication_stream.pipe(socket).pipe(_replication_stream)
            stream._replication_stream = _replication_stream
          })
          done()
        })
      })
    },
    connect: async (args = { address: null, realtime: false, odi: false}, callback) => {
      return new Promise(async (done, error) => {
        stream.net = await getNetwork(args)
        stream.net.discovery.holepunchable(async (err, is_valid) => {
          if (err || !is_valid) return error(new Error('NO_CONNECTIVITY'))

          const topic = Buffer.from(args.address, 'hex')
          // console.log('c', topic)
          stream.net.join(topic, {
            lookup: true, // find & connect to peers
            announce: false, // optional- announce self as a connection target
          })

          stream.net.on('connection', async (socket, details) => {
            // console.log('connection (connect)', socket)
            const _replication_stream = await stream.replicate({ live: getNested(args, 'realtime') || false })
            _replication_stream.pipe(socket).pipe(_replication_stream)
            stream._replication_stream = _replication_stream
          })
          done()
        })
      })
    },
    disconnect: async (callback) => {
      return new Promise(async (done, error) => {
        if (stream.net && stream.net._topics.size > 0) {
          stream.net._topics.forEach((topic) => {
            if (topic.key) {
              stream.net.leave(topic.key)
            }
          })
        }
        if (stream._replication_stream) {
          stream._replication_stream.end()
        }
        done()
      })
    },
  }
  return API
}
