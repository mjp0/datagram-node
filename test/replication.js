const { create, load, clone } = require('../src/streams')
const ram = require('random-access-memory')
const templates = require('../src/templates/streams')
const { error, generateUser } = require('../src/utils')
const descriptors = require('../src/descriptors')
const async = require('async')
const tmp = require('tmp').tmpNameSync
const { getInterface } = require('../src/streams/interfaces')

let user

describe('replication', async () => {
  beforeAll(async () => {
    user = await generateUser().catch(error)
  })

  test('remote replication', async (done) => {
    const dg1 = await create(
      { template: templates.admin, storage: ram, user_password: user.secret },
      { user_id: user.key },
    ).catch(error)
    const dg1_keys = await dg1.getKeys().catch(error)
    expect(dg1_keys.key).toBeTruthy()

    await dg1.publish()
  })
})
