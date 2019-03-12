const expect = require('chai').expect
const Datagram = require('./../src')
const { fromB58 } = require('./../src/utils')
const { generateUserIfNecessary } = require('./../src/init')
const home = require('home')
const ram = require('random-access-memory')
const tmp = require('tmp').tmpNameSync
const _ = require('lodash')

function error(err, meta) {
  console.error(err, meta)
  expect(err).equal(null)
}

describe('datagram', async () => {
  it('new dg without user', async () => {
    try {
      const DG = new Datagram()
      expect(DG).to.contain.keys([ 'ready', 'debug' ])

      const dg = await DG.ready()
      expect(dg).to.include.keys([
        'share',
        'getCredentials',
        'destroy',
        'authorizeDevice',
      ])
      const settings = await dg.getSettings()
      expect(settings.storage).equal(`${home()}/.datagram/`)
    } catch (e) {
      error(e)
    }
  })

  it('new dg with user', async () => {
    try {
      const user = await generateUserIfNecessary({ credentials: {} })
      const DG = new Datagram(user.credentials)
      const dg = await DG.ready()
      const credentials = await dg.getCredentials()
      expect(credentials).eql(user.credentials)
    } catch (e) {
      error(e)
    }
  })

  it('new dg with custom storage', async () => {
    try {
      const DG = new Datagram({ storage: ram })
      const dg = await DG.ready()
      const settings = await dg.getSettings()
      expect(typeof settings.storage).eql('function')

      const DG2 = new Datagram({ path: '/tmp/dg' })
      const dg2 = await DG2.ready()
      const settings2 = await dg2.getSettings()
      expect(settings2.path).equal('/tmp/dg')
    } catch (e) {
      error(e)
    }
  })

  it('open existing dg', async () => {
    try {
      const storage = tmp()
      const user = await generateUserIfNecessary({ credentials: {} })
      const args = Object.assign({}, user.credentials, { storage, type: 'redis' })
      const DG = new Datagram(args)
      const dg = await DG.ready()
      await dg.set('hello', 'world')

      // Just to be sure...
      delete dg
      delete DG

      const DG2 = new Datagram(args)
      const dg2 = await DG2.ready()
      expect(await dg2.get('hello')).equal('world')

    } catch (e) {
      error(e)
    }
  })

  it('new dg with custom storage', async () => {
    try {
      const DG = new Datagram({ storage: ram })
      const dg = await DG.ready()
      const settings = await dg.getSettings()
      expect(typeof settings.storage).eql('function')

      const DG2 = new Datagram({ path: '/tmp/dg' })
      const dg2 = await DG2.ready()
      const settings2 = await dg2.getSettings()
      expect(settings2.path).equal('/tmp/dg')
    } catch (e) {
      error(e)
    }
  })

  it('share & connect', async () => {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await generateUserIfNecessary({ credentials: {} })
        const args = Object.assign({}, user.credentials, { type: 'redis' })
        const DG = new Datagram(args)
        const dg = await DG.ready()
        dg.debug()
        await dg.set('hello', 'world')

        const sharelink = await dg.share().catch(reject)
        expect(sharelink).contain(user.credentials.id.toString('hex'))

        const DG2 = new Datagram({ sharelink, storage: ram })
        const dg2 = await DG2.ready()

        const hello1 = await dg2.get('hello').catch(reject)
        expect(hello1.toString()).equal('world')

        
        let rand = String(_.random(0, 234))
        await dg.set('h3ll0', rand).catch(reject)
        expect(await dg.get('h3ll0')).equal(rand)
        expect(await dg2.get('h3ll0')).equal(rand)
        resolve()
      } catch (e) {
        error(e)
      }
    })
  }).timeout(15000)
})
