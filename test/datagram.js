const Datagram = require('../')
const tmp = require('tmp').tmpNameSync

test('datagram/basics', async (test_done) => {
  // Create new Datagram and see that APIs have loaded correctly
  const DG = new Datagram()
  await DG.ready()
  expect(DG.credentials.password.length >= 49).toBeTruthy()
  expect(DG.credentials.user_id.length >= 92).toBeTruthy()
  test_done()
})

test('datagram/storage', async (test_done) => {
  const storage = tmp()
  // Create new Datagram and see that APIs have loaded correctly
  const DG = new Datagram({}, { storage })
  await DG.ready()
  expect(DG.credentials.password.length >= 49).toBeTruthy()
  expect(DG.credentials.user_id.length >= 92).toBeTruthy()
  const DG2 = new Datagram({ user_id: DG.credentials.user_id, password: DG.credentials.password }, { storage })
  await DG2.ready()
  expect(DG2.credentials.user_id).toEqual(DG.credentials.user_id)

  test_done()
})

test('datagram/utility methods', async () => {
  const DG = new Datagram()
  await DG.ready()
  const credentials = await DG.getCredentials()
  expect(credentials).toEqual(DG.credentials)
})
