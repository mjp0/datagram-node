What can you do with Datagram now?

Features
- You can create new streams based on a template that will store your data in a correct descriptor automatically
- You can create and attach APIs in the streams and build upon them to create new APIs
- You can create stream containers where meta database keeps track of everything
- Automatically wraps all data inside data descriptors to enhance compatibility
- All stored data is automatically encrypted and decrypted in the background
 
Upcoming Features
- All stored data is automatically signed and verified in the background
- You can attach indexer into your stream to produce a table of contents of your stream automatically
  - [x] redis support done
  - [ ] ability to get table of contents
- Verify any position in the container by comparing indexes from users
- Build new Datagram based on a template