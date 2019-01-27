var protocol = require("hypercore-protocol")
var readify = require("../utils/ready")
var inherits = require("inherits")
var events = require("events")
const debug = require("../utils/debug")(__filename)
var xtend = require("xtend")

// constants
var HYPERVISOR = "HYPERVISOR"
var PROTOCOL_VERSION = "1.0.0"
// extensions
var MANIFEST = "MANIFEST"
var REQUEST_FEEDS = "REQUEST_FEEDS"
/*
var ANNOUNCE_FEED = 'ANNOUNCE_FEED'
var REQUEST_FEED_SIGNATURE = 'REQUEST_FEED_SIGNATURE'
var FEED_SIGNATURE = 'FEED_SIGNATURE'
*/

var SupportedExtensions = [
  MANIFEST,
  REQUEST_FEEDS,
  //ANNOUNCE_FEED
  //REQUEST_MANIFEST,
  //REQUEST_FEED_SIGNATURE,
  //FEED_SIGNATURE,
]

// `key` - protocol encryption key
// `opts`- hypercore-protocol opts

/**
 * Imp
 *
 * @param {string|Buffer} key Feed's key
 * @param {*} opts
 * @returns
 */
function Multiplexer(key, opts) {
  if (!(this instanceof Multiplexer)) return new Multiplexer(key, opts)
  debug("[REPLICATION] New mux initialized", key.toString("hex"), opts)
  var self = this
  self._opts = opts = opts || {}
  self.extensions = opts.extensions = SupportedExtensions || opts.extensions

  // initialize
  self._localHave = null
  self._localWant = null
  self._remoteHas = null
  self._remoteWants = null

  // Creates a new hypercore replication protocol instance
  // and adds userData as a meta-data
  var stream = (this.stream = protocol(
    Object.assign(opts, {
      userData: Buffer.from(
        JSON.stringify({
          // Specifies the client software and version required
          client: HYPERVISOR,
          version: PROTOCOL_VERSION,

          // Help! exposing available extensions might be good for future version tolerance,
          // but at the same time we're poentiallyleaking our user-agent fingerprint to a third party.
          extensions: self.extensions,
        }),
      ),
    }),
  ))

  // Create a new hypercore replication protocol for given key
  const feed = (this._feed = stream.feed(Buffer.from(key, "hex")))

  // When stream delivers "handshake" packet...
  stream.on("handshake", function() {
    // Parse the received packet to JSON
    var header = JSON.parse(this.userData.toString("utf8"))
    debug("[REPLICATION] recv'd header: ", JSON.stringify(header))

    // Check whether the sender's client and version match

    // If version is not compatible, terminate the stream and send error message
    if (!compatibleVersions(header.version, PROTOCOL_VERSION)) {
      debug("[REPLICATION] aborting; version mismatch (us=" + PROTOCOL_VERSION + ")")
      self._finalize(new Error("protocol version mismatch! us=" + PROTOCOL_VERSION + " them=" + header.version))
      return
    }

    // If client is not compatible, terminate the stream and send error message
    if (header.client != HYPERVISOR) {
      debug("[REPLICATION] aborting; Client mismatch! expected ", HYPERVISOR, "but got", header.client)
      self._finalize(new Error("Client mismatch! expected " + HYPERVISOR + " but got " + header.client))
      return
    }

    // Header checks out, add it as a remote client
    self.remoteClient = header

    // Tell everybody interested about the new ready remote client
    self.emit("ready", header)
  })

  // When stream delivers "extension" packet...
  feed.on("extension", function(type, message) {
    debug("Extension:", type, message.toString("utf8"))

    // List of all known extensions
    switch (type) {
      // Manifest tells us what feeds the peer has
      case MANIFEST:
        var rm = JSON.parse(message.toString("utf8"))

        // Store the feeds that the peer has
        self._remoteHas = rm.keys

        // Tell everybody interested about the new manifest
        self.emit("manifest", rm)
        break

      // Request feeds is a request to replicate a set of feeds the peer wants
      case REQUEST_FEEDS:
        // Store the feeds the peer wants and start replication
        self._remoteWants = JSON.parse(message.toString("utf8"))
        self._initRepl()
        break
      // case ANNOUNCE_FEED:
      //  self._announceFeed(JSON.parse(message.toString('utf8')))
    }
  })

  // If this is not a continous live replication, create a listener for "prefinalize" packet
  if (!self._opts.live) {
    self.stream.on("prefinalize", function(cb) {
      debug("[REPLICATION] feed finish/prefinalize", self.stream.expectedFeeds)

      // Call the callback to mark replication feed closed
      cb()
    })
  }

  // Uses readify to make sure everything is executed in an orderly fashion
  this._ready = readify(function(done) {
    self.on("ready", function(remote) {
      debug("[REPLICATION] remote connected and ready")
      done(remote)
    })
  })
}

inherits(Multiplexer, events.EventEmitter)

/**
 * Wraps internal _ready function
 *
 * @param {function} cb called when ready
 */
Multiplexer.prototype.ready = function(cb) {
  this._ready(cb)
}

/**
 * Finalizes the stream or throws an error
 *
 * @private
 * @param {Error} err
 */
Multiplexer.prototype._finalize = function(err) {
  if (err) {
    debug("[REPLICATION] destroyed due to", err)
    this.emit("error", err)
    this.stream.destroy(err)
  } else {
    debug("[REPLICATION] finalized", err)
    this.stream.finalize()
  }
}

/**
 * haveFeeds creates a manifest package with feed keys for sharing
 * 
 * @param {array[string]} keys Feed keys we want to share
 * @param {Object} opts not used
 */
