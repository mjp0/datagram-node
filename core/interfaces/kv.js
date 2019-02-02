const debug = require('../../utils/debug')(__filename)
const async = require('async')

exports.kv = {
  '@id': 'kv',
  set: (API, stream) => {
    return async (key, value) => {
      return new Promise(async (done, error) => {
        // add +|key|value to the stream
        // + is for action type so we can add delete later
        const val = Buffer.from(`+|${key.toString()}|${JSON.stringify(value)}`)
        const position = await API.add(val).catch(error)
        done(position)
      })
    }
  },
  get: (API, stream) => {
    return async (key) => {
      return new Promise(async (done, error) => {
        // Super hacky way to deal with a callback race condition
        // I couldn't find nor fix - you are welcome to fix this...
        let delivery_lock = false
        function deliver(err = null, value) {
          if (!delivery_lock) {
            delivery_lock = true
            if (err) return error(err)
            done(value)
          }
        }
        // fetch key from hyperstream
        if (stream.length > 0) {
          const packet_count = stream.length

          // Reverse through the packets in stream
          for (let i = packet_count - 1; i >= 1; i--) {
            const buffer = await API.get(i).catch((err) => {
              return deliver(err)
            })

            // Turn content back to string
            const content = buffer.toString()

            // If it's a string, try to parse it
            if (typeof content === 'string' && content.length > 0) {
              // We split with | and we should get 3 values if everything's cool
              const content_obj = content.split('|')
              if (content_obj.length >= 2 && content_obj[1] === key) {
                // If we find the key with + type, we pick that and stop the search
                if (content_obj[0] === '+') {
                  try {
                    let value = null

                    // Make sure that it's not empty
                    if (content_obj[2].length > 0) {
                      value = JSON.parse(content_obj[2])
                    }
                    deliver(null, value)
                    return
                  } catch (e) {
                    debug('[ERROR]', 'error in json parsing', e)
                    deliver('ERROR_PARSING_JSON')
                  }
                } else if (content_obj[0] === '-') {
                  // If we find the key with - type, it's deleted and we stop the search
                  deliver()
                } else {
                  debug('[ERROR]', 'this state should not happen', content)
                  deliver('BAD_CONTENT')
                }
              }
            }
          }
        } else {
          // stream is empty so there's nothing available yet
          deliver()
        }
      })
    }
  },
  getAllKeys: (API, stream) => {
    return async () => {
      return new Promise(async (done, error) => {
        // fetch key from hyperstream
        if (stream.length > 0) {
          const keys = {}
          const packet_count = stream.length

          // Fetch all packages except core definition
          const packages = []
          for (let pos = 1; pos < packet_count; pos++) {
            packages.push(await API.get(pos).catch(error))
          }
          await Promise.all(packages)

          // Create index of all keys and the last action associated with them
          async.forEach(
            packages,
            (buffer, packet_done) => {
              // Turn content back to string
              const content = buffer.toString()

              // If it's a string, try to parse it
              if (typeof content === 'string' && content.length > 0) {
                // We split with | and we should get 3 values if everything's cool
                const content_obj = content.split('|')
                if (content_obj.length === 3) {
                  // If we find the key with + type, add it to keys with +
                  if (content_obj[0] === '+') {
                    keys[content_obj[1]] = '+'
                  }
                  // If we find the key with - type, add it to keys with +
                  if (content_obj[0] === '-') {
                    keys[content_obj[1]] = '-'
                  }
                  packet_done()
                } else {
                  debug('[ERROR]', "content doesn't split correctly", content)
                  packet_done('BAD_CONTENT')
                }
              } else {
                packet_done('BAD_CONTENT')
              }
            },
            (err) => {
              if (err) return error(err)
              // Filter out all keys that have - as their action because they are deleted
              const existing_keys = []
              for (const key in keys) {
                if (keys.hasOwnProperty(key) && keys[key] === '+') {
                  existing_keys.push(key)
                }
              }
              done(existing_keys)
            },
          )
        } else {
          // stream is empty so there's nothing available yet
          done([])
        }
      })
    }
  },
  rem: (API, stream) => {
    return async (key) => {
      return new Promise(async (done, error) => {
        // add -|key to hyperstream
        // - is for action type so we can add delete later
        const res = await API.add(Buffer.from(`-|${key.toString()}|`)).catch(error)
        done(res)

        // TODO: Find block ids for previous entries and delete local data for those
      })
    }
  },
}
