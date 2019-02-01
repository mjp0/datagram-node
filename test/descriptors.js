const test = require('tape')
const { create } = require('../core')
const ram = require('random-access-memory')
const descriptors = require('../descriptors')
const { error } = require('../utils')
const debug = require('../utils/debug')(__filename)

test('descriptors/get', async (t) => {
  t.plan(2)
  const Person = await descriptors.get('Person').catch(error)
  t.equal(Person.context['@id'], 'http://schema.org/Person', '@id matches')
  t.ok(Person.keys, 'keys exists')
})

test('descriptor/create & read', async (t) => {
  t.plan(2)
  try {
    const JohnDoe = await descriptors.create('Person', {
      givenName: 'John',
      familyName: 'Doe',
      gender: 'Male',
    })
    const JohnDoe2 = await descriptors.read(JohnDoe)
    t.equal(JohnDoe2.givenName, 'John', 'givenName should match')
    t.equal(JohnDoe2.familyName, 'Doe', 'familyName should match')
  } catch (e) {
    t.error(e, 'no errors')
  }
})