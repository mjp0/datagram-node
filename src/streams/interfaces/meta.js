const async = require('async')

exports.meta = (() => {
  // State
  let stream_references = {}

  return {
    '@depends_on': [ 'redis' ],
    '@id': 'meta',
    addStream: (API, stream) => {
      return async (stream) => {
        return new Promise(async (done, error) => {
          // Get template from the stream to-be-added
          const template = await stream.getTemplate().catch(error) // Create a reference to initialized hyperstream

          await API.meta.addStreamReference(template.DatagramKey, stream).catch(error) // Add stream details to the meta stream

          await API.meta.addStreamDetails(template.DatagramKey, template).catch(error)
          done()
        })
      }
    },
    addStreamDetails: (API, stream) => {
      return async (key, template) => {
        return new Promise(async (done, error) => {
          // load blocklist and verify key is not there
          // create details:key={name, key, type}
          await API.redis.set(`details:${key}`, template).catch(error)
          done()
        })
      }
    },
    addStreamReference: (API, stream) => {
      return async (reference, stream) => {
        return new Promise(async (done, error) => {
          stream_references[reference] = stream
          done(stream)
        })
      }
    },
    attachStream: (API, stream) => {
      return async (stream) => {
        return new Promise(async (done, error) => {
          // Get template from the stream to-be-added
          const template = await stream.getTemplate().catch(error) // Create a reference to initialized hyperstream

          await API.meta.addStreamReference(template.DatagramKey, stream).catch(error)
          done()
        })
      }
    },
    close: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          stream_references = {}
          // stream.close()
          API = null
          done()
        })
      }
    },
    exportLegacy: (API, stream) => {
      return function(callback) {
        // first get all the stream keys
        exports.meta.getAllStreamDetails((err, streams) => {
          if (err) return callback(err)
          const _streams = {}
          const _streamKeyToStream = {}
          streams.forEach((c) => {
            _streams[c.name] = stream_references[c.DatagramKey]
            _streamKeyToStream[c.DatagramKey] = stream_references[c.DatagramKey]
          })
          callback(null, {
            _streams,
            _streamKeyToStream,
          })
        })
      }
    },
    getAllStreamDetails: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          // Get all the keys in the meta
          const keys = await API.redis.getAllKeys().catch(error)

          // reject everything that doesn't start with "details:"
          const streams_keys = keys.filter((key) => {
            return key.match(/^details:/)
          }) // Let's expand each stream key

          const stream_details = []
          const kv_fetches = []
          streams_keys.forEach((stream_key) => {
            kv_fetches.push(
              new Promise(async (key_done, key_error) => {
                const value = await API.redis.get(stream_key).catch(key_error)

                if (value) {
                  stream_details.push(value)
                }

                key_done()
              }),
            )
          })
          await Promise.all(kv_fetches)
          done(stream_details)
        })
      }
    },
    getAllStreams: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          const stream_details = await API.meta.getAllStreamDetails().catch(error)
          const streams = []
          async.forEach(
            stream_details,
            (cd, stream_done) => {
              if (stream_references[cd.DatagramKey]) {
                streams.push(stream_references[cd.DatagramKey])
              }

              stream_done()
            },
            (err) => {
              if (err) return error(err)
              done(streams)
            },
          )
        })
      }
    },
    getAllUnopenedStreams: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          const all_stream_details = await API.meta.getAllStreamDetails().catch(error)
          const unopened_streams = all_stream_details.filter((c) => {
            if (typeof stream_references[c.DatagramKey] === 'undefined') return true
          })
          done(unopened_streams)
        })
      }
    },
    getBlocklist: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          const keys = await API.redis.getAllKeys().catch(error) // reject everything that doesn't start with "blocked:"

          const blocked_keys = keys
            .filter((key) => {
              return key.match(/^blocked:/)
            })
            .map((bkeys) => bkeys.replace('blocked:', ''))
          done(blocked_keys)
        })
      }
    },
    getStreamReferences: (API, stream) => {
      return async () => {
        return new Promise(async (done, error) => {
          done(stream_references)
        })
      }
    },
    loadStreamsFromStorage: (API, stream) => {
      return function(keys, callback) {
        // Make keys optional
        if (typeof keys === 'function' && !callback) {
          callback = keys
        } // find all keys

        exports.meta.getAllStreamDetails((err, streams) => {
          if (err) return callback(err) // TODO: Move initialization to Container
          // initialize streams
          // async.forEach(
          //   streams,
          //   (uninitd_stream, stream_done) => {
          //     load({ key: uninitd_stream.meta.key }, exports.meta.default_storage, (err, initd_stream) => {
          //       if (err) return stream_done(err)
          //       else if (initd_stream && initd_stream.meta.key) {
          //         exports.meta.addStreamReference(uninitd_stream.meta.key.toString('hex'), initd_stream)
          //         return stream_done()
          //       } else {
          //         return stream_done()
          //       }
          //     })
          //   },
          //   callback,
          // )
        }) // return { key: stream }
      }
    },
    removeStream: (API, stream) => {
      return async (key) => {
        return new Promise(async (done, error) => {
          // remove details:key
          await API.redis.rem(`details:${key}`).catch(error)
          await API.meta.removeStreamReference(key).catch(error) // addToBlocklist(key)

          await API.redis.set(`blocked:${key}`, new Date().getTime()).catch(error)
          done()
        })
      }
    },
    removeStreamReference: (API, stream) => {
      return async (reference) => {
        return new Promise(async (done, error) => {
          if (!stream_references) return done()
          delete stream_references[reference]
          done()
        })
      }
    },
  }
})()
