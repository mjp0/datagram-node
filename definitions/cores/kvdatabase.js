const schemas = require('../schemas.json')

module.exports = {
  id: 'kvdatabase',
  name: 'Key/Value Database',
  version: 1,
  accepted_messages: [
    'owneruser',
    'adminuser',
    schemas.AcceptAction,
    schemas.AskAction,
    schemas.AssignAction,
    schemas.IgnoreAction,
    schemas.Message,
  ]
}
