const { log } = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const { _open_storage } = require('../utils')
const { getInterface } = require('./interfaces/index')

exports.clone = async (args = { keys: { key: null, secret: null }, storage: null }) => {
  return new Promise(async (done, error) => {
    const { storage, keys } = { ...args }

    const opts = {
      valueEncoding: 'binary', // Binary encoding is enforced
    }

    // Make sure we have the definition
    if (!keys.key) throw new Error('DEFINITION_REQUIRED')

    if (keys && keys.key) {
      opts.key = Buffer.from(keys.key, 'hex')
    }

    log('Cloning core', opts.key.toString('hex'))

    const store = _open_storage(opts.key.toString('hex'), storage)

    const stream = hypercore(store, opts)
    stream.ready(async (err) => {
      if (err) return error(err)

      // Generate the core around the data stream
      const base = await getInterface('base')
      const Stream = base(stream)

      return done(Stream)
    })
  })
}
