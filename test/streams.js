const { create, load, clone } = require('../src/streams')
const ram = require('random-access-memory')
const templates = require('../src/templates/streams')
const { generateUser, fromB58 } = require('../src/utils')
const descriptors = require('../src/descriptors')
const tmp = require('tmp').tmpNameSync
const { getInterface } = require('../src/streams/interfaces')
const expect = require('chai').expect
let user
;(async () => {
  user = await generateUser().catch(error)
  user.id = fromB58(user.id).toString('hex')
  user.password = fromB58(user.password).toString('hex')
})()

function error(err) {
  throw err
}

describe('stream', async () => {
  it('stream/create', async () => {
    const stream = await create({
      user_id: user.id,
      user_password: user.password,
      template: templates.admin,
      storage: ram,
    }).catch(error)
    expect(stream.template.name).equal('Admin')
    const stored_template = await stream.base.getTemplate().catch(error)
    expect(stored_template.name).equal('Admin')
    expect(stored_template.ReleaseDate).to.be.a('string')
  })

  it('stream/add & get', async () => {
    const stream = await create({
      user_id: user.id,
      user_password: user.password,
      template: templates.admin,
      storage: ram,
    }).catch(error)
    expect(stream.template.name).equal('Admin')

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
    expect(Buffer.isBuffer(admin_auth)).equal(true)

    // Add it to the stream
    const position = await stream.base.add(admin_auth).catch(error)

    // Admin auth package is the second after stream template so should be at position
    const stored_admin_auth = await stream.base.get(position).catch(error)

    // Read package
    // NOTE: should this be done in stream.base.get automatically? how common it is to pass on read
    // descriptor to another stream as-is?
    const unpacked_admin_auth = await descriptors.read(stored_admin_auth).catch(error)
    expect(unpacked_admin_auth.recipient['@type']).equal('User')
  })

  it('stream/load', async () => {
    const storage = tmp()
    const stream1 = await create({
      user_id: user.id,
      user_password: user.password,
      template: templates.admin,
      storage,
    }).catch(error)
    expect(stream1.template.name).equal('Admin')

    const stream1_keys = await stream1.base.getKeys().catch(error)
    const encryption_password = stream1_keys.encryption_password

    expect(await stream1.base.getUserId()).equal(user.id)
    expect(await stream1.base.getUserPassword()).equal(user.password)

    const tmpl = await stream1.base.getTemplate()
    expect(tmpl['@id']).equal('admin')

    const stream2 = await load(
      {
        keys: stream1_keys,
        storage,
        encryption_password,
        user_password: await stream1.base.getUserPassword().catch(error),
      },
      {
        user_id: user.id,
      },
    ).catch(error)
    expect(stream2).not.equal('NO_STREAM_FOUND_WITH_KEY')
    expect(stream2.template.name).equal('Admin')
    expect(typeof stream2.redis.set).equal('function')
  })

  it('stream/local replication', async () => {
    return new Promise(async (resolve, reject) => {
      const storage = tmp()

      const stream = await create({
        user_id: user.id,
        user_password: user.password,
        template: templates.admin,
        storage,
      }).catch(error)
      expect(stream.template.name).equal('Admin')
      const keys = await stream.base.getKeys().catch(error)
      const encryption_password = keys.encryption_password
      await stream.base.add(Buffer.from('bar'), { arguments: { key: 'foo' } }).catch(error)

      const cloned_stream = await clone(
        {
          keys,
          storage,
          encryption_password,
          user_id: user.id,
          user_password: user.password,
        },
        {},
      ).catch(error)

      const rep_stream = await stream.base.replicate()

      rep_stream.pipe(await cloned_stream.base.replicate()).pipe(rep_stream)
      setTimeout(checkToResult, 500)

      async function checkToResult() {
        try {
          const template = await cloned_stream.base.getTemplate()
          expect(template.name).equal('Admin')
          const foo = await cloned_stream.base.get('foo').catch(error)
          expect(foo.toString()).equal('bar')
          resolve()
        } catch (e) {
          console.error(e)
          expect(e).equal(null)
        }
      }
    })
  })

  it('stream/remote replication & authorization', async () => {
    return new Promise(async (resolve, reject) => {
      let stream = await create({
        user_id: user.id,
        user_password: user.password,
        template: templates.admin,
        storage: ram,
      }).catch(error)
      expect(stream.template.name).equal('Admin')
      const keys = await stream.base.getKeys().catch(error)
      
      // console.log(stream)
      await stream.redis.set('bar', 'foo').catch(error)

      stream.base.publish({ realtime: true }, () => {})

      let cloned_stream = await clone(
        {
          keys,
          storage: ram,
          encryption_password: keys.encryption_password,
          user_id: user.id,
          user_password: user.password,
        },
        { remote: true, realtime: true },
      ).catch(error)

      const template = await cloned_stream.base.getTemplate()
      expect(template.name).equal('Admin')
      const foo = await cloned_stream.redis.get('bar').catch(error)
      expect(foo.toString()).equal('foo')

      const cloned_keys = await cloned_stream.base.getKeys()

      await stream.base.authorize({ key: cloned_keys.auth }).catch(error)
      expect(await stream.base.isAuthorized({ key: cloned_keys.auth }).catch(error)).equal(true)

      setTimeout(async () => {
        await stream.redis.set('foo', 'bar').catch(error)

        const bar = await cloned_stream.redis.get('foo').catch(error)
        expect(bar.toString()).equal('bar')

        await cloned_stream.redis.set('foo2', 'bar2').catch(error)
        const bar2 = await stream.redis.get('foo2')
        expect(bar2.toString()).equal('bar2')

        cloned_stream.base.disconnect().catch(error)
        cloned_stream.base.close().catch(error)
        cloned_stream = null
        stream.base.disconnect().catch(error)
        stream.base.close().catch(error)
        stream = null
        resolve()
      }, 1000)
    })
  }).timeout(10000)

  it('stream/interfaces', async () => {
    const stream = await create({
      user_id: user.id,
      user_password: user.password,
      template: templates.admin,
      storage: ram,
    }).catch(error)
    expect(stream.template.name).equal('Admin')

    const blank = await getInterface('blank')
    await stream.base.addInterface(blank, {}).catch(error)
  })

  // it('stream/indexer', async () => {
  //   const stream = await create(
  //     { user_password: user.password, template: templates.admin, storage: ram },
  //     { user_id: user.id },
  //   ).catch(error)
  //   expect(stream.template.name).equal('Admin')

  //   // Let's create an admin authorization package for new admin
  //   const admin_auth = await descriptors
  //     .create('AuthorizeAction', {
  //       recipient: {
  //         '@type': 'User',
  //         key: 'g23gklas432avfke5AsfkajsdvDsa',
  //       },
  //       purpose: 'admin authorization',
  //       agent: {
  //         '@type': 'Owner',
  //         key: 'oweRfedavMdsaf41KLfdamdjSDFjkf',
  //       },
  //     })
  //     .catch(error)

  //   expect(Buffer.isBuffer(admin_auth)).equal(true)

  //   const key = '_test'
  //   const position = await stream.redis.set(key, admin_auth).catch(error)
  //   expect(position).toEqual(key)
  //   const stored_index_package = await stream.index.redis.get(key).catch(error)
  //   // const unpacked_index_package = await descriptors.read(stored_index_package).catch(error)
  //   expect(stored_index_package.arguments).toEqual({ key: key, action: '+' })

  //   const is_removed = await stream.index.indexer.removeRow({ key: key })
  //   expect(is_removed).equal(true)

  //   const removal_package = await stream.index.get(2).catch(error)
  //   expect(removal_package).equal(true) // this could be improved
  // })
})
