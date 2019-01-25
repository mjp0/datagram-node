const values = require('../utils/common').values

/**
 * Returns a list of all cores in the hypervisor
 *
 * @public
 * @returns {array} list of cores in the hypervisor
 */
exports.get_cores = function () {
  return values(this._cores)
}

/**
 * Returns a core based on a key
 *
 * @public
 * @param {string|buffer} key
 * @returns core
 */
exports.get_core_by_key = function (key) {
  if (Buffer.isBuffer(key)) key = key.toString("hex")
  if (typeof key === "string") return this._coreKeyToCore[key]
  else return null
}