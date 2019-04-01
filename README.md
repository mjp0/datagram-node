![Datagram, the free data platform](media/header.png)
> Datagram is an open-source data platform that you can use to build secure shared databases and data structures with anyone. Datagram helps you to organize, share and download your data in a decentralized and peer-to-peer manner.

[![license](https://img.shields.io/badge/license-apache--2.0-brightgreen.svg)](LICENSE) [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmachianists%2Fdatagram-node.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmachianists%2Fdatagram-node?ref=badge_shield) [![js-standardx-style](https://img.shields.io/badge/code%20style-standardx-brightgreen.svg)](http://standardjs.com) [![web-datagram](https://img.shields.io/badge/web-datagramjs.com-blue.svg)](https://datagramjs.com) [![twitter-machianists](https://img.shields.io/badge/twitter-@machianists-blue.svg)](https://twitter.com/machianists)


- [💡 What is Datagram](#-what-is-datagram)
- [🔌 The types of data can you send](#-the-types-of-data-can-you-send)
- [🔒 Everything encrypted from A to Z](#-everything-encrypted-from-a-to-z)
- [😆 Pricing](#-pricing)
- [🎁 Get started](#-get-started)
- [🏎 Performance](#-performance)
- [🔬 Running tests](#-running-tests)
- [🛠 The team](#-the-team)
- [📝 License](#-license)


## 💡 What is Datagram
Datagram is an easy-to-use library to build any sort of database or data structure on top of truly private and secure peer-to-peer internet.

Whether you want to send a simple text file from computer to computer or create a peer-to-peer key/value database for whatever you are building, Datagram can help you.


## 🔌 The types of data can you send

- any type of file
- text and numbers
- lists
- spreadsheets
- streaming video and audio
- streaming binary

You can send as much data as you want in one datagram.


## 🔒 Everything encrypted from A to Z

Everything you send is automatically encrypted. Everything you receive is automatically verified. Everything from your data to internet connections Datagram makes is secured with the cryptographic best practices.


## 😆 Pricing

There is no pricing. Everything is free. This is peer-to-peer which means that your data goes directly to the receiver. If there's nobody in the middle, why would there be fees?


## 🎁 Get started

Let's create a new datagram, put a file in and share it.
```bash
// Generate Datagram user file
$ npx datagram user foo

// Create new datagram
$ npx datagram create -u foo my_datagram

// Add a file
$ npx datagram add -u foo -d my_datagram cat.jpg

// Check that file is there
$ npx datagram list -u foo -d my_datagram

// Share your datagram
$ npx datagram share -u foo -d my_datagram
-> you get a sharelink
```

Your datagram is now available only to anyone who knows the sharelink.

Please note that multi-user support is underway but right now Datagram doesn't support multiple users. When you want to access your datagram on another device, you need to copy your user file to the other device.

```bash
// List the contents of remote datagram
$ npx datagram list -u foo -l [sharelink]

// Export a file from remote datagram
$ npx datagram export cat.jpg exported-cat.jpg -u foo -l [sharelink]
```

> More documentation coming shortly.


## 🏎 Performance

Performance is good enough to power any modern consumer javascript application.
If you need to store, analyze and serve "big data", Datagram might not be your choice.


## 🔬 Running tests

```bash
# Install dependencies and test tooling
npm install

# Run tests
npm test

# or run tests with debug logging
DEBUG=*datagram* npm test
```

## 🛠 The team

Datagram is a user-driven project maintained by [Machian Collective](https://machian.com), an open-source collective focused on solving human digitalization.

Current primary maintainer is [Marko Polojärvi](https://twitter.com/markopolojarvi). Major direct and indirect contributions have come from Mathias Buus, Stephen Whitmore, Paul Frazee, Benjamin Forster, Martin Heidegger, Lars-Magnus Skog, Alexander Cobleigh and Tony Ivanov.

> **If you are interested in working with peer-to-peer technologies and solving the hardest & most fascinating issues with digital privacy and security, contact [Marko Polojärvi](https://twitter.com/markopolojarvi) right now.**


## 📝 License

We consider Datagram as a public utility and public utilities should be available to all regardless of their status, skills or resources. Therefore we set no restrictions on the usage of this code. The only restriction Datagram as a project sets is the use of the name Datagram for commercial purposes without asking us first.

All Datagram code is licensed under Apache License 2.0 (Apache-2.0)
