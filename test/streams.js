const { create, load, clone } = require('../src/streams')
const ram = require('random-access-memory')
const templates = require('../src/templates/streams')
const { generateUser } = require('../src/utils')
const descriptors = require('../src/descriptors')
const async = require('async')
const tmp = require('tmp').tmpNameSync
const { getInterface } = require('../src/streams/interfaces')
const expect = require('chai').expect
let user
;(async () => {
  user = await generateUser().catch(error)
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
    const stored_template = await stream.getTemplate().catch(error)
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
    const position = await stream.add(admin_auth).catch(error)

    // Admin auth package is the second after stream template so should be at position
    const stored_admin_auth = await stream.get(position).catch(error)

    // Read package
    // NOTE: should this be done in stream.get automatically? how common it is to pass on read
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

    const stream1_keys = await stream1.getKeys().catch(error)

    expect(await stream1.getUserId()).equal(user.id)
    expect(await stream1.getUserPassword()).equal(user.password)

    const stream2 = await load(
      {
        keys: stream1_keys,
        storage,
        encryption_password: await stream1.getUserId().catch(error),
        user_password: await stream1.getUserPassword().catch(error),
      },
      {
        user_id: user.id,
      },
    ).catch(error)
    expect(stream2.template.name).equal('Admin')
    expect(typeof stream2.redis.set).equal('function')
  })

  it('stream/local replication', async () => {
    return new Promise(async (resolve, reject) => {
      const stream = await create({
        user_id: user.id,
        user_password: user.password,
        template: templates.admin,
        storage: ram,
      }).catch(error)
      expect(stream.template.name).equal('Admin')
      const keys = await stream.getKeys().catch(error)

      await stream.add(Buffer.from('bar'), { arguments: { key: 'foo' } }).catch(error)

      const cloned_stream = await clone(
        {
          keys,
          storage: ram,
          encryption_password: await stream.getUserId().catch(error),
        },
        { user_id: user.id },
      ).catch(error)

      const rep_stream = await stream.replicate()

      rep_stream.pipe(await cloned_stream.replicate()).pipe(rep_stream)
      setTimeout(checkToResult, 500)

      async function checkToResult() {
        try {
          const template = await cloned_stream.getTemplate()
          expect(template.name).equal('Admin')
          const foo = await cloned_stream.get('foo').catch(error)
          expect(foo.toString()).equal('bar')
          resolve()
        } catch (e) {
          console.error(e)
          expect(e).equal(null)
        }
      }
    })
  })

  it('stream/remote replication', async () => {
    return new Promise(async (resolve, reject) => {
      let stream = await create({
        user_id: user.id,
        user_password: user.password,
        template: templates.admin,
        storage: ram,
      }).catch(error)
      expect(stream.template.name).equal('Admin')
      const keys = await stream.getKeys().catch(error)

      await stream.add(Buffer.from('bar'), { arguments: { key: 'foo' } }).catch(error)

      await stream.publish().catch(error)

      let cloned_stream = await clone(
        {
          keys,
          storage: ram,
          encryption_password: await stream.getUserId().catch(error),
        },
        { user_id: user.id, remote: true },
      ).catch(error)

      setTimeout(checkToResult, 1000)

      async function checkToResult() {
        try {
          const template = await cloned_stream.getTemplate()
          expect(template.name).equal('Admin')
          const foo = await cloned_stream.get('foo').catch(error)
          expect(foo.toString()).equal('bar')
          
          cloned_stream.disconnect().catch(error)
          cloned_stream.close().catch(error)
          cloned_stream = null
          stream.disconnect().catch(error)
          stream.close().catch(error)
          stream = null
          resolve()          
        } catch (e) {
          console.error(e)
          expect(e).equal(null)
        }
      }
    })
  }).timeout(10000)

  it('stream/authorization', async () => {
    const stream = await create(
      { user_id: user.id, user_password: user.password, template: templates.admin, storage: ram },
    ).catch(error)

    const new_user = await generateUser().catch(error)

    await stream.authorize({ key: new_user.id }).catch(error)

    expect(await stream.isAuthorized({ key: new_user.id }).catch(error)).equal(true)
  })
  it('stream/interfaces', async () => {
    const stream = await create(
      { user_id: user.id, user_password: user.password, template: templates.admin, storage: ram },
    ).catch(error)
    expect(stream.template.name).equal('Admin')

    const blank = await getInterface('blank')
    await stream.addInterface(blank).catch(error)
    expect(typeof stream.blank._test).equal('function')
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
