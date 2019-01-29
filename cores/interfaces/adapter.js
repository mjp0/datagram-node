const async = require('async')
const built_in_adapters = require('../adapters')

const adapters = { ...built_in_adapters }

const API = {
  loadAdapter: (core) => {
    return (adapter, callback) => {
      if (adapter.id && adapters[adapter.id]) {
      } else {
        callback(new Error('ADAPTER_MISSING'))
      }
    }
  },
}
module.exports = API
