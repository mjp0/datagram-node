const ram = require('random-access-memory')
const tmp = require('tmp').tmpNameSync
const { error } = require('../utils')
const { create, load } = require('../core')
const definitions = require('../definitions/cores')

test('interface/meta', async () => {
  const core = await create({ definition: definitions.Meta, storage: ram }).catch(error)

  // Check that both expected interfaces for Meta core exist
  expect(typeof core.kv.set).toBe('function')
  expect(typeof core.meta.addCore).toBe('function')

  // Create admin core so we have something to store
  const admin = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  const admin_keys = await admin.getKeys().catch(error)

  // Let's add admin to meta core
  await core.meta.addCore(admin).catch(error)

  // Get all cores in meta and check that admin core is there
  let all_cores = await core.meta.getAllCores().catch(error)
  expect(all_cores[0].definition.datagramKey).toEqual(admin_keys.key.toString('hex'))

  // Let's add another core so that we can remove it and see if that works
  const to_be_removed_core = await create({ definition: definitions.Admin, storage: ram }).catch(error)
  const to_be_removed_core_keys = await to_be_removed_core.getKeys().catch(error)

  await core.meta.addCore(to_be_removed_core).catch(error)

  // Check that the core is added
  all_cores = await core.meta.getAllCores().catch(error)
  expect(all_cores[1].definition.datagramKey).toEqual(to_be_removed_core_keys.key.toString('hex'))

  // ... and remove the core
  await core.meta.removeCore(to_be_removed_core_keys.key.toString('hex')).catch(error)

  // Check that the core is removed
  all_cores = await core.meta.getAllCores().catch(error)
  expect(all_cores[1]).toBeFalsy()

  // Check that the core is added to the blocklist
  const blocklist = await core.meta.getBlocklist().catch(error)
  expect(blocklist[0]).toEqual(to_be_removed_core_keys.key.toString('hex'))
})

test('interface/meta/persistence', async () => {
  const storage = tmp()
  const metacore = await create({ definition: definitions.Meta, storage }).catch(error)
  const metacore_keys = await metacore.getKeys().catch(error)

  // Let's create two cores and store them into meta
  const core1 = await create({ definition: definitions.Admin, storage }).catch(error)
  const core1_keys = await core1.getKeys().catch(error)
  await metacore.meta.addCore(core1).catch(error)
  const core2 = await create({ definition: definitions.Admin, storage }).catch(error)
  const core2_keys = await core2.getKeys().catch(error)
  await metacore.meta.addCore(core2).catch(error)

  // Close the meta core
  await metacore.meta.close().catch(error)
  const metacore_cores = await metacore.meta.getCoreReferences().catch(error)
  expect(metacore_cores).toMatchObject({})

  // Let's see if we can open metacore as a second identical instance
  const metacore2 = await load({ keys: metacore_keys, storage }).catch(error)
  const all_unopened_cores = await metacore2.meta.getAllUnopenedCores().catch(error)

  // Initialize all unopened cores
  // TODO: move all this code in Container, it's its job to open these cores
  const q = []
  all_unopened_cores.forEach((core) => {
    q.push(
      new Promise(async (c_done, c_error) => {
        const loaded_c = await load({ keys: { key: Buffer.from(core.datagramKey, 'hex') }, storage }).catch(c_error)
        await metacore2.meta.attachCore(loaded_c).catch(c_error)
        c_done()
      }),
    )
  })
  await Promise.all(q)

  // All cores should be in core references now
  const metacore2_cores = await metacore2.meta.getCoreReferences().catch(error)
  expect(metacore2_cores[core1_keys.key.toString('hex')]).toBeTruthy()
  expect(metacore2_cores[core2_keys.key.toString('hex')]).toBeTruthy()
})
