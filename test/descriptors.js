const { create } = require('../src/streams')
const ram = require('random-access-memory')
const descriptors = require('../src/descriptors')
const { error } = require('../src/utils')
const debug = require('../src/utils/debug')(__filename)

test('descriptors/get', async () => {
  expect.assertions(2)
  const Person = await descriptors.get('Person').catch(error)
  expect(Person.context['@id']).toBe('http://schema.org/Person')
  expect(Person.keys).toBeTruthy()
})

test('descriptor/create & read', async () => {
  expect.assertions(2)
  try {
    const JohnDoe = await descriptors.create('Person', {
      givenName: 'John',
      familyName: 'Doe',
      gender: 'Male',
    })
    const JohnDoe2 = await descriptors.read(JohnDoe)
    expect(JohnDoe2.givenName).toBe('John')
    expect(JohnDoe2.familyName).toBe('Doe')
  } catch (e) {
    expect(e).toBeFalsy()
  }
})