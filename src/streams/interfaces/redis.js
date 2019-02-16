const { log } = require('../../utils/debug')(__filename)
const { errors, getDataType, checkVariables } = require('../../utils/')
const async = require('async')
const descriptors = require('../../descriptors')

/*
I LOVE redis' API and it's my favorite database of all time.
I want to have same awesome redis API to work with stream databases.
That's why the name redis.
*/

exports.redis = {
  '@id': 'redis',
  set: (API, stream) => {
    return async (key, value) => {
      return new Promise(async (done, error) => {
        // add +|key|value to the stream
        // + is for action type so we can add delete later

        // Do a type check
        const datatype = await getDataType(value).catch(error)

        const descriptor = {
          agent: {
            '@type': 'Owner',
            key: await API.getOwner().catch(error),
          },
          datatype,
          arguments: { key, action: '+' },
        }
        const only_descriptor = JSON.parse(JSON.stringify(descriptor))
        descriptor[datatype] = value

        const pkg = await descriptors.create('DatagramData', descriptor).catch(error)

        const position = await API.add(pkg, only_descriptor).catch(error)

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

            // Turn content back to readable
            const content = await descriptors.read(buffer).catch(error)

            // Check that key & action exists
            const missing = checkVariables(content, [ 'datatype', 'arguments', 'arguments.key', 'arguments.action' ])
            if (missing) return error(errors.MISSING_VARIABLES, { missing, content })

            const args = { ...content.arguments }

            // If it's an object, it's probably descriptor
            if (typeof content === 'object') {
              // If we find the key with + type, we pick that and stop the search
              if (args.action === '+') {
                try {
                  let value = null

                  // Make sure that it's not empty
                  if (content[content.datatype]) {
                    value = content[content.datatype]
                  }
                  deliver(null, value)
                  return
                } catch (e) {
                  log('[ERROR]', 'error in json parsing', e)
                  deliver('ERROR_PARSING_JSON')
                }
              } else if (args.action === '-') {
                // If we find the key with - type, it's deleted and we stop the search
                deliver()
              } else {
                log('[ERROR]', 'this state should not happen', content)
                deliver('BAD_CONTENT')
              }
            } else deliver('BAD_CONTENT')
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
          if (Array.isArray(packages)) {
            const pkgs = []
            packages.forEach(async (pkg) => {
              if (pkg) {
                pkgs.push(
                  new Promise(async (pkg_done, iferror) => {
                    // Turn content back to readable
                    const content = await descriptors.read(pkg).catch(error)

                    // Check that key & action exists
                    const missing = checkVariables(content, [
                      'datatype',
                      'arguments',
                      'arguments.key',
                      'arguments.action',
                    ])
                    if (missing) return error(errors.MISSING_VARIABLES, { missing, content })

                    const args = { ...content.arguments }

                    // If we find the key with + type, add it to keys with +
                    if (args.action === '+') {
                      keys[args.key] = '+'
                    }
                    // If we find the key with - type, add it to keys with +
                    if (args.action === '-') {
                      keys[args.key] = '-'
                    }

                    pkg_done()
                  }),
                )
              }
            })
            await Promise.all(pkgs).catch(error)
            // Filter out all keys that have - as their action because they are deleted
            const existing_keys = []
            for (const key in keys) {
              if (keys.hasOwnProperty(key) && keys[key] === '+') {
                existing_keys.push(key)
              }
            }
            done(existing_keys)
          } else {
            return error(new Error(errors.PACKAGES_MISSING))
          }
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
        // const res = await API.add(Buffer.from(`-|${key.toString()}|`)).catch(error)

        const descriptor = {
          agent: {
            '@type': 'Owner',
            key: await API.getOwner().catch(error),
          },
          arguments: { key, action: '-' },
          datatype: 'null',
        }

        const pkg = await descriptors.create('DatagramData', descriptor).catch(error)

        const position = await API.add(pkg, pkg).catch(error)

        if (typeof API.index === 'object') {
          if (typeof API.index.indexer.addRow === 'function') {
            await API.index.indexer.removeRow({ key }).catch(error)
          } else {
            return error(new Error(errors.BAD_INDEX), { index: API.index })
          }
        }
        done(position)

        // TODO: Find block ids for previous entries and delete local data for those
      })
    }
  },
  lpush: (API, stream) => {
    return async (key, value) => {
      return new Promise(async (done, error) => {
        let list = await API.get(key).catch(error)
        if (!list) {
          list = [ value ]
        } else {
          list.push(value)
        }
        const res = await API.set(key, Buffer.from(list)).catch(error)
        done(res)
      })
    }
  },
}
