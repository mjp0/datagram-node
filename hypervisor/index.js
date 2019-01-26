const raf = require("random-access-file")
const path = require("path")
const events = require("events")
const inherits = require("inherits")
const readyify = require("../utils/ready")
const mutexify = require("mutexify")
const debug = require("../utils/debug")(__filename)
const hypercore = require("hypercore")
const { readStringFromStorage } = require("../utils/storage")
const { remove_core } = require("../cores/remove_core")
const { _add_to_ignore_list } = require("../cores/remove_core")
const { replicate, _replicate } = require("./replicate")
const crypto = require("hypercore-crypto")
const MetaCore = require("./meta-core")
const { deriveKeyPair } = require("../utils/crypto")
const waterfall = require("async/waterfall")

module.exports = Hypervisor

/**
 * Creates a hypervisor instance based on provided hypercore
 *
 * @public
 * @param {RandomAccessStorage} storage
 * @param {Object} opts Options
 * @param {string} opts.key A custom key for a new hypercore
 * @param {string} opts.{hypercore_options} All available Hypercore instance options
 * @returns
 */
function Hypervisor(storage, password, opts) {
  if (!(this instanceof Hypervisor)) return new Hypervisor(storage, password, opts)

  const self = this

  this._hypercore = hypercore
  this._hypervisor_key = password
  this._cores = {}
  this._coreKeyToCore = {}
  this._ignoreList = []
  this.mux = null
  this._opts = opts || {}
  this._metacore_opts = {}
  this._opts.valueEncoding = "binary" // Binary encoding is enforced
  this.coreLock = mutexify()
  this._middleware = []
  this._storage_path = null
  this._storage = storage

  if (typeof storage === "string") this._storage_path = storage

  // Generate keys for meta core and replication stream
  const metacore_keypair = deriveKeyPair(Buffer.from(password + "metacore"))
  this._metacore_opts.key = metacore_keypair.publicKey.toString("hex")
  this._metacore_opts.secret = metacore_keypair.secretKey.toString("hex")

  const replication_keypair = deriveKeyPair(Buffer.from(password + "replication"))
  this._opts.key = replication_keypair.publicKey.toString("hex")
  this._opts.secretKey = replication_keypair.secretKey.toString("hex")

  this._hypervisor_key = this._opts.key.toString("hex")

  this.key = this._opts.key

  this._open_storage = function(dir) {
    return function(name) {
      var s = storage
      if (typeof storage === "string") return raf(path.join(storage, dir, name))
      else return s(dir + "/" + name)
    }
  }
  // Makes sure everything necessary is executed before hypervisor is allowed to be used

  this._ready = readyify(function(done) {
    debug("Creating new Hypervisor", self._hypervisor_key)

    // First try to open the core, if it's not there, create a new one
    waterfall([
      (next) => {
        MetaCore.open(storage, self._metacore_opts, (err, MC) => {
          if (err) return callback(err)
          // If we have a key, we exist
          if (MC && MC.key) next(null, MC)
          else next(null, null)
        })
      },
      (MC, next) => {
        if (!MC) {
          MetaCore.create(storage, self._metacore_opts, (err, MC) => {
            if (err) return callback(err)
            // If we have a key, we exist
            if (MC && MC.key) next(null, MC)
          })
        } else next(null, MC)
      },
      (MC, next) => {
        generateAPI(MC)
        MC.load_cores_from_storage((err) => {
          if (err) return callback(err)
          MC.export_legacy((err, cores) => {
            if (err) return callback(err)
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
      self.replicate = function(opts) {
        return replicate(self, MetaCore, opts)
      }
      self.core = (key) => {
        if (Buffer.isBuffer(key)) key = key.toString("hex")
        return MetaCore.core_references[key]
      }
    }
  })

  this.ready = function(cb) {
    self._ready(cb)
  }
}

inherits(Hypervisor, events.EventEmitter)

//Hypervisor.prototype.replicate = replicate
Hypervisor.prototype._remove_core = remove_core
Hypervisor.prototype._add_to_ignore_list = _add_to_ignore_list

/**
 * Passes ready callback to internal _ready 
 *
 * @public
 * @param {Function} cb callback()
 */
// Hypervisor.prototype.ready = function(cb) {
//   this._ready(cb)
// }

/**
 * Add replication policy functions
 *
 * @param {Object} plug Replication policy object
 * @param {Function} plug.init init(hypervisor) Called with hypervisor.ready, useful for initialization if needed
 */
Hypervisor.prototype.use = function(plug) {
  if (this._middleware === null) this._middleware = []

  // Store replication policy object to _middleware
  this._middleware.push(plug)
  let self = this

  // If policy contains function init, run it when hypervisor is getting ready
  if (typeof plug.init === "function")
    this.ready(function() {
      plug.init(self)
    })
}

/**
 * Updates hypervisor's ignore list
 *
 * @public
 * @param {function} cb Called when ready
 */
Hypervisor.prototype.updateIgnoreList = function(cb) {
  const self = this
  let bl_storage = self._open_storage("IGNORELIST")
  let ignorelist = bl_storage("ignorelist")
  readStringFromStorage(ignorelist, (err, str) => {
    // Blacklist doesn't exist yet
    if (!err) {
      self._ignoreList = str.split("|")
    }
    debug("[IGNORELIST UPDATED]", str)
    cb()
  })
}
