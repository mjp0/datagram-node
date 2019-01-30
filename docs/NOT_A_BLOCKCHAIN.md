# Datagram is not a blockchain

Before explaining how Datagram differs from blockchains, let's talk about current challenges with decentralized, peer-to-peer applications.

When tech savvy people hear about decentralized applications, they immediately start thinking about so called dApps that use blockchains to be "decentralized". dApps use blockchain as the database and the theory goes that it is somehow better if the information is on the blockchain instead of a local database.

The biggest issue plaguing dApps is the performance and privacy problems with blockchains. For example, the whole Ethereum network can not handle more than 15 requests per second. The usage of any large scale application is much more than 15 requests per second. This limitation alone makes blockchains very hard to work with. The lack of privacy is also a huge concern because any data in a blockchain is by nature available to everybody. Data can be encrypted but majority of people won't still feel comfortable knowing that their data is out there and if somebody cracks the encryption or steals their password, it can be read.

While blockchains rely on a one global database made of blocks, Datagram creates persistent data streams and can be used to read, write and share any type of data. Structurally Datagram's data streams and blockchains are close because they use many of the same proven cryptographic constructs but the difference is how they are utilized. Datagram doesn't create or utilize one global database but instead creates private streaming databases between Datagram users. One user can have as many datagrams as they want and they are private by default unless explicitly shared with others. Datagram data streams are persisted as long as one copy of the data exists so data can be deleted which is impossible with blockchains.

**To summarize, here are the differences between Datagram and blockchains:**
- Datagram isn't one big global database like blockchains are. Datagram is a container of multiple data streams.
- Datagram is a container of data streams which are secure and replicable between Datagram users.
- Datagram doesn't charge tokens, coins or any payments in any form for usage. In fact, Datagram is 100% free.
- All data in Datagram is private and encrypted by default but can be shared with others.
- Unlike any data stored in blockchain, data in Datagram can be deleted if all copies of the Datagram are deleted.