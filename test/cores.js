const { create, load, clone } = require('../core')
const ram = require('random-access-memory')
const definitions = require('../definitions/cores')
const { error } = require('../utils')
const descriptors = require('../descriptors')
const async = require('async')
const tmp = require('tmp').tmpNameSync
const { getInterface } = require('../core/interfaces')

test('core/create', async () => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  expect(core.definition.name).toBe('Admin')
  const stored_definition = await core.getDefinition().catch(error)
  expect(stored_definition.name).toBe('Admin')
  expect(stored_definition.releaseDate).toBeTruthy()
})

test('core/add & get', async () => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  expect(core.definition.name).toBe('Admin')

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

  // Add it to the core
  await core.add(admin_auth).catch(error)

  // Admin auth package is the second after core definition so should be at position #1
  const stored_admin_auth = await core.get(1).catch(error)

  // Read package
  // NOTE: should this be done in core.get automatically? how common it is to pass on read
  // descriptor to another core as-is?
  const unpacked_admin_auth = await descriptors.read(stored_admin_auth).catch(error)
  expect(unpacked_admin_auth.recipient['@type']).toBe('User')
})

test('core/load', async () => {
  const storage = tmp()
  const core1 = await create({ definition: definitions.Meta, storage }).catch(error)
  expect(core1.definition.name).toBe('Meta')

  const core1_keys = await core1.getKeys().catch(error)

  const core2 = await load({ keys: core1_keys, storage }).catch(error)
  expect(core2.definition.name).toBe('Meta')
  expect(typeof core2.kv.set).toBe('function')
})

test('core/replication', async (done) => {
  expect.assertions(2)

  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  expect(core.definition.name).toBe('Admin')
  const keys = await core.getKeys().catch(error)

  const cloned_core = await clone({ keys, storage: ram }).catch(error)

  const rep_stream = await core.replicate()

  rep_stream.pipe(await cloned_core.replicate()).pipe(rep_stream).once('end', async () => {
    const definition = await cloned_core.getDefinition().catch(error)
    expect(definition.name).toBe('Admin')
    done()
  })
})

test('core/interfaces', async () => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  expect(core.definition.name).toBe('Admin')

  const kv = await getInterface('kv')
  await core.addInterface(kv).catch(error)
  expect(typeof core.kv.set).toBe('function')
})
