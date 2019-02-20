const ram = require('random-access-memory')
const { error, generateUser } = require('../src/utils')
const { getInterface } = require('../src/streams/interfaces')
const { create } = require('../src/streams')
const templates = require('../src/templates/streams')

let user

describe('stream', async () => {
  beforeAll(async () => {
    user = await generateUser().catch(error)
  })
  test('interface/redis', async () => {
    const templ = templates.replication
    templ.interfaces = [ 'meta' ]
    const stream = await create({ template: templates.replication, storage: ram, user_password: user.secret }, { owner_public_key: user.key }).catch(error)

    // Add key/value interface
    const redis = await getInterface('redis')
    await stream.addInterface(redis).catch(error)
    expect(typeof stream.redis.set).toBe('function')

    // Add foo=bar
    const pos = await stream.redis.set('foo', 'bar').catch(error)
    expect(pos).toBe('foo')

    // Verify foo === bar
    const foo = await stream.redis.get('foo').catch(error)
    expect(foo).toBe('bar')

    // Verify foo exists in all keys
    const all_keys = await stream.redis.getAllKeys().catch(error)
    expect(all_keys[0]).toBe('foo')

    // Remove foo
    await stream.redis.rem('foo').catch(error)

    // Verify foo is gone
    const non_foo = await stream.redis.get('foo').catch(error)
    expect(non_foo).toBeFalsy()

    // Verify all keys is empty
    const empty_all_keys = await stream.redis.getAllKeys().catch(error)
    expect(empty_all_keys).toHaveLength(1) // _template is still there
  })
})
