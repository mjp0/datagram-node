const ram = require('random-access-memory')
const tmp = require('tmp').tmpNameSync
const { error, generateUser } = require('../src/utils')
const { create, load } = require('../src/streams')
const templates = require('../src/templates/streams')

let user

describe('stream', async () => {
  beforeAll(async () => {
    user = await generateUser().catch(error)
  })
  test('interface/meta', async () => {
    const stream = await create(
      { user_password: user.secret, template: templates.meta, storage: ram },
      { owner_public_key: user.key },
    ).catch(error)

    // Check that both expected interfaces for Meta stream exist
    expect(typeof stream.redis.set).toBe('function')
    expect(typeof stream.meta.addStream).toBe('function')

    // Create admin stream so we have something to store
    const admin = await create(
      { user_password: user.secret, template: templates.admin, storage: ram },
      { owner_public_key: user.key },
    ).catch(error)
    const admin_keys = await admin.getKeys().catch(error)

    // Let's add admin to meta stream
    await stream.meta.addStream(admin).catch(error)

    // Get all streams in meta and check that admin stream is there
    let all_streams = await stream.meta.getAllStreams().catch(error)
    expect(all_streams[0].template.DatagramKey).toEqual(admin_keys.key.toString('hex'))

    // Let's add another stream so that we can remove it and see if that works
    const to_be_removed_stream = await create(
      { user_password: user.secret, template: templates.admin, storage: ram },
      { owner_public_key: user.key },
    ).catch(error)
    const to_be_removed_stream_keys = await to_be_removed_stream.getKeys().catch(error)

    await stream.meta.addStream(to_be_removed_stream).catch(error)

    // Check that the stream is added
    all_streams = await stream.meta.getAllStreams().catch(error)
    expect(all_streams[0].template.DatagramKey).toEqual(to_be_removed_stream_keys.key.toString('hex'))

    // ... and remove the stream
    await stream.meta.removeStream(to_be_removed_stream_keys.key.toString('hex')).catch(error)

    // Check that the stream is removed
    all_streams = await stream.meta.getAllStreams().catch(error)
    expect(all_streams[1]).toBeFalsy()

    // Check that the stream is added to the blocklist
    const blocklist = await stream.meta.getBlocklist().catch(error)
    expect(blocklist[0]).toEqual(to_be_removed_stream_keys.key.toString('hex'))
  })

  test('interface/meta/persistence', async () => {
    const storage = tmp()
    const metastream = await create(
      { user_password: user.secret, template: templates.meta, storage },
      { owner_public_key: user.key },
    ).catch(error)
    const metastream_keys = await metastream.getKeys().catch(error)
    const metastream_password = await metastream.getPassword().catch(error)

    // Let's create two streams and store them into meta
    const stream1 = await create(
      { user_password: user.secret, template: templates.admin, storage },
      { owner_public_key: user.key },
    ).catch(error)
    const stream1_keys = await stream1.getKeys().catch(error)
    await metastream.meta.addStream(stream1).catch(error)
    const stream2 = await create(
      { user_password: user.secret, template: templates.meta, storage },
      { owner_public_key: user.key },
    ).catch(error)
    const stream2_keys = await stream2.getKeys().catch(error)
    await metastream.meta.addStream(stream2).catch(error)

    // Close the meta stream
    await metastream.meta.close().catch(error)
    const metastream_streams = await metastream.meta.getStreamReferences().catch(error)
    expect(metastream_streams).toMatchObject({})

    // Let's see if we can open metastream as a second identical instance
    const metastream2 = await load(
      {
        keys: metastream_keys,
        storage,
        user_password: user.secret,
        password: metastream_password,
      },
      { owner_public_key: user.key },
    ).catch(error)
    const all_unopened_streams = await metastream2.meta.getAllUnopenedStreams().catch(error)

    // Initialize all unopened streams
    // TODO: move all this code in Container, it's its job to open these streams
    const q = []
    all_unopened_streams.forEach((stream) => {
      q.push(
        new Promise(async (c_done, c_error) => {
          let password = null
          if (stream.DatagramKey === stream1_keys.key.toString('hex')) {
            password = await stream1.getPassword().catch(error)
          }
          if (stream.DatagramKey === stream2_keys.key.toString('hex')) {
            password = await stream2.getPassword().catch(error)
          }
          const loaded_c = await load(
            {
              keys: { key: Buffer.from(stream.DatagramKey, 'hex') },
              storage,
              user_password: user.secret,
              password,
            },
            { owner_public_key: user.key },
          ).catch(c_error)
          if (!loaded_c) c_error(new Error('UNABLE_TO_LOAD_STREAM'))
          await metastream2.meta.attachStream(loaded_c).catch(c_error)
          c_done()
        }),
      )
    })
    await Promise.all(q)

    // All streams should be in stream references now
    const metastream2_streams = await metastream2.meta.getStreamReferences().catch(error)
    expect(metastream2_streams[stream1_keys.key.toString('hex')]).toBeTruthy()
    expect(metastream2_streams[stream2_keys.key.toString('hex')]).toBeTruthy()
  })
})