Multiplexer.prototype.haveFeeds = function(keys, opts) {
  // Create manifest package
  var manifest = xtend(opts || {}, {
    // Add the keys we want to share to the manifest
    keys: extractKeys(keys),
  })

  debug("[REPLICATON] sending manifest: ", manifest, opts)

  // Store keys we want to share to _localHave
  this._localHave = manifest.keys

  // Send manifest as an extension to the stream
  this._feed.extension(MANIFEST, Buffer.from(JSON.stringify(manifest)))
}

// TODO: provide feature to share a secret set of keys that are available but not announced over the wire and can be secretly requested.
// Multiplexer.prototype.secretlyHaveFeeds = function (keys) { ... }

/**
 * wantFeeds creates a request for feeds with feed keys wanted
 *
 * @param {array[string]} keys Feed keys we want to receive
 */
Multiplexer.prototype.wantFeeds = function(keys) {
  keys = extractKeys(keys)
  debug("[REPLICATION] Sending feeds request", keys)

  // Send request for feeds as an extension
  this._feed.extension(REQUEST_FEEDS, Buffer.from(JSON.stringify(keys)))

  // Store wanted feeds as _localWant
  this._localWant = keys

  // Start replication
  this._initRepl()
}

/**
 * Compute a common feed exchange list to replicate, and start replication
 *
 * @returns
 */
Multiplexer.prototype._initRepl = function() {
  // this method is expected to be called twice, and will trigger
  // the 'replicate' event when both local and remote 'wants' are available.
  // calculating a sorted common denominator between both wants and availablility which
  // should result in two identical arrays being built on both ends using algorithm:
  //
  // formula:  feedsToReplicate = (lWant - (lWant - rHave)) + (rWant - (rWant - lHave ))
  //
  // The result honors that each node only shares what it offers and does not receive feeds that it didn't ask for.

  var self = this

  // If we don't want anything or peer doesn't want anything, we are done here
  if (!this._localWant || !this._remoteWants) return

  // the 'have' arrays might be null, It means that a client might not want
  // to share anything, and we can silently respect that.

  // Create a list of feeds that we will send by matching common feeds we have and peer wants
  var sending = self._remoteWants.filter(function(k) {
    return (self._localHave || []).indexOf(k) !== -1
  })

  // Create a list of feeds that we will be receiving by matching common feeds we want and peer has
  var receiving = self._localWant.filter(function(k) {
    return (self._remoteHas || []).indexOf(k) !== -1
  })

  // Concat sending and receiveing; produce sorted array with no duplicates
  var keys = sending
    .concat(receiving)
    .reduce(function(arr, key) {
      // remove duplicates
      if (arr.indexOf(key) === -1) arr.push(key)
      return arr
    }, [])
    .sort() // sort

  debug("[REPLICATION] _initRepl", keys.length, keys)

  // End immedietly if there's nothing to replicate.
  if (!this._opts.live && keys.length === 0) return this._finalize()

  // Tell everybody interested about the common set of keys and send reference to startFeedReplication function
  this.emit("replicate", keys, startFeedReplication)

  return keys

  /**
   * Creates replication stream from all of the streams provided
   *
   * @param {Multifeed|array[Multifeed]} feeds
   */
  function startFeedReplication(feeds) {
    if (!Array.isArray(feeds)) feeds = [ feeds ]
    self.stream.expectedFeeds = feeds.length
    // only the streams passed to `streams` option will be replicated (sent or received)
    // hypercore-protocol has built in protection against receiving unexpected/not asked for data.
    feeds.forEach(function(feed) {
      if (feed) {
        feed.ready(function() {
          // wait for each to be ready before replicating.
          debug("[REPLICATION] replicating feed:", feed.key.toString("hex"))
          feed.replicate(
            xtend(
              {},
              {
                live: self._opts.live,
                download: self._opts.download,
                upload: self._opts.upload,
                encrypt: self._opts.encrypt,
                stream: self.stream, // Uses shared multiplexer stream with all streams
              },
            ),
          )
        })
      }
    })
  }
}

/*'feed' event can be used to dynamically append feeds during live replication
 * or to provide a secret non-pre-negotiated feed.
 * Maybe send an ANNOUNCE_FEED message first containing the public-key in plain or encrypted form
 * so that we can provide a core here. Cool for cabal to be able to add feeds in live mode without having to
 * reconnect to a peer, true multifeed live replication.
 * (I don't have the brainpower to speculate what's needed for live-feed-removal right now)
Multiplexer.prototype._announceFeed = function (msg) {
  self.stream.once('feed', function(discoveryKey) {
    self.emit('announce-feed' , msg, function(feed){
      if (!feed) return // no feed provided = not interested.
      feed.replicate({stream: self.stream})
      stream.expectedFeeds++
    })
  })
}*/

module.exports = Multiplexer
module.exports.SupportedExtensions = SupportedExtensions

// String, String -> Boolean
function compatibleVersions(v1, v2) {
  var major1 = v1.split(".")[0]
  var major2 = v2.split(".")[0]
  return parseInt(major1) === parseInt(major2)
}

/**
 * Extracts keys from objects and buffers
 *
 * @param {string|array[Multifeed|Buffer]} keys List of feed keys
 * @returns
 */
function extractKeys(keys) {
  if (!Array.isArray(keys)) keys = [ keys ]
  return (keys = keys
    .map(function(o) {
      if (typeof o === "string") return o
      if (typeof o === "object" && o.key) return o.key.toString("hex")
      if (o instanceof Buffer) return o.toString("utf8")
    })
    .filter(function(o) {
      return !!o
    })) // remove invalid entries
}
