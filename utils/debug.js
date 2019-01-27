const debug = require('debug')
const path = require('path')

module.exports = function(filename, prefix) {
  const name = path.basename(filename, path.extname(filename))
  return debug(`hypervisor/${prefix ? prefix + '/' : ''}${name}`)
}
