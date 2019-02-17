const { installAPI } = require('../src/utils')
const CONTAINER_API = require('../src/api.container')
const tmp = require('tmp').tmpNameSync
const container_templates = require('../src/templates/containers')
const stream_templates = require('../src/templates/streams')
const ram = require('random-access-memory')

function err(e, rest) {
  console.log(e, rest)
  expect(e).toBeFalsy()
}

test('lib.build/createContainer', async (test_done) => {
  // Create a fake object for installAPI to work on
  const _ = {}
  installAPI({ API: CONTAINER_API, ref: _ })

  const container = await _.createFromTemplate({ template: container_templates.video_chat, password: 'test', user_password: '123456' }).catch(
    err,
  )

  expect(container).toHaveProperty('addStream')
  expect(container).toHaveProperty('getStreams')
  expect(container).toHaveProperty('replicate')

  const streams = await container.getStreams().catch(err)

  expect(streams).toHaveProperty('admin')
  expect(streams).toHaveProperty('index')
  expect(streams).toHaveProperty('meta')
  expect(streams).toHaveProperty('video')
  test_done()
  
  //   // I shouldn't be able to add new admin or meta
  //   await container.meta.addStream({ definition: stream_templates.meta, storage: ram }).catch(async (err) => {
  //     expect(err).toBeTruthy()

  //     await container.meta.addStream({ definition: stream_templates.admin, storage: ram }).catch(async (err) => {
  //       expect(err).toBeTruthy()

  //       await container.meta.addStream({ definition: stream_templates.video, storage: ram }).catch(err)
  //       test_done()
  //     })
  //   })
})

/*
Meta stream is a database of all streams.
Permissions with Datagram are essentially checks based on whose streams it will add and which types are allowed.
+|stream|53fdsa5213...

*/
