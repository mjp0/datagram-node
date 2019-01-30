const admin = require('../cores/admin')
const messagestream = require('../cores/messagestream')
const mp3stream = require('../cores/mp3stream')
const mp4stream = require('../cores/mp4stream')

module.exports = {
  id: 'one_to_many_chat',
  name: 'Protected group chat',
  version: 1,
  // one-to-one = expect cores from two users, one for me and one for you
  // one-to-non = expect cores only from me
  // one-to-many = expect cores from anybody but allow me to choose
  // many-to-many = everybody can add their cores freely
  model: 'one-to-many',
  accepted_cores: [ admin, messagestream, mp3stream, mp4stream ],
}
