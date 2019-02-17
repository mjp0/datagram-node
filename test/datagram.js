const Datagram = require('../src')
const tmp = require('tmp').tmpNameSync

test('datagram/basics', async (test_done) => {
  // Create new Datagram and see that APIs have loaded correctly
  const DG = new Datagram()
  await DG.ready()
  expect(DG.credentials.password.length >= 49).toBeTruthy()
  expect(DG.credentials.user_password.length >= 92).toBeTruthy()
  test_done()
})

test('datagram/actions', async (test_done) => {
  // Create new Datagram and try to run an action
  const DG = new Datagram({}, { action: 'getCredentials' })
  await DG.debug()
  const creds1a = await DG.ready()
  const creds2a = await DG.getCredentials()
  expect(creds1a).toEqual(creds2a)

  // Create new Datagram and try to run a nested action
  const DG2 = new Datagram({}, { action: 'stream.test_ok' })
  await DG2.debug()
  const creds1b = await DG2.ready()
  expect(creds1b).toEqual('OK')

  // Create new Datagram and try to get an error
  const DG3 = new Datagram({}, { action: 'stream.test_fail' })
  await DG3.debug()
  await DG3.ready().catch((err) => {
    expect(err).toEqual({ error: 'ERROR' })
    test_done()
  })
})

test('datagram/storage', async (test_done) => {
  const storage = tmp()
  // Create new Datagram and see that APIs have loaded correctly
  const DG = new Datagram({}, { storage })
  await DG.ready()
  expect(DG.credentials.password.length >= 49).toBeTruthy()
  expect(DG.credentials.user_password.length >= 92).toBeTruthy()
  const DG2 = new Datagram({ user_password: DG.credentials.user_password, password: DG.credentials.password }, { storage })
  await DG2.ready()
  expect(DG2.credentials.user_password).toEqual(DG.credentials.user_password)

  test_done()
})

test('datagram/utility methods', async () => {
  const DG = new Datagram()
  await DG.ready()
  const credentials = await DG.getCredentials()
  expect(credentials).toEqual(DG.credentials)
})
