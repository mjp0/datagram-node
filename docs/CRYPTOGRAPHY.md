# DATAGRAM CRYPTOGRAPHY

Datagram has a cryptographic key hierarchy that aims to strike a balance between maximum security and necessary user comforts.

## KEY HIERARCHY
1. user's id & password // generate with `utils.generateUser()`
2. datagram's read & write keys // derived from user's password
3. datagram's address // hash(datagram's read key) this is the public address of the datagram
4. datagram's password // all data is encrypted with the datagram's read key

## HOW IT WORKS
User's id serves as an identification and a data verification key for other users. User's password is used to generate other keys and sign data.

The keys that should be kept secret at all times are user's password, and all write keys.

### SHARING
When you want to share your Datagram, you create a sharelink that consists of datagram's address and, optionally, datagram's password which is needed to decrypt the data.

If you want to host your data on a server without exposing the contents, you provide only datagram's address.

## READ & WRITE KEYS
Datagram uses slightly different names for traditional public and private keys to make Datagram easier to grok for people not familiar with cryptography. Public and private keys as a concept are not intuitive and therefore can make Datagram look more difficult or complicated than it is.

When it comes to streams, Datagram calls public and private keys read and write keys because that's what they do in Datagram. Public aka read key gives you the ability to read and verify the data you receive. Private aka write key gives you the ability to write your own data into the datagram.

For the users, Datagram uses "user id" instead of public key and "user password" instead of private key. Since public key is meant to be shared and is used to verify signed data, it works great as id for the user. The private key is used to sign newly created data, so it is essentially a password that allows you to assume the identity of the user.

## BEHIND THE SCENES
Datagram doesn't implement its own cryptographic functions but instead uses Machian Collective's other project, CryptoDoneRight. CryptoDoneRight is a best practices crypto library that takes the battle-tested crypto construct library libsodium and turns it into a fool-proof javascript library.