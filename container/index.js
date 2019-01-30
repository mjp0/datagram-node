const raf = require('random-access-file')
const path = require('path')
const events = require('events')
const inherits = require('inherits')
const readyify = require('../utils/ready')
const mutexify = require('mutexify')
const debug = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const { replicate } = require('./replicate')
const MetaCore = require('./meta-core')
const { deriveKeyPair } = require('../utils/crypto')
const waterfall = require('async/waterfall')
const home = require('home')

module.exports = Adapter

/**
 * Creates a adapter instance based on provided hypercore
 */
function Adapter(args = { password: null }, opts = { definition: null, storage: null }) {
  if (!(this instanceof Adapter)) return new Adapter(args, opts)

  // Make sure we have a password
  if (!args.password) throw new Error('PASSWORD_REQUIRED')
  this._adapter_password = args.password

  // the mandatory variables
  const self = this
  this._hypercore = hypercore
  this.coreLock = mutexify()
  this._middleware = []
  this._opts = opts || {}
  this.definition = opts.definition

  // If no storage path provided, store to .datagram under home path
  this._storage = opts.storage || `${home()}/.datagram/`

  // Generate keys for meta core and replication stream
  const metacore_keypair = deriveKeyPair(Buffer.from(this._adapter_password + 'metacore'))
  this._metacore_opts = {}
  this._metacore_opts.key = metacore_keypair.publicKey.toString('hex')
  this._metacore_opts.secret = metacore_keypair.secretKey.toString('hex')

  const replication_keypair = deriveKeyPair(Buffer.from(this._adapter_password + 'replication'))
  this._opts.key = replication_keypair.publicKey.toString('hex')
  this._opts.secretKey = replication_keypair.secretKey.toString('hex')

  this.key = this._opts.key

  // Used by replication, should be replaced with utils/storage/_open_storage at some point
  this._open_storage = function(dir) {
    return function(name) {
      const s = self._storage
      if (typeof self._storage === 'string') return raf(path.join(self._storage, dir, name))
      else return s(dir + '/' + name)
    }
  }

  // Makes sure everything necessary is executed before adapter is allowed to be used
  this._ready = readyify(function(done) {
    debug('Creating new Adapter', self.key)

    // If definition is null, this is likely an existing adapter

    // If this is an existing adapter, open meta-core and it will re-create the feeds
    // don't forget to fetch definition

    // First try to open the core, if it's not there, create a new one
    waterfall([
      (next) => {
        MetaCore.open(self._storage, self._metacore_opts, (err, MC) => {
          if (err) return done(err)
          // If we have a key, we exist
          if (MC && MC.key) next(null, MC)
          else next(null, null)
        })
      },
      (MC, next) => {
        if (!MC) {
          // Make sure we have the definition
          if (!self.definition) throw new Error('DEFINITION_REQUIRED')

          MetaCore.create(
            { definition: { id: 'meta' }, storage: self._storage },
            { opts: self._metacore_opts },
            (err, MC) => {
              if (err) return done(err)
              // If we have a key, we exist
              if (MC && MC.key) next(null, MC)
            },
          )
        } else next(null, MC)
      },
      (MC, next) => {
        debug(MC)
        generateAPI(MC)
        MC.load_cores_from_storage((err) => {
          if (err) return done(err)
          MC.export_legacy((err, cores) => {
            if (err) return done(err)
            self._cores = cores._cores
            self._coreKeyToCore = cores._coreKeyToCore
            done()
          })
        })
      },
    ])

    function generateAPI(MetaCore) {
      self.add_core = (name, type, callback) => {
        MetaCore.add_core(name, type, (err, core) => {
          if (err) return callback(err)
          self.update_legacy((err) => {
            if (err) return callback(err)
            callback(err, core)
          })
        })
      }
      self.attach_core = (name, hypercore, type, callback) => {
        MetaCore.attach_core(name, hypercore, type, (err, core) => {
          if (err) return callback(err)
          self.update_legacy((err) => {
            if (err) return callback(err)
            callback(err, core)
          })
        })
      }
      self.update_legacy = (callback) => {
        MetaCore.export_legacy((err, cores) => {
          if (err) return callback(err)
          self._cores = cores._cores
          self._coreKeyToCore = cores._coreKeyToCore
          callback()
        })
      }
      self.open_core = MetaCore.open_core
      self.cores = MetaCore.get_all_cores
      self.get_cores = MetaCore.get_all_cores
      self.attach_core = MetaCore.attach_core
      self.remove_core = MetaCore.remove_core
      self.get_blocklist = MetaCore.get_blocklist
      self.replicate = function(opts) {
        return replicate(self, MetaCore, opts)
      }
      self.core = (key) => {
        if (Buffer.isBuffer(key)) key = key.toString('hex')
        return MetaCore.core_references[key]
      }
    }
  })

  this.ready = function(cb) {
    self._ready(cb)
  }
}

inherits(Adapter, events.EventEmitter)

/**
 * Passes ready callback to internal _ready
 *
 * @public
 * @param {Function} cb callback()
 */
// Adapter.prototype.ready = function(cb) {
//   this._ready(cb)
// }

/**
 * Add replication policy functions
 *
 * @param {Object} plug Replication policy object
 * @param {Function} plug.init init(adapter) Called with adapter.ready, useful for initialization if needed
 */
Adapter.prototype.use = function(plug) {
  if (this._middleware === null) this._middleware = []

  // Store replication policy object to _middleware
  this._middleware.push(plug)
  const self = this

  // If policy contains function init, run it when adapter is getting ready
  if (typeof plug.init === 'function') {
    this.ready(function() {
      plug.init(self)
    })
  }
}
