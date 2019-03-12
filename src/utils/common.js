const promcall = require('promised-callback')
const _get = require('lodash/get')
const { error, err } = require('./errors')

exports.getNested = function(obj, value) {
  return _get(obj, value)
}

exports.values = function(obj) {
  return Object.keys(obj).map(function(k) {
    return obj[k]
  })
}

// Deep clone
exports.clone = function(obj) {
  return JSON.parse(JSON.stringify(obj))
}

exports.wrapStreamToPAPI = (args = { namespace: null, API: null, stream: null, _: null }) => {
  const { API, namespace, stream, _ } = { ...args }

  for (const action in API) {
    if (API.hasOwnProperty(action)) {
      if (typeof API[action] === 'function') {
        if (!stream) stream = stream
        if (!namespace) {
          stream[action] = API[action](stream, _)
        } else {
          if (!stream[namespace]) stream[namespace] = {}
          stream[namespace][action] = API[action](stream, _)
        }
      } else {
        return error({ err: err.UNKNOWN_ACTION, args })
      }
    }
  }
  return stream
}

exports.checkVariables = (args, required) => {
  const missing = []
  for (const req in required) {
    if (!exports.getNested(args, required[req])) {
      missing.push(required[req])
    }
  }
  if (missing.length === 0) return false
  else return missing
}

exports.getDataType = async (data = null) => {
  return new Promise(async (done, error) => {
    // We are not going to deal with nulls or undefined
    if (!data) {
      error(new Error('BAD_DATA'), { data })
      return
    }
    let type = null
    switch (typeof data) {
      case 'boolean':
        type = 'bool'
        break
      case 'number':
        type = 'integer'

        // check if float
        if (Number(data) === data && data % 1 !== 0) {
          type = 'float'
        }
        break
      case 'string':
        type = 'string'
        break
      case 'object':
        // check if it's a buffer
        if (Buffer.isBuffer(data)) {
          type = 'buffer'
        } else {
          type = 'object'
        }
        break
      default:
        break
    }
    done(type)
  })
}
