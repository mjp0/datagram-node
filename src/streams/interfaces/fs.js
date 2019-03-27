const { log } = require('../../utils/debug')(__filename)
const { errors, getDataType, checkVariables } = require('../../utils/')
const descriptors = require('../../descriptors')

const fs = {
  '@id': 'fs',
  write: (API, stream) => {
    return async (key, value) => {
      return new Promise(async (done, error) => {
        // add +|key|value to the stream
        // + is for action type so we can add delete later

        // Do a type check
        const datatype = await getDataType(value).catch(error)
        const descriptor = {
          agent: {
            '@type': 'User',
            key: await API.base.getUserId().catch(error),
          },
          datatype,
          arguments: { key, action: '+' },
        }
        const only_descriptor = JSON.parse(JSON.stringify(descriptor))
        descriptor[datatype] = value

        const pkg = await descriptors.create('DatagramData', descriptor).catch(error)

        const position = await API.base.add(pkg, only_descriptor).catch(error)

        done(position)
      })
    }
  },
  read: (API, stream) => {
    return async (key, skip_wait = false) => {
      return new Promise(async (done, error) => {
        if (!stream.shared) skip_wait = true

        const buffer = await API.base.get(key, !skip_wait).catch(error)
        if (!buffer) return done()

        // Turn content back to readable
        const content = await descriptors.read(buffer).catch(error)

        // Check that key & action exists
        if (content && content.type !== 'datagramStream') {
          const missing = checkVariables(content, [ 'datatype', 'arguments', 'arguments.key', 'arguments.action' ])
          if (missing) return error(errors.MISSING_VARIABLES, { missing, content })
        } else {
          // not a descriptor, return as-is
          return done(content)
        }

        const args = { ...content.arguments }

        // If it's an object, it's probably descriptor
        if (typeof content === 'object') {
          // If we find the key with + type, we pick that and stop the search
          if (args.action === '+') {
            try {
              if (args.key === key) {
                // Make sure that it's not empty
                if (content[content.datatype]) {
                  return done(content[content.datatype])
                } else {
                  return done(content)
                }
              }
            } catch (e) {
              log('[ERROR]', 'error in json parsing', e)
              error(new Error('ERROR_PARSING_JSON'))
            }
          } else error(new Error('BAD_CONTENT'))
        }
      })
    }
  },
  ls: (API, stream) => {
    return async () => {
      return new Promise(async (done, error) => {
        stream.list('', (err, keys) => {
          if (err) return error(err)
          if (!keys || keys.length === 0) return done([])
          else {
            const internal_keys = ['_template', '_index']
            const results = keys.map((k) => {
              if (internal_keys.indexOf(k[0].key) === -1) {
                return k[0].key
              }
            }).filter(Boolean)
            return done(results)
          }
        })
      })
    }
  },
  rm: (API, stream) => {
    return async (key) => {
      return new Promise(async (done, error) => {
        stream.del(key, (err, result) => {
          if (err) return error(err)
          else return done(result)
        })
      })
    }
  },
}

exports.fs = fs
