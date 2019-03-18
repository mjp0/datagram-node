const promcall = require('promised-callback')
const { checkVariables, getNested, generateUser, toB58, fromB58, deriveKeyPair } = require('./utils')
const { log } = require('./utils/debug')(__filename)
const home = require('home')
const streams = require('./streams')
const templates = require('./templates/streams')

exports.generateUserIfNecessary = async (_, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)

    if (!_.credentials || !_.credentials.password || !_.credentials.id) {
      log('No user, generating a new one...')
      _.credentials = await generateUser().catch(error)
    } else {
      // Check that credentials have the right length
      if (_.credentials.id.length < 48) {
        return error(new Error('INVALID_USER_ID'))
      }
      if (_.credentials.password.length < 92) {
        return error(new Error('INVALID_USER_ID'))
      }
      log('User provided')
    }
    done(_)
  })
}

exports.determineStorage = async (_, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)

    // If storage is not provided, put everything into default directory
    if (!getNested(_, 'settings.storage')) {
      const storage_path = getNested(_, 'settings.path') || `${home()}/.datagram/`
      _.settings = Object.assign({}, _.settings, { storage: storage_path, path: storage_path })

      // If storage is not provided but path is, assume that the user wants to use file based
    } else if (!getNested(_, 'settings.storage') && getNested(_, 'settings.path')) {
      _.settings = Object.assign({}, _.settings, { storage: _.settings.path })
    }
    done(_)
  })
}

exports.openOrCreateOrConnect = async (DG, _, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    const user_missing = await checkVariables(_, [ 'credentials.id', 'credentials.password' ])
    if (user_missing) return error(new Error('USER_MISSING'))
    const keys_missing = await checkVariables(_, [ 'keys.read', 'keys.encryption_password' ])

    try {
      let API = null

      if (getNested(_, 'settings.sharelink')) {
        // Clone datagram
        API = await exports.clone(DG, _)
        return done(API, _)
      } else {
        // If credentials exist but sharelink doesn't,
        // we are either opening or creating new with predetermined keys
        if (!keys_missing) {
          // Try to open first
          API = await exports.open(DG, _)

          // if no stream found, the user is using premade keys so we need to create new
          if (API === 'NO_STREAM_FOUND_WITH_KEY') {
            API = await exports.create(DG, _)
          }
          return done(API, _)
        } else {
          API = await exports.create(DG, _)
          return done(API, _)
        }
      }
    } catch (e) {
      return error(e)
    }
  })
}

exports.create = async (DG, _, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    const missing = await checkVariables(_, [ 'credentials.id', 'credentials.password', 'type' ])
    if (missing) return error(new Error('MISSING_VARIABLES'), { missing })

    // Check if wanted DG type exists
    if (!templates[_.type.toLowerCase()]) return error(new Error('MISSING_TEMPLATE'))
    const stream = await streams
      .create({
        user_id: fromB58(_.credentials.id).toString('hex'),
        user_password: fromB58(_.credentials.password).toString('hex'),
        template: templates[_.type.toLowerCase()],
        storage: _.settings.storage,
      })
      .catch(error)

    _.streams[await stream.base.getAddress().catch(error)] = stream

    let stream_api = stream
    if (_.type !== 'blank') stream_api = stream[_.type]
    const API = Object.assign({}, DG, stream_api)
    if (_.settings.debug) API._stream = stream
    done(API)
  })
}

exports.open = async (DG, _, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    try {
      const id = fromB58(_.credentials.id).toString('hex')
      const password = fromB58(_.credentials.password).toString('hex')
      const encryption_password = fromB58(_.keys.encryption_password).toString('hex')
      const read = fromB58(_.keys.read).toString('hex')

      const stream = await streams.load(
        {
          keys: {
            read
          },
          storage: _.settings.storage,
          encryption_password: encryption_password,
          user_password: password,
        },
        {
          user_id: id,
        },
      )

      if (stream === 'NO_STREAM_FOUND_WITH_KEY') return done(stream)

      _.streams[await stream.base.getAddress().catch(error)] = stream

      const template = await stream.base.getTemplate()
      let stream_api = stream
      if (template['@id'] !== 'blank') stream_api = stream[template['@id']]
      const API = Object.assign({}, DG, stream_api)
      if (_.settings.debug) API._stream = stream
      done(API)
    } catch (e) {
      error(e)
    }
  })
}

exports.clone = async (DG, _, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    try {
      const id = fromB58(_.credentials.id).toString('hex')
      const password = fromB58(_.credentials.password).toString('hex')

      // parse sharelink
      const parsed_sharelink = getNested(_, 'settings.sharelink').split('/')
      if (parsed_sharelink.length !== 2) return error(new Error('INVALID_SHARELINK'))
      if (parsed_sharelink[0].length === 0) return error(new Error('MISSING_ADDRESS'))
      if (parsed_sharelink[1].length === 0) return error(new Error('MISSING_ENCRYPTION_PASSWORD'))

      const params = {
        keys: { read: fromB58(parsed_sharelink[0]).toString('hex') },
        storage: getNested(_, 'settings.storage'),
        encryption_password: fromB58(parsed_sharelink[1]).toString('hex'),
        user_id: id,
        user_password: password,
        full_sync: getNested(_, 'settings.full_sync'),
      }

      const stream = await streams.clone(params, { remote: true, realtime: _.settings.realtime }).catch(error)

      _.streams[await stream.base.getAddress().catch(error)] = stream

      const template = await stream.base.getTemplate()
      let stream_api = stream
      if (template['@id'] !== 'blank') stream_api = stream[template['@id']]
      const API = Object.assign({}, DG, stream_api)
      if (_.settings.debug) API._stream = stream
      done(API)
    } catch (e) {
      error(e)
    }
  })
}
