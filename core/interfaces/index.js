const interfaces = {
  ...require('./base'),
  ...require('./kv'),
  ...require('./meta')
}
console.log(interfaces)
// process.exit()
// TODO: Why the hell doesn't this work? Is this a nodejs bug or something?
// interfaces.meta = { ...require('./meta') }
module.exports = {
  getInterface: async (name) => {
    return new Promise(async (done, error) => {
      console.log(interfaces, name)
      if (interfaces[name]) {
        done(interfaces[name])
      } else {
        done(null)
      }
    })
  },
}
