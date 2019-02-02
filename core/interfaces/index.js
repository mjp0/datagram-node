const interfaces = {
  ...require('./base'),
  ...require('./kv'),
  ...require('./meta'),
}
module.exports = {
  getInterface: async (name) => {
    return new Promise(async (done, error) => {
      if (interfaces[name]) {
        done(interfaces[name])
      } else {
        done(null)
      }
    })
  },
}
