const promcall = require('promised-callback').default
const raf = require('random-access-file')
const path = require('path')
const { log } = require('../utils/debug')(__filename)
const { replicate } = require('./replicate')
const { deriveKeyPair, errors, checkVariables } = require('../utils')
const home = require('home')
const stream_templates = require('../templates/streams')
const { create, load } = require('../streams')
const _ = require('lodash')

module.exports = container

// one-to-non = expect streams only from me
// one-to-one = expect streams from two users, one for me and one for you
// one-to-many = expect streams from anybody but allow me to choose
// many-to-many = everybody can add their streams freely

/**
 * Creates a container instance based on provided hypercore
 */
async function container(args = { password: null, user_id: null }, opts = { template: null, storage: null }) {
  return new Promise(async (done, error) => {
    // Check variables
    const missing = checkVariables(args, [ 'password', 'user_id' ])
    if (missing) return error(errors.MISSING_VARIABLES, { missing, args })

    this._container_password = args.password
    /*
    ███████████████████████████████████████████████████████████████████████████████████████╗
    ╚══════════════════════════════════════════════════════════════════════════════════════╝

    ███████╗███████╗████████╗██╗   ██╗██████╗
    ██╔════╝██╔════╝╚══██╔══╝██║   ██║██╔══██╗
    ███████╗█████╗     ██║   ██║   ██║██████╔╝
    ╚════██║██╔══╝     ██║   ██║   ██║██╔═══╝
    ███████║███████╗   ██║   ╚██████╔╝██║
    ╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝

    */

    const self = this
    const USERS = [
      {
        you: true,
        user_id: args.user_id,
        streams: [],
      },
    ]

    // If no storage path provided, store to .datagram under home path
    this._storage = opts.storage || `${home()}/.datagram/`

    // Used by replication, should be replaced with utils/storage/_open_storage at some point
    this._open_storage = function(dir) {
      return function(name) {
        const s = self._storage
        if (typeof self._storage === 'string') return raf(path.join(self._storage, dir, name))
        else return s(dir + '/' + name)
      }
    }

    /*
    ███████████████████████████████████████████████████████████████████████████████████████╗
    ╚══════════════════════════════════════════════════════════════════════════════════════╝

    ███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗███████╗
    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔════╝
    ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║███████╗
    ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║╚════██║
    ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████║
    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝

    */
    const STREAMS = {
      admin: {
        status: 'uninitiliazed',
        sharemodel: 'one-to-many',
        streams: [],
        settings: {},
      },
      meta: {
        status: 'uninitiliazed',
        sharemodel: 'one-to-non',
        streams: [],
        settings: {},
      },
      replication: {
        status: 'uninitiliazed',
        sharemodel: 'one-to-many',
        streams: [],
        settings: {},
      },
    }

    // Remove internal streams from setup if present and get the rest
    const t = opts.template
    const stream_names = _(t.streams)
      .map((s) => {
        return s['@type']
      })
      .reject((s) => s.match(/$meta^|$admin^/))
      .uniq()
      .value()

    // Get the stream definitions
    t.streams.forEach((s) => {
      // If stream is in the list, create a STREAM listing
      if (stream_names.indexOf(s['@type']) !== -1) {
        STREAMS[s['@type']] = {
          status: 'ready',
          sharemodel: s.sharemodel,
          streams: [],
          settings: s.settings || {},
        }
      } else {
        return error(new Error(errors.STREAM_MISSING))
      }
    })

    /*
    ███████████████████████████████████████████████████████████████████████████████████████╗
    ╚══════════════════════════════════════════════════════════════════════════════════════╝

    ██╗  ██╗███████╗██╗   ██╗███████╗
    ██║ ██╔╝██╔════╝╚██╗ ██╔╝██╔════╝
    █████╔╝ █████╗   ╚████╔╝ ███████╗
    ██╔═██╗ ██╔══╝    ╚██╔╝  ╚════██║
    ██║  ██╗███████╗   ██║   ███████║
    ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝

    */

    log('Generating keys for replication stream...')
    const replication_keypair = await deriveKeyPair({
      master_key: Buffer.from(this._container_password + 'replication'),
    }).catch(error)

    // First try to open the replication stream, if it's not there, create a new one
    let replication_stream = await load({ keys: replication_keypair, storage: self._storage }).catch(error)

    if (!replication_stream) {
      log('Existing replication stream not found, creating a new one...')
      const template = stream_templates.replication
      if (!template) return error(errors.CALL_TO_MISSING_STREAM_TEMPLATE)
      STREAMS.replication.streams.push(
        (replication_stream = await create({ template, storage: self._storage }, { keys: replication_keypair }).catch(
          error,
        )),
      )
    } else {
      log('Existing replication stream found...')
      STREAMS.replication.streams.push(replication_stream)
    }
    STREAMS.replication.status = 'ready'

    // If template is null, this is an existing container.

    // If this is an existing container, open meta-stream and it will re-create the feeds
    // don't forget to fetch template

    log('Generating keys for meta stream...')
    const metastream_keypair = await deriveKeyPair({
      master_key: Buffer.from(this._container_password + 'metastream'),
    }).catch(error)

    // First try to open the meta stream, if it's not there, create a new one
    let meta_stream = await load({ keys: metastream_keypair, storage: self._storage }).catch(error)

    if (!meta_stream) {
      log('Existing meta stream not found, creating a new one...')
      STREAMS.meta.streams.push(
        (meta_stream = await create(
          { template: stream_templates.meta, storage: self._storage },
          { keys: metastream_keypair, index: false },
        ).catch(error)),
      )
    } else {
      log('Existing meta stream found...')
      STREAMS.meta.streams.push(meta_stream)
    }
    STREAMS.meta.status = 'ready'

    /*
    ███████████████████████████████████████████████████████████████████████████████████████╗
    ╚══════════════════════════════════════════════════════════════════════════════════════╝

     █████╗ ██████╗ ██╗
    ██╔══██╗██╔══██╗██║
    ███████║██████╔╝██║
    ██╔══██║██╔═══╝ ██║
    ██║  ██║██║     ██║
    ╚═╝  ╚═╝╚═╝     ╚═╝

    */

    const API = {
      replicate: async (args, callback) => {
        return new Promise(async (resolve, reject) => {
          const { done } = promcall(resolve, reject, callback)
          done(replicate(API, replication_stream, opts))
        })
      },
      getUsers: async () => {
        return new Promise(async (done, error) => {
          done(USERS)
        })
      },
      getStreams: async () => {
        return new Promise(async (done, error) => {
          done(STREAMS)
        })
      },
      addStream: async (args = { type: null, user_id: null, stream_source: null }) => {
        return new Promise(async (done, error) => {
          const err = checkVariables(args, [ 'type', 'user_id', 'stream_source' ])
          if (err) return error(new Error(err))

          const stream_keys = await args.stream_source.getKeys().catch(error)
          if (!stream_keys.key) return error(new Error(errors.KEYS_MISSING))

          // Check if user_id exists
          const known_user = _.find(USERS, (u) => u.user_id === args.user_id)
          if (known_user.length > 0) {
            log(`User is know. Associating user with this stream...`)
            const known_user_index = _.findIndex(USERS, (u) => u.user_id === args.user_id)
            USERS[known_user_index].streams.push(stream_keys.key)
          } else {
            log(`User is not known. Creating a new user and associating with this stream...`)
            const new_user = {
              user_id: args.user_id,
              streams: [ stream_keys.key ],
            }
            USERS.push(new_user)
          }

          log(`Finding a stream template based on given type ${args.type}`)

          const template = stream_templates[args.type]
          if (!template) return error(new Error(errors.TEMPLATE_MISSING))

          log(`Creating a new stream based on template ${template['@id']}`)
          const stream = await create({ template, storage: self._storage }).catch(error)

          if (stream) {
            await meta_stream.meta.addCore(stream).catch(error)
            STREAMS[args.type].streams.push(stream)

            // PIPE STREAM_SOURCE TO THE STREAM USING DESCRIPTORS, INDEXING AND ENCRYPTION
            /*
            */
          } else return error(new Error(errors.STREAM_MISSING))

          done(stream)
        })
      },
    }

    /*
    ███████████████████████████████████████████████████████████████████████████████████████╗
    ╚══════════════════════════════════════════════════════════════════════════════════════╝
    */

    const all_unopened_streams = await meta_stream.meta.getAllUnopenedCores().catch(error)

    if (all_unopened_streams.length > 0) {
      /*
      ██████╗ ███████╗███████╗████████╗ ██████╗ ██████╗ ███████╗
      ██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝
      ██████╔╝█████╗  ███████╗   ██║   ██║   ██║██████╔╝█████╗
      ██╔══██╗██╔══╝  ╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝
      ██║  ██║███████╗███████║   ██║   ╚██████╔╝██║  ██║███████╗
      ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
      */

      log(`Restoring ${all_unopened_streams.length} streams...`)
      const q = []
      all_unopened_streams.forEach((stream) => {
        q.push(
          new Promise(async (c_done, c_error) => {
            const loaded_c = await load({
              keys: { key: Buffer.from(self._metastream_opts.key, 'hex') },
              storage: self._storage, // this could be any RAS
            }).catch(c_error)
            await meta_stream.meta.attachCore(loaded_c).catch(c_error)
            console.log(loaded_c)
            c_done()
          }),
        )
      })
      await Promise.all(q)
      done(API)
    } else if (all_unopened_streams.length === 0) {
      /*
      ██████╗ ██╗   ██╗██╗██╗     ██████╗ ███████╗██████╗
      ██╔══██╗██║   ██║██║██║     ██╔══██╗██╔════╝██╔══██╗
      ██████╔╝██║   ██║██║██║     ██║  ██║█████╗  ██████╔╝
      ██╔══██╗██║   ██║██║██║     ██║  ██║██╔══╝  ██╔══██╗
      ██████╔╝╚██████╔╝██║███████╗██████╔╝███████╗██║  ██║
      ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝
      */

      // log(`Creating index stream...`)
      // const index = await create(
      //   { template: stream_templates.index, storage: self._storage },
      //   { keys },
      // ).catch(error)
      // if (index) {
      //   await meta_stream.meta.addCore(index).catch(error)
      //   STREAMS.index.streams.push(index)
      //   STREAMS.index.status = 'ready'
      //   const index_keys = await index.getKeys().catch(error)
      //   USERS[0].streams.push(index_keys.key)
      // } else return error(new Error(errors.ADMIN_STREAM_MISSING))

      log(`Creating admin stream...`)
      const admin = await create({ template: stream_templates.admin, storage: self._storage }).catch(error)

      if (admin) {
        await meta_stream.meta.addCore(admin).catch(error)
        STREAMS.admin.streams.push(admin)
        STREAMS.admin.status = 'ready'
        const admin_keys = await admin.getKeys().catch(error)
        USERS[0].streams.push(admin_keys.key)
      } else return error(new Error(errors.ADMIN_STREAM_MISSING))

      done(API)
    } else {
      // This state should not happen
      error(new Error('UNKNOWN_STATE'))
    }

    // Makes sure everything necessary is executed before container is allowed to be used
    // this._ready = readyify(function(done) {
    //   log('Creating new container', self.key)

    // If template is null, this is likely an existing container

    // If this is an existing container, open meta-stream and it will re-create the feeds
    // don't forget to fetch template

    // First try to open the meta stream, if it's not there, create a new one
    // waterfall([
    //   (next) => {
    //     meta_stream.open(self._storage, self._metastream_opts, (err, MC) => {
    //       if (err) return done(err)
    //       // If we have a key, we exist
    //       if (MC && MC.key) next(null, MC)
    //       else next(null, null)
    //     })
    //   },
    //   (MC, next) => {
    //     if (!MC) {
    //       // Make sure we have the template
    //       if (!self.template) throw new Error('DEFINITION_REQUIRED')

    //       meta_stream.create(
    //         { template: { id: 'meta' }, storage: self._storage },
    //         { opts: self._metastream_opts },
    //         (err, MC) => {
    //           if (err) return done(err)
    //           // If we have a key, we exist
    //           if (MC && MC.key) next(null, MC)
    //         },
    //       )
    //     } else next(null, MC)
    //   },
    //   (MC, next) => {
    //     log(MC)
    //     generateAPI(MC)
    //     MC.load_streams_from_storage((err) => {
    //       if (err) return done(err)
    //       MC.export_legacy((err, streams) => {
    //         if (err) return done(err)
    //         self._streams = streams._streams
    //         self._streamKeyToCore = streams._streamKeyToCore
    //         done()
    //       })
    //     })
    //   },
    // ])

    // function generateAPI(meta_stream) {
    //   self.add_stream = (name, type, callback) => {
    //     meta_stream.add_stream(name, type, (err, stream) => {
    //       if (err) return callback(err)
    //       self.update_legacy((err) => {
    //         if (err) return callback(err)
    //         callback(err, stream)
    //       })
    //     })
    //   }
    //   self.attach_stream = (name, hypercore, type, callback) => {
    //     meta_stream.attach_stream(name, hypercore, type, (err, stream) => {
    //       if (err) return callback(err)
    //       self.update_legacy((err) => {
    //         if (err) return callback(err)
    //         callback(err, stream)
    //       })
    //     })
    //   }
    //   self.update_legacy = (callback) => {
    //     meta_stream.export_legacy((err, streams) => {
    //       if (err) return callback(err)
    //       self._streams = streams._streams
    //       self._streamKeyToCore = streams._streamKeyToCore
    //       callback()
    //     })
    //   }
    //   self.open_stream = meta_stream.open_stream
    //   self.streams = meta_stream.get_all_streams
    //   self.get_streams = meta_stream.get_all_streams
    //   self.attach_stream = meta_stream.attach_stream
    //   self.remove_stream = meta_stream.remove_stream
    //   self.get_blocklist = meta_stream.get_blocklist
    //   self.replicate = function(opts) {
    //     return replicate(self, meta_stream, opts)
    //   }
    //   self.stream = (key) => {
    //     if (Buffer.isBuffer(key)) key = key.toString('hex')
    //     done(meta_stream.stream_references[key])
    //   }
    // }
    // })

    // this.ready = function(cb) {
    //   self._ready(cb)
    // }
    return API
  })
}

/**
 * Add replication policy functions
 *
 * @param {Object} plug Replication policy object
 * @param {Function} plug.init init(container) Called with container.ready, useful for initialization if needed
 */
// container.prototype.use = function(plug) {
//   if (this._middleware === null) this._middleware = []

//   // Store replication policy object to _middleware
//   this._middleware.push(plug)
//   const self = this

//   // If policy contains function init, run it when container is getting ready
//   if (typeof plug.init === 'function') {
//     this.ready(function() {
//       plug.init(self)
//     })
//   }
// }
