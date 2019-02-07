const Datagram = require('../')

test('datagram/basics', async (test_done) => {
  // Create new Datagram and see that APIs have loaded correctly
  const DG = new Datagram()
  await DG.ready()
  expect(DG.credentials.password.length >= 49).toBeTruthy()
  expect(DG.credentials.user_id.length >= 92).toBeTruthy()
  console.log(DG)
  test_done()
})
