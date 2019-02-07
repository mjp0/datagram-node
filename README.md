# Datagram, the free data platform
> Datagram is an open-source data platform that helps you to containerize, organize and share any data in a decentralized and peer-to-peer manner

[![license](https://img.shields.io/badge/license-apache--2.0-brightgreen.svg)](http://standardjs.com) [![js-standardx-style](https://img.shields.io/badge/code%20style-standardx-brightgreen.svg)](http://standardjs.com) [![web-datagram](https://img.shields.io/badge/web-datagramjs.com-blue.svg)](https://datagramjs.com) [![twitter-machianists](https://img.shields.io/badge/twitter-@machianists-blue.svg)](https://twitter.com/machianists)

## What is Datagram
Servers used to be about running code and storing backups. Now they are about facilitating connections and serving data. Docker and Kubernetes have made it easy to spin up complex online services but we are still manually handling all the communication and data managing that happens between the users and the service.

Most of us share the experience of having spent too many hours configuring servers, setting up databases, figuring out a good way to save your data in the database, and then yet again writing a custom backend code to communicate with the user.

Datagram solves this by offering a framework to containerize "the server" and database.

You can run Datagram on any x86 or ARM based computer and it supports both client-server and peer-to-peer connection models out-of-the-box.

> [Datagram is not a blockchain](docs/NOT_A_BLOCKCHAIN.md).

## Get started

```javascript
$ npm install datagram // install datagram locally for development

// or 

$ npx datagram create username password // if you want to use the CLI
```

### How the API works
Initialize your Datagram instance with `username` and `password` of your choice.
```javascript
const Datagram = require('datagram')

const DG = new Datagram({ username, password })

console.log(DG) // -> { ... available API methods ... }
```
> [Browse API documentation](docs/API.md)

#### Supports callbacks, await/async and Promises
You can use any of the three standard control flow styles with Datagram's API.
```javascript
// go with nodejs style callbacks
DG.build({ template }, (err, dg) => {
  // dg -> datagram built from the template
})

// use the new async/await
await DG.build({ template }).catch(err)

// or go with Promises
DG.build({ template }).then(dg => {
  // dg -> datagram built from the template
}).catch(err)

```


> [How does it work](docs/ARCHITECTURE.md) | [Tutorials](docs/TUTORIALS.md) | 

## Acknowledgements

The following people have all contributed great work that Datagram builds upon:

- Mathias Buus
- Stephen Whitmore
- Paul Frazee
- Benjamin Forster
- Martin Heidegger
- Lars-Magnus Skog
- Alexander Cobleigh
- Tony Ivanov

## License

Apache License 2.0 (Apache-2.0)
