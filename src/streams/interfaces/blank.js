const { log } = require('../../utils/debug')(__filename)

const blank = {
  '@id': 'blank',
  _test: (API, stream) => {
    return async (key, value) => {
      return new Promise(async (done, error) => {
        done(position)
      })
    }
  }
}

exports.blank = blank
