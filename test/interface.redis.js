const ram = require('random-access-memory')
const { error, generateUser } = require('../src/utils')
const { getInterface } = require('../src/streams/interfaces')
const { create } = require('../src/streams')
const templates = require('../src/templates/streams')
const expect = require('chai').expect

let user
;(async () => {
  user = await generateUser().catch(error)
})()

describe('stream', async () => {
  it('interface/redis', async () => {
    const templ = templates.replication
    templ.interfaces = [ 'blank' ]
    const stream = await create({
      user_id: user.id,
      user_password: user.password,
      template: templates.replication,
      storage: ram,
    }).catch(error)

    // Add key/value interface
    const redis = await getInterface('redis')
    await stream.addInterface(redis).catch(error)
    expect(typeof stream.redis.set).equal('function')

    // Add foo=bar
    const pos = await stream.redis.set('foo', 'bar').catch(error)
    expect(pos).equal('foo')

    // Verify foo === bar
    const foo = await stream.redis.get('foo').catch(error)
    expect(foo).equal('bar')

    // Verify foo exists in all keys
    const all_keys = await stream.redis.getAllKeys().catch(error)
    expect(all_keys[0]).equal('foo')

    // Remove foo
    await stream.redis.rem('foo').catch(error)

    // Verify foo is gone
    const non_foo = await stream.redis.get('foo').catch(error)
    expect(non_foo).equal(undefined)

    // Verify all keys is empty
    const empty_all_keys = await stream.redis.getAllKeys().catch(error)
    expect(empty_all_keys).to.have.length(1) // _template is still there
  })
})
