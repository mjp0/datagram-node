const { create, load, clone } = require('../streams')
const ram = require('random-access-memory')
const definitions = require('../definitions/containers')
const { error } = require('../utils')
const async = require('async')
const tmp = require('tmp').tmpNameSync
const container = require('../container')

test('containers/basics', async () => {
  // Create a new container based on definition
  const contnr = await container({ password: 'test' }, { definition: definitions.personal_data, storage: ram })
  // Add new, valid cores
  // Try to add invalid cores
})

test('containers/admin', async () => {
  // Create a new container based on definition
  // Add owner admin
  // Create "new user"
  // Try to add a core as an unauthorized user
  // Authorize the user to be an admin
  // Try to add a core as an authorized admin
  // Remove user's authorization to be an admin
  // Try to add a core as an deauthorized admin
})

test('containers/one-to-non', async () => {
  // Create a new container based on definition with one-to-non model
  // Add owner admin
  // Try to join as a user
})

test('containers/one-to-one', async () => {
  // Create a new container based on definition with one-to-one model
  // Add owner admin
  // Try to join as a user via invite code
  // Try to join as a second user via invite code
})

test('containers/one-to-many', async () => {
  // Create a new container based on definition with one-to-many model
  // Add owner admin
  // Try to join as a user via invite code
  // Try to join as a second user via invite code
  // Try to send data as a user
})

test('containers/many-to-many', async () => {
  // Create a new container based on definition with many-to-many model
  // Add owner admin
  // Try to join as a user via invite code
  // Try to join as a second user via invite code
  // Try to send data as the user
  // Try to send data as the second user
  // Try to add new cores as the second user
  // Try to invite other users as the user
  // Try to join as the third user based on the user's invite
  // Try to send data as the third user
})
