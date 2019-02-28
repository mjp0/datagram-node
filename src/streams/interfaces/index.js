const interfaces = {
  ...require('./base'),
  ...require('./redis'),
  ...require('./blank'),
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
