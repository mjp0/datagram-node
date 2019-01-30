const schemas = require('../schemas.json')

module.exports = {
  id: 'mp4stream',
  name: 'Video',
  version: 1,
  accepted_messages: [
    schemas.VideoObject,
  ]
}
