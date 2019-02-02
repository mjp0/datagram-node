const debug = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const crypto = require('hypercore-crypto')
const { _open_storage } = require('../utils')
const descriptors = require('../descriptors')
const { getInterface } = require('./interfaces/index')

exports.create = async (args = { definition: null, storage: null }, opts = { keys: { key: null, secret: null } }) => {
  return new Promise(async (done, error) => {
    const { definition, storage, keys } = { ...args, ...opts }

    opts.valueEncoding = 'binary' // Binary encoding is enforced

    // Make sure we have the definition
    if (!definition) throw new Error('DEFINITION_REQUIRED')

    // If this is meta core, use generated keys
    if (definition && definition.id === 'meta') {
      if (typeof keys !== 'object') return error(new Error('META_REQUIRES_KEYS'))
      opts.key = Buffer.from(keys.key, 'hex')
      opts.secretKey = Buffer.from(keys.secret, 'hex')
    } else if (keys && keys.key) {
      opts.key = Buffer.from(keys.key, 'hex')
      opts.secretKey = keys.secret ? Buffer.from(keys.secret, 'hex') : null // secret is not required
    } else {
      const keyPair = crypto.keyPair()
      opts.key = keyPair.publicKey
      opts.secretKey = keyPair.secretKey
    }

    debug('Creating new core', opts.key.toString('hex'), definition['@type'])

    const store = _open_storage(opts.key.toString('hex'), storage)

    const stream = hypercore(store, opts)
    stream.ready(async (err) => {
      if (err) return error(err)

      // Generate the core around the data stream
      const base = await getInterface('base')
      if (!base) return error(new Error('BASE_INTERFACE_MISSING'))
      const Core = base(stream)

      // Add type definitions
      definition.datagramCoreID = stream.discoveryKey.toString('hex')
      definition.releaseDate = new Date().toISOString()
      definition.manufacturer = 'Machianists'
      definition.datagramKey = stream.key.toString('hex')
      Core.definition = definition

      // Apply interfaces
      if (Array.isArray(definition.interfaces)) {
        const ifaces = []
        definition.interfaces.forEach(async (requested_iface) => {
          if (requested_iface) {
            ifaces.push(
              new Promise(async (iface_done, iferror) => {
                const iface = await getInterface(requested_iface)
                if (!iface) return iferror(new Error('REQUESTED_INTERFACE_MISSING'), { requested_iface })
                await Core.addInterface(iface).catch(iferror)
                iface_done()
              }),
            )
          }
        })
        await Promise.all(ifaces).catch(error)
      }
      // Store definition at 0 position
      const core_descriptor = await descriptors.create('datagramCore', definition).catch(error)
      await Core.add(core_descriptor).catch(error)

      return done(Core)
    })
  })
}
