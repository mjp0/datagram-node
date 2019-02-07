const debug = require('debug')
const path = require('path')

module.exports = function(filename, prefix) {
  const name = path.basename(filename, path.extname(filename))
  return {
    log: debug(`LOG: datagram/${prefix ? prefix + '/' : ''}${name}`),
    error: debug(`ERROR: datagram/${prefix ? prefix + '/' : ''}${name}`),
  }
}
