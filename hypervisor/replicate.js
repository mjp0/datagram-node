const debug = require('../utils/debug')(__filename)
const { values, clone } = require('../utils/common')
const multiplexer = require('./multiplexer')
const async = require('async')
const { createNewCore } = require('../cores/create_core')
/**
 * Generates a two-way sync stream based on cores in hypervisor
 *
 * @public
 * @param {Object} opts
 * @param {Object} opts
 * @returns
 */
exports.replicate = function(self, metacore, opts) {
  if (!opts) opts = {}
  this.key = self._opts.key
  // Create a multiplexed replication stream from all cores in hypervisor
  const mux = (self.mux = multiplexer(self.key, opts))

  // Listen for "manifest" packet to tell us what the peer has to offer
  mux.once('manifest', function(m) {
    // Remove ignored keys automatically
    debug('[MANIFEST IGNORELIST]', self._ignoreList)
    if (self._ignoreList.length > 0) {
      m.keys = m.keys.filter((key) => {
        if (self._ignoreList.indexOf(key) === -1) return true
        else {
          debug('REMOVED KEY', key)
        }
      })
    }

    // If we have added custom replication policy, execute that
    if (self._middleware.length) {
      // Call policy function with index and manifest
      // eslint-disable-next-line no-inner-declarations
      function callPlug(idx, ctx) {
        // If this is the last middleware, we have filtered out keys we don't want
        // and can mark the rest as wanted cores
        if (self._middleware.length === idx) return mux.wantFeeds(ctx.keys)

        // Fetch the middleware
        const plug = self._middleware[idx]

        // Reliquish control to next if plug does not implement callback
        if (typeof plug.want !== 'function') return callPlug(idx + 1, ctx)

        // give each plug a fresh reference to avoid peeking/postmodifications
        plug.want(clone(ctx), function(keys) {
          const n = clone(m)
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
  mux.once('replicate', function(keys, repl) {
    // Before we can replicate, we need to create and add previously unknown cores to
    // hypervisor
    addMissingKeys(keys, function(err) {
      if (err) return mux.destroy(err)

      // Sort core keys alphabetically
      metacore.export_legacy((err, cores) => {
        if (err) throw err

        const key2core = values(cores._cores).reduce(function(h, core) {
          h[core.key.toString('hex')] = core
          return h
        }, {})

        const sortedFeeds = keys.map(function(k) {
          return key2core[k]
        })

        // Start replication on sorted keys
        repl(sortedFeeds)
      })
    })
  })

  // Start streaming
  self.ready(function(err) {
    if (err) return mux.stream.destroy(err)
    if (mux.stream.destroyed) return

    // Wait until mux has initialized properly
    mux.ready(function() {
      // Create a list of the cores in hypervisor
      metacore.export_legacy((err, cores) => {
        if (err) throw err

        const available = values(cores._cores).map(function(core) {
          return core.key.toString('hex')
        })

        // If middleware has been specified, run it
        if (self._middleware.length) {
          // Orderly iterate through all plugs
          // eslint-disable-next-line no-inner-declarations
          function callPlug(idx, ctx) {
            // If this is the last middleware, we have filtered out keys we don't want to share
            // and can mark the rest as shared cores
            if (idx === self._middleware.length) return mux.haveFeeds(ctx.keys, ctx)

            const plug = self._middleware[idx]

            // Reliquish control to next if plug does not implement callback
            if (typeof plug.have !== 'function') return callPlug(idx + 1, ctx)

            // give each plug a fresh reference to avoid peeking/postmodifications
            plug.have(clone(ctx), function(keys, extras) {
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
    self.ready(function(err) {
      if (err) return cb(err)

      // Lock the core to prevent race conditions
      self.coreLock(function(release) {
        _addMissingKeysLocked(keys, function(err) {
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
    debug("[REPLICATION] recv'd " + keys.length + ' keys')

    // Validate keys
    const filtered = keys.filter(function(key) {
      return !Number.isNaN(parseInt(key, 16)) && key.length === 64
    })
    metacore.export_legacy((err, cores) => {
      if (err) return cb(err)

      // Get keys hypervisor has already
      const existingKeys = values(cores._cores).map(function(core) {
        return core.key.toString('hex')
      })

      // Get keys that are previously unknown to the hypervisor
      const missingFeeds = filtered.filter(function(key) {
        return existingKeys.indexOf(key) === -1
      })

      // Iterates through each missing core and adds it to the hypervisor
      async.forEach(
        missingFeeds,
        (key, key_done) => {
          debug('[REPLICATION] trying to create new local hypercore, key=' + key.toString('hex'))
          createNewCore('generic', metacore._default_storage, { key }, (err, new_core) => {
            if (err) return key_done(err)
            metacore.attach_core(key, new_core, 'generic', (err) => {
              key_done(err)
            })
          })
        },
        cb,
      )
    })
  }
}
