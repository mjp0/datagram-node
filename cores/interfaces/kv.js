const debug = require('../../utils/debug')(__filename)
const async = require('async')

module.exports = {
  set_kv: function(core) {
    return function(key, value, callback) {
      // add +|key|value to hypercore
      // + is for action type so we can add delete later
      core.append(Buffer.from(`+|${key.toString()}|${JSON.stringify(value)}`), callback)
    }
  },
  get_kv: function(core) {
    return function(key, callback) {
      // Super hacky way to deal with a race condition
      // I couldn't find nor fix - you are welcome to fix this...
      let delivery_lock = false
      function deliver(err = null, value) {
        if (!delivery_lock) {
          delivery_lock = true
          callback(err, value)
        }
      }
      // fetch key from hypercore
      if (core.length > 0) {
        const packet_count = core.length + 1

        // Reverse through the packets in core
        for (var i = packet_count - 1; i >= 0; i--) {
          core.get(i, (err, buffer) => {
            if (err) {
              deliver(err)
              return
            }

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
          })
        }
      } else {
        // core is empty so there's nothing available yet
        deliver()
      }
    }
  },
  get_all_keys: function(core) {
    return function(callback) {
      // fetch key from hypercore
      if (core.length > 0) {
        const keys = {}
        const packet_count = core.length

        // Create index of all keys and the last action associated with them
        async.times(
          packet_count,
          (i, done) => {
            core.get(i, (err, buffer) => {
              if (err) {
                return done(err)
              }

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
                  done()
                } else {
                  debug('[ERROR]', "content doesn't split correctly", content)
                  done('BAD_CONTENT')
                }
              } else {
                done('BAD_CONTENT')
              }
            })
          },
          (err) => {
            if (err) return callback(err)
            // Filter out all keys that have - as their action because they are deleted
            const existing_keys = []
            for (const key in keys) {
              if (keys.hasOwnProperty(key) && keys[key] === '+') {
                existing_keys.push(key)
              }
            }
            callback(null, existing_keys)
          },
        )
      } else {
        // core is empty so there's nothing available yet
        callback(null, [])
      }
    }
  },
  rem_kv: function(core) {
    return function(key, callback) {
      // add -|key to hypercore
      // - is for action type so we can add delete later
      core.append(Buffer.from(`-|${key.toString()}|`), (err) => {
        callback(err)
      })

      // TODO: Find block ids for previous entries and delete local data for those
    }
  },
}
