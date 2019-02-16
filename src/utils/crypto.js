const promcall = require('promised-callback').default
const CDR = require('cryptodoneright').default
const { getNested, checkVariables } = require('./common')
const { err, errors } = require('./errors')

exports.deriveKeyPair = async (args = { master_key: null }, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    if (!getNested(args, 'master_key')) return error(new Error(err.MASTER_KEY_REQUIRED))
    try {
      const secret_key = await CDR.hash(args.master_key)
      const key_pair = await CDR.generate_keys(secret_key)
      const keys = {
        key: key_pair.public,
        secret: key_pair.private,
      }
      done(keys)
    } catch (e) {
      error(new Error(e))
    }
  })
}

exports.createKeyPair = async (callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    try {
      const key_pair = await CDR.generate_keys().catch(error)

      const keys = {
        key: key_pair.public,
        secret: key_pair.private,
      }

      done(keys)
    } catch (e) {
      error(e)
    }
  })
}

exports.generatePassword = async (args = { len: 32 }, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    // Check that key & action exists
    const missing = checkVariables(args, [ 'len' ])
    if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

    try {
      const password = await CDR.generate_random_string(args.len)
      done(password.slice(0, args.len))
    } catch (e) {
      error(e)
    }
  })
}

exports.encryptData = async (args = { data: null, key: null }, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    args.key = await CDR.hash(args.key).catch(error)
    const edata = await CDR.encrypt_data_with_key(args.key, args.data).catch(error)
    done(edata)
  })
}

exports.decryptData = async (args = { data: null, key: null, nonce: null }, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    // Check that key & action exists
    const missing = checkVariables(args, ['data', 'key', 'nonce'])
    if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

    args.key = await CDR.hash(args.key).catch(error)
    args.key += `|${args.nonce}`
    const edata = await CDR.decrypt_data(args.data, args.key).catch(error)
    done(edata)
  })
}

exports.securePassword = async (args = { password: null }, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    const hashed_pass = await CDR.secure_password(args.password).catch(error)
    done(hashed_pass)
  })
}

exports.hash = async (args = { str: null }, callback) => {
  return new Promise(async (resolve, reject) => {
    const { done, error } = promcall(resolve, reject, callback)
    const hash = await CDR.hash(args.str).catch(error)
    done(hash)
  })
}
