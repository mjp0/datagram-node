const ram = require('random-access-memory')
const { error, generateUser, fromB58 } = require('../src/utils')
const { getInterface } = require('../src/streams/interfaces')
const { create } = require('../src/streams')
const templates = require('../src/templates/streams')
const expect = require('chai').expect

let user
;(async () => {
  user = await generateUser().catch(error)
  user.id = fromB58(user.id).toString('hex')
  user.password = fromB58(user.password).toString('hex')
})()

describe('interfaces', async () => {
  it('interface/redis', async () => {
    try {
      const templ = templates.replication
      templ.interfaces = [ 'blank' ]
      const stream = await create({
        user_id: user.id,
        user_password: user.password,
        template: templates.replication,
        storage: ram,
      })

      // Add key/value interface
      const redis = await getInterface('redis')
      await stream.base.addInterface(redis, stream)
      expect(typeof stream.redis.set).equal('function')

      // Add foo=bar
      const pos = await stream.redis.set('foo', 'bar')
      expect(pos).equal('foo')

      // Verify foo === bar
      const foo = await stream.redis.get('foo')
      expect(foo).equal('bar')

      // Verify foo exists in all keys
      const all_keys = await stream.redis.getAllKeys()
      expect(all_keys[0]).equal('foo')

      // Remove foo
      await stream.redis.rem('foo')

      // Verify foo is gone
      const non_foo = await stream.redis.get('foo')
      expect(non_foo).equal(undefined)

      // Verify all keys is empty
      const empty_all_keys = await stream.redis.getAllKeys()
      expect(empty_all_keys).to.have.length(1) // _template is still there
    } catch (err) {
      expect(err).equal(undefined)
    }
  })
})
