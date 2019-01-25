const raf = require("random-access-file")
const path = require("path")
const events = require("events")
const inherits = require("inherits")
const readyify = require("../utils/ready")
const mutexify = require("mutexify")
const debug = require("../utils/debug")(__filename)
const hypercore = require("hypercore")
const { readStringFromStorage } = require("../utils/storage")
const { add_core } = require("../cores/add_core")
const { _add_core_to_meta } = require("../cores/add_core")
const { get_core_by_key } = require("../cores/get_cores")
const { get_cores } = require("../cores/get_cores")
const { remove_core } = require("../cores/remove_core")
const { _add_to_ignore_list } = require("../cores/remove_core")
const { replicate, _replicate } = require("./replicate")
const crypto = require("hypercore-crypto")
const MetaCore = require('./meta-core')

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
function Hypervisor(storage, key, opts) {
  if (!(this instanceof Hypervisor)) return new Hypervisor(storage, key, opts)

  // Make key optional
  if (typeof key === "object") {
    opts = key
    key = null
  }
  const self = this

  this._hypercore = hypercore
  this._hypervisor_key = key
  this._cores = {}
  this._coreKeyToCore = {}
  this._ignoreList = []
  this.mux = null
  this._opts = opts || {}
  this._opts.valueEncoding = "binary" // Binary encoding is enforced
  this.coreLock = mutexify()
  this._middleware = []
  this._storage_path = null
  this._storage = storage

  if (typeof storage === "string") this._storage_path = storage

  if (!key) {
    this._first_run = true
    const keyPair = crypto.keyPair()
    this._opts.key = keyPair.publicKey
    this._hypervisor_key = this._opts.key.toString("hex")
    this._opts.secretKey = keyPair.secretKey
  } else {
    this._opts.key = Buffer.from(key, "hex")
    this._hypervisor_key = key
  }
  this.key = this._opts.key
  if (!this._opts.key) {
    debug("[ERROR] Trying to run hypervisor without a key")
    process.exit()
  }

  this._open_storage = function (dir) {
    return function (name) {
      var s = storage
      if (typeof storage === 'string') return raf(path.join(storage, dir, name))
      else return s(dir + '/' + name)
    }
  }
  // Makes sure everything necessary is executed before hypervisor is allowed to be used

  this._ready = readyify(function(done) {

    debug("Creating new Hypervisor", self._hypervisor_key)

    // If key exist, open existing meta core
    if (!self._first_run) {
      MetaCore.open(self._hypervisor_key, storage, (err, MC) => {
        if (err) return callback(err)
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
      })
    }
    // If key wasn't given, create new meta core
    if (self._first_run) {
      MetaCore.create(storage, (err, MC) => {
        if(err) return callback(err)
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
      })
    }

    // self._load_cores(function() {
    //   debug("[INIT] finished loading cores")
    //   done()
    // })

    function generateAPI(MetaCore){
      self.add_core = MetaCore.add_core
      self.open_core = MetaCore.open_core
      self.cores = MetaCore.get_all_cores
      self.get_cores = MetaCore.get_all_cores
      self.core = (key) => {
        if(Buffer.isBuffer(key)) key = key.toString("hex")
        return MetaCore.core_references[key]
      }
    }
  })
}

inherits(Hypervisor, events.EventEmitter)


Hypervisor.prototype.replicate = replicate

Hypervisor.prototype._add_core_to_meta = _add_core_to_meta
Hypervisor.prototype._remove_core = remove_core
Hypervisor.prototype._add_to_ignore_list = _add_to_ignore_list
Hypervisor.prototype._replicate = _replicate

/**
 * Passes ready callback to internal _ready 
 *
 * @public
 * @param {Function} cb callback()
 */
Hypervisor.prototype.ready = function(cb) {
  this._ready(cb)
}

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
