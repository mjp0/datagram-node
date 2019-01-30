const schemas = require('../schemas.json')

module.exports = {
  id: 'messagestream',
  name: 'Messages',
  version: 1,
  accepted_messages: [
    schemas.Message,
  ]
}
