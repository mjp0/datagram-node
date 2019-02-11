const { error: err_log } = require('./debug')(__filename)

function error(err, meta) {
  err_log(err, meta)
  throw err
}

const err = {
  'PASSWORD_REQUIRED': 'PASSWORD_REQUIRED',
  'USER_ID_REQUIRED': 'USER_ID_REQUIRED',
  'ACTION_REQUIRED': 'ACTION_REQUIRED',
  'UNKNOWN_ACTION': 'UNKNOWN_ACTION',
  'MASTER_KEY_REQUIRED': 'MASTER_KEY_REQUIRED'
}

module.exports = { error, err }
