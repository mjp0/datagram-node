const { errors, checkVariables } = require('../../utils')
const { log } = require('../../utils/debug')(__filename)
const descriptors = require('../../descriptors')

exports.indexer = {
  '@id': 'indexer',
  '@depends_on': [ 'redis' ],
  addRow: (API, stream) => {
    return async (descriptor = null, meta = {}) => {
      return new Promise(async (done, error) => {
        // Check variables
        if (!descriptor) return error(errors.MISSING_VARIABLES, { missing: ['descriptor'], descriptor })
        const pkg = await descriptors.create('DatagramData', descriptor).catch(error)
        const pos = await API.add(pkg).catch(error)
        done(pos)
      })
    }
  },
  removeRow: (API, stream) => {
    return async(args = { key: null }) => {
      return new Promise(async (done, error) => {
        const pos = await API.redis.rem(args.key).catch(error)
        done(pos)
      })
    }
  },
}
