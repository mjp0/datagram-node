const { create, load, clone } = require('../src/streams')
const ram = require('random-access-memory')
const templates = require('../src/templates/streams')
const { error } = require('../src/utils')
const descriptors = require('../src/descriptors')
const async = require('async')
const tmp = require('tmp').tmpNameSync
const { getInterface } = require('../src/streams/interfaces')

test('stream/create', async () => {
  const stream = await create({ template: templates.admin, storage: ram }).catch(error)
  expect(stream.template.name).toBe('Admin')
  const stored_template = await stream.getTemplate().catch(error)
  expect(stored_template.name).toBe('Admin')
  expect(stored_template.releaseDate).toBeTruthy()
})

test('stream/add & get', async () => {
  const stream = await create({ template: templates.admin, storage: ram }).catch(error)
  expect(stream.template.name).toBe('Admin')

  // Let's create an admin authorization package for new admin
  const admin_auth = await descriptors
    .create('AuthorizeAction', {
      recipient: {
        '@type': 'User',
        key: 'g23gklas432avfke5AsfkajsdvDsa',
      },
      purpose: 'admin authorization',
      agent: {
        '@type': 'Owner',
        key: 'oweRfedavMdsaf41KLfdamdjSDFjkf',
      },
    })
    .catch(error)
  expect(Buffer.isBuffer(admin_auth)).toBeTruthy()

  // Add it to the stream
  await stream.add(admin_auth).catch(error)

  // Admin auth package is the second after stream template so should be at position #1
  const stored_admin_auth = await stream.get(1).catch(error)

  // Read package
  // NOTE: should this be done in stream.get automatically? how common it is to pass on read
  // descriptor to another stream as-is?
  const unpacked_admin_auth = await descriptors.read(stored_admin_auth).catch(error)
  expect(unpacked_admin_auth.recipient['@type']).toBe('User')
})

test('stream/load', async () => {
  const storage = tmp()
  const stream1 = await create({ template: templates.meta, storage }).catch(error)
  expect(stream1.template.name).toBe('Meta')

  const stream1_keys = await stream1.getKeys().catch(error)

  const stream2 = await load({ keys: stream1_keys, storage }).catch(error)
  expect(stream2.template.name).toBe('Meta')
  expect(typeof stream2.redis.set).toBe('function')
})

test('stream/replication', async (done) => {
  expect.assertions(2)

  const stream = await create({ template: templates.admin, storage: ram }).catch(error)
  expect(stream.template.name).toBe('Admin')
  const keys = await stream.getKeys().catch(error)

  const cloned_stream = await clone({ keys, storage: ram }).catch(error)

  const rep_stream = await stream.replicate()

  rep_stream.pipe(await cloned_stream.replicate()).pipe(rep_stream).once('end', async () => {
    const template = await cloned_stream.getTemplate().catch(error)
    expect(template.name).toBe('Admin')
    done()
  })
})

test('stream/interfaces', async () => {
  const stream = await create({ template: templates.admin, storage: ram }).catch(error)
  expect(stream.template.name).toBe('Admin')

  const meta = await getInterface('meta')
  await stream.addInterface(meta).catch(error)
  expect(typeof stream.meta.close).toBe('function')
})

test('stream/indexer', async () => {
  const stream = await create({ template: templates.admin, storage: ram }).catch(error)
  expect(stream.template.name).toBe('Admin')

  // Let's create an admin authorization package for new admin
  const admin_auth = await descriptors
    .create('AuthorizeAction', {
      recipient: {
        '@type': 'User',
        key: 'g23gklas432avfke5AsfkajsdvDsa',
      },
      purpose: 'admin authorization',
      agent: {
        '@type': 'Owner',
        key: 'oweRfedavMdsaf41KLfdamdjSDFjkf',
      },
    })
    .catch(error)

  expect(Buffer.isBuffer(admin_auth)).toBeTruthy()

  await stream.redis.set('test', admin_auth).catch(error)

  const stored_index_package = await stream.index.redis.get('test').catch(error)
  const unpacked_index_package = await descriptors.read(stored_index_package).catch(error)
  expect(unpacked_index_package.defaultValue).toEqual({ position: 1, size: 810 })

  const is_removed = await stream.index.indexer.removeRow({ key: 'test' })
  expect(is_removed).toBeTruthy()

  const removal_package = await stream.index.get(2).catch(error)
  expect(removal_package).toBeTruthy() // this could be improved
})
