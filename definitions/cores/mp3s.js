const schemas = require('../schemas.json')

module.exports = {
  id: 'mp3stream',
  name: 'Audio',
  version: 1,
  accepted_messages: [
    schemas.AudioObject,
  ]
}
