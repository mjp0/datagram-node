const test = require('tape')
const { create, load, clone } = require('../core')
const ram = require('random-access-memory')
const definitions = require('../definitions/cores')
const { error } = require('../utils')
const descriptors = require('../descriptors')
const async = require('async')
const tmp = require('tmp').tmpNameSync
const { kv } = require('../core/interfaces')

test('core/create', async (t) => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  t.equal(core.definition.name, 'Admin', 'core type matches')
  const stored_definition = await core.getDefinition().catch(error)
  t.equal(stored_definition.name, 'Admin', 'definition name matches')
  t.true(stored_definition.releaseDate, 'releaseDate exists')
  t.end()
})

test('core/add & get', async (t) => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  t.equal(core.definition.name, 'Admin', 'core type matches')

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
  t.true(Buffer.isBuffer(admin_auth), 'admin_auth is buffer')

  // Add it to the core
  await core.add(admin_auth).catch(error)

  // Admin auth package is the second after core definition so should be at position #1
  const stored_admin_auth = await core.get(1).catch(error)

  // Read package
  // NOTE: should this be done in core.get automatically? how common it is to pass on read
  // descriptor to another core as-is?
  const unpacked_admin_auth = await descriptors.read(stored_admin_auth).catch(error)
  t.equal(unpacked_admin_auth.recipient['@type'], 'User', 'described data is readable')
  t.end()
})

test('core/load', async (t) => {
  const storage = tmp()
  const core1 = await create({ definition: definitions.Admin, storage }).catch(error)
  t.equal(core1.definition.name, 'Admin', 'core1 type matches')

  const core1_keys = await core1.getKeys().catch(error)

  const core2 = await load({ keys: core1_keys, storage }).catch(error)
  t.equal(core2.definition.name, 'Admin', 'core2 type matches')

  t.end()
})

test('core/replication', async (t) => {
  t.plan(2)

  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  t.equal(core.definition.name, 'Admin', 'core type matches')
  const keys = await core.getKeys().catch(error)

  const cloned_core = await clone({ keys, storage: ram }).catch(error)

  const rep_stream = await core.replicate()

  rep_stream.pipe(await cloned_core.replicate()).pipe(rep_stream).once('end', async () => {
    const definition = await cloned_core.getDefinition().catch(error)
    t.equal(definition.name, 'Admin', 'core type matches')
  })
})

test('core/interfaces', async (t) => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  t.equal(core.definition.name, 'Admin', 'core type matches')

  await core.addInterface(kv).catch(error)
  t.equal(typeof core.kv.set, 'function', 'kv.set method found')

  t.end()
})
