const expect = require('chai').expect
const Datagram = require('./../src')
const { fromB58 } = require('./../src/utils')
const fs = require('fs-extra')
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
      expect(dg).to.include.keys([ 'share', 'getCredentials', 'destroy', 'authorizeDevice' ])
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
      expect(await dg.get('hello')).equal('world')
      const keys = await dg.getKeys()
      // Just to be sure...
      delete dg
      delete DG

      const DG2 = new Datagram(args, keys)
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
      const keys = await dg.getKeys()
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
        const keys = await dg.getKeys()
        const sharelink = await dg.share().catch(reject)
        expect(sharelink).equal(keys.read + '|' + keys.encryption_password)

        const args2 = Object.assign({}, user.credentials, { sharelink, storage: ram })
        const DG2 = new Datagram(args2)
        const dg2 = await DG2.ready()

        const hello1 = await dg2.get('hello').catch(reject)
        expect(hello1.toString()).equal('world')

        let rand = String(_.random(0, 234))
        await dg.set('h3ll0', rand).catch(reject)
        expect(await dg.get('h3ll0')).equal(rand)
        expect(await dg2.get('h3ll0')).equal(rand)

        let stats1 = await dg.monitor()
        const peer_keys = Object.keys(stats1.connections)
        expect(stats1.connections[peer_keys[0]].status).equal('ACTIVE')
        expect(stats1.connections[peer_keys[0]].type).equal('PUBLISH')
        expect(stats1.connections[peer_keys[0]].download_speed.length > 0).equal(true)
        expect(stats1.connections[peer_keys[0]].upload_speed.length > 0).equal(true)

        await dg.disconnect()
        stats1 = await dg.monitor()
        setTimeout(() => {
          expect(stats1.connections[peer_keys[0]].status).equal('ENDED')
          resolve()
        }, 500)
      } catch (e) {
        error(e)
      }
    })
  }).timeout(15000)

  it('destroy', async () => {
    try {
      const DG = new Datagram()
      const dg = await DG.ready()
      const settings = await dg.getSettings()
      expect(settings.storage).equal(`${home()}/.datagram/`)
      const store_key = fromB58(dg.template.DatagramKey).toString('hex')
      expect(await fs.pathExists(`${home()}/.datagram/${store_key}`)).equal(true)
      await dg.destroy()
      expect(await fs.pathExists(`${home()}/.datagram/${store_key}`)).equal(false)
    } catch (e) {
      error(e)
    }
  })
})
