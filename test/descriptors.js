const { create } = require('../src/streams')
const ram = require('random-access-memory')
const descriptors = require('../src/descriptors')
const { error } = require('../src/utils')
const debug = require('../src/utils/debug')(__filename)
const expect = require('chai').expect

describe('descriptors', async () => {
  it('descriptors/get', async () => {
    const Person = await descriptors.get('Person').catch(error)
    expect(Person.context['@id']).equal('http://schema.org/Person')
    expect(Person).to.have.property('keys')
  })

  it('descriptor/create & read', async () => {
    try {
      const JohnDoe = await descriptors.create('Person', {
        givenName: 'John',
        familyName: 'Doe',
        gender: 'Male',
      })
      const JohnDoe2 = await descriptors.read(JohnDoe)
      expect(JohnDoe2.givenName).equal('John')
      expect(JohnDoe2.familyName).equal('Doe')
    } catch (e) {
      expect(e).equal(false)
    }
  })
})
