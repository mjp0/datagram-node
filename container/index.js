const raf = require('random-access-file')
const path = require('path')
const events = require('events')
const inherits = require('inherits')
const readyify = require('../utils/ready')
const mutexify = require('mutexify')
const debug = require('../utils/debug')(__filename)
const hypercore = require('hypercore')
const { replicate } = require('./replicate')
const { deriveKeyPair } = require('../utils/crypto')
const waterfall = require('async/waterfall')
const home = require('home')
const core_definitions = require('../definitions/cores')
const container_definitions = require('../definitions/containers')
const { create, load, clone } = require('../core')

module.exports = container

// one-to-non = expect cores only from me
// one-to-one = expect cores from two users, one for me and one for you
// one-to-many = expect cores from anybody but allow me to choose
// many-to-many = everybody can add their cores freely

/**
 * Creates a container instance based on provided hypercore
 */
async function container(args = { password: null }, opts = { definition: null, storage: null }) {
  return new Promise(async (done, error) => {
    // Make sure we have a password
    if (!args.password) throw new Error('PASSWORD_REQUIRED')
    this._container_password = args.password

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
    const metacore_keypair = await deriveKeyPair(Buffer.from(this._container_password + 'metacore'))

    // Generate container replication feed keys
    const replication_keypair = await deriveKeyPair(Buffer.from(this._container_password + 'replication'))

    // Used by replication, should be replaced with utils/storage/_open_storage at some point
    this._open_storage = function(dir) {
      return function(name) {
        const s = self._storage
        if (typeof self._storage === 'string') return raf(path.join(self._storage, dir, name))
        else return s(dir + '/' + name)
      }
    }

    // If definition is null, this is likely an existing container

    // If this is an existing container, open meta-core and it will re-create the feeds
    // don't forget to fetch definition

    // First try to open the meta core, if it's not there, create a new one
    let meta_core = await load({ keys: metacore_keypair, storage: self._storage }).catch(error)

    if (!meta_core) {
      meta_core = await create(
        { definition: core_definitions.Meta, storage: self._storage },
        { keys: metacore_keypair },
      ).catch(error)
    }

    // Find all unopened cores and initialize them
    const all_unopened_cores = await meta_core.meta.getAllUnopenedCores().catch(error)

    if (all_unopened_cores.length > 0) {
      const q = []
      all_unopened_cores.forEach((core) => {
        q.push(
          new Promise(async (c_done, c_error) => {
            const loaded_c = await load({
              keys: { key: Buffer.from(self._metacore_opts.key, 'hex') },
              storage: self._storage, // this could be any RAS
            }).catch(c_error)
            await meta_core.meta.attachCore(loaded_c).catch(c_error)
            c_done()
          }),
        )
      })
      await Promise.all(q)
    } else if (all_unopened_cores === 0) {
      // This is a new core with nothing here yet

      // Create admin core
      const core1 = await create({ definition: core_definitions.Admin, storage: self._storage }).catch(error)
      await meta_core.meta.addCore(core1).catch(error)

      

    } else {
      // This state should not happen
      error(new Error('UNKNOWN_STATE'))
    }

    // Makes sure everything necessary is executed before container is allowed to be used
    this._ready = readyify(function(done) {
      debug('Creating new container', self.key)

      // If definition is null, this is likely an existing container

      // If this is an existing container, open meta-core and it will re-create the feeds
      // don't forget to fetch definition

      // First try to open the meta core, if it's not there, create a new one
      waterfall([
        // (next) => {
        //   MetaCore.open(self._storage, self._metacore_opts, (err, MC) => {
        //     if (err) return done(err)
        //     // If we have a key, we exist
        //     if (MC && MC.key) next(null, MC)
        //     else next(null, null)
        //   })
        // },
        // (MC, next) => {
        //   if (!MC) {
        //     // Make sure we have the definition
        //     if (!self.definition) throw new Error('DEFINITION_REQUIRED')

        //     MetaCore.create(
        //       { definition: { id: 'meta' }, storage: self._storage },
        //       { opts: self._metacore_opts },
        //       (err, MC) => {
        //         if (err) return done(err)
        //         // If we have a key, we exist
        //         if (MC && MC.key) next(null, MC)
        //       },
        //     )
        //   } else next(null, MC)
        // },
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
          done(MetaCore.core_references[key])
        }
      }
    })

    this.ready = function(cb) {
      self._ready(cb)
    }
  })
}

inherits(container, events.EventEmitter)

/**
 * Add replication policy functions
 *
 * @param {Object} plug Replication policy object
 * @param {Function} plug.init init(container) Called with container.ready, useful for initialization if needed
 */
container.prototype.use = function(plug) {
  if (this._middleware === null) this._middleware = []

  // Store replication policy object to _middleware
  this._middleware.push(plug)
  const self = this

  // If policy contains function init, run it when container is getting ready
  if (typeof plug.init === 'function') {
    this.ready(function() {
      plug.init(self)
    })
  }
}
