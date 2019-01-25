const debug = require('../utils/debug')(__filename)
const values = require('../utils/common').values
const multiplexer = require("./multiplexer")

/**
 * Generates a two-way sync stream based on cores in hypervisor
 *
 * @public
 * @param {Object} opts
 * @param {Object} opts
 * @returns
 */
exports.replicate = function (opts) {
  const self = this
  this._add_to_ignore_list(() => { })
  return this._replicate(opts)
}

exports._replicate = function (opts) {
  if (!opts) opts = {}
  let self = this
  debug(self.key)
  // Create a multiplexed replication stream from all cores in hypervisor
  let mux = (this.mux = multiplexer(self.key, opts))

  // Listen for "manifest" packet to tell us what the peer has to offer
  mux.once("manifest", function (m) {
    // Remove ignored keys automatically
    debug("[MANIFEST IGNORELIST]", self._ignoreList)
    if (self._ignoreList.length > 0) {
      m.keys = m.keys.filter((key) => {
        if (self._ignoreList.indexOf(key) === -1) return true
        else {
          debug("REMOVED KEY", key)
        }
      })
    }

    // If we have added custom replication policy, execute that
    if (self._middleware.length) {
      // Call policy function with index and manifest
      function callPlug(idx, ctx) {
        // If this is the last middleware, we have filtered out keys we don't want
        // and can mark the rest as wanted cores
        if (self._middleware.length === idx) return mux.wantFeeds(ctx.keys)

        // Fetch the middleware
        let plug = self._middleware[idx]

        // Reliquish control to next if plug does not implement callback
        if (typeof plug.want !== "function") return callPlug(idx + 1, ctx)

        // give each plug a fresh reference to avoid peeking/postmodifications
        plug.want(clone(ctx), function (keys) {
          let n = clone(m)
          n.keys = keys
          callPlug(idx + 1, n)
        })
      }
      // Start loop by calling first policy function with manifest
      callPlug(0, m)
    } else {
      // If no custom replication policy used, tell peer we want every core they have
      mux.wantFeeds(m.keys)
    }
  })

  // Listen for "replicate" keys to start replicating
  mux.once("replicate", function (keys, repl) {
    // Before we can replicate, we need to create and add previously unknown cores to
    // hypervisor
    addMissingKeys(keys, function (err) {
      if (err) return mux.destroy(err)

      // Sort core keys alphabetically
      let key2core = values(self._cores).reduce(function (h, core) {
        h[core.key.toString("hex")] = core
        return h
      }, {})

      let sortedFeeds = keys.map(function (k) {
        return key2core[k]
      })

      // Start replication on sorted keys
      repl(sortedFeeds)
    })
  })

  // Start streaming
  this.ready(function (err) {
    if (err) return mux.stream.destroy(err)
    if (mux.stream.destroyed) return

    // Wait until mux has initialized properly
    mux.ready(function () {
      
      // Create a list of the cores in hypervisor
      let available = values(self._cores).map(function (core) {
        return core.key.toString("hex")
      })

      // If middleware has been specified, run it
      if (self._middleware.length) {
        // Orderly iterate through all plugs
        function callPlug(idx, ctx) {
          // If this is the last middleware, we have filtered out keys we don't want to share
          // and can mark the rest as shared cores
          if (idx === self._middleware.length) return mux.haveFeeds(ctx.keys, ctx)

          let plug = self._middleware[idx]

          // Reliquish control to next if plug does not implement callback
          if (typeof plug.have !== "function") return callPlug(idx + 1, ctx)

          // give each plug a fresh reference to avoid peeking/postmodifications
          plug.have(clone(ctx), function (keys, extras) {
            // TODO: Can an attacker launch a spam attack with custom props?
            extras = extras || {}
            extras.keys = keys
            callPlug(idx + 1, extras)
          })
        }
        callPlug(0, { keys: available })
      } else {
        // Default behaviour 'share all'
        mux.haveFeeds(available)
      }
    })
  })

  return mux.stream

  // Helper functions

  /**
   * Add previously unknown keys to the hypervisor
   *
   * @public
   * @param {array[string]} keys Keys to be checked and added
   * @param {Function} cb Called when ready
   */
  function addMissingKeys(keys, cb) {
    self.ready(function (err) {
      if (err) return cb(err)
      debug("keys", keys)
      // Lock the core to prevent race conditions
      self.coreLock(function (release) {
        _addMissingKeysLocked(keys, function (err) {
          release(cb, err)
        })
      })
    })
  }

  /**
   * Add previously unknown keys to the locked core
   *
   * @private
   * @param {array[string]} keys Keys to be checked and added
   * @param {Function} cb Called when ready
   */
  function _addMissingKeysLocked(keys, cb) {
    let pending = 0
    debug("[REPLICATION] recv'd " + keys.length + " keys")

    // Validate keys
    let filtered = keys.filter(function (key) {
      return !Number.isNaN(parseInt(key, 16)) && key.length === 64
    })

    // Get keys hypervisor has already
    let existingKeys = values(self._cores).map(function (core) {
      return core.key.toString("hex")
    })

    // Get keys that are previously unknown to the hypervisor
    let missingFeeds = filtered.filter(function (key) {
      return existingKeys.indexOf(key) === -1
    })

    // Iterates through each missing core and adds it to the hypervisor
    function initFeed(i) {
      // We are done if there's no more cores to process
      if (i >= missingFeeds.length) return cb()

      // Get core key
      let key = missingFeeds[i]

      // Get the number of known cores and create a new storage on the next free slot
      let numFeeds = Object.keys(self._cores).length
      let storage = self._open_storage("" + numFeeds)
      let core

      try {
        // Create a new hypercore with the core key
        debug("[REPLICATION] trying to create new local hypercore, key=" + key.toString("hex"))
        core = self._hypercore(storage, Buffer.from(key, "hex"), self._opts)
      } catch (e) {
        debug("[REPLICATION] failed to create new local hypercore, key=" + key.toString("hex"))
        return initFeed(i + 1)
      }

      // Wait until core is initialized
      core.ready(function () {
        debug("[REPLICATION] succeeded in creating new local hypercore, key=" + key.toString("hex"))

        // Add core to hypervisor
        self._add_core_to_meta(core, String(numFeeds))

        // Call the next core
        initFeed(i + 1)
      })
    }
    initFeed(0)
  }
}