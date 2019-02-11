const _get = require('lodash/get')

exports.getNested = function (obj, value) {
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
