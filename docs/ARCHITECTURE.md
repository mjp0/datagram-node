# Datagram architecture

- [Datagram architecture](#datagram-architecture)
  - [The parts](#the-parts)
  - [Datagram API layer](#datagram-api-layer)
  - [Container](#container)
  - [Streams](#streams)
    - [Indexers](#streams-and-indexers)
      - [Indexers as primary shareables](#indexers-as-primary-shareables)
    - [Data Descriptors](#data-descriptors)

## The parts
Datagram consists of five parts:

- Datagram API layer
- Container
- Meta database
- Streams & indexers
- Multiplexer

## Datagram API layer

The API layer is a set of easy-to-use functions to help with common tasks like creating connections and adding streams. Unless you are working on Datagram itself, this is the only set of functions you should be using.

## Container

Container is a variable-type stream management engine that keeps track of all created and attached streams and provides tools to replicate all attached streams with others over peer-to-peer connections.

## Streams

Streams are essentially one or more data objects stored in a list you can read and replicate between computers. To make the list enough secure that it can be replicated without worrying about data being changed or forged, the list is append-only. You can add but you can't remove.

Instead of deleting, Datagram can forget and update any data object in the list. If all parties who have replicated a specific datagram deletes the same data object, that data object becomes forgotten and can't be retrieved again. The reference to it will still exist but the data has been effectively deleted. Updates are issued by adding updated version of the data to the end of the list. User can decide whether they want the old version to be either forgotten or kept as a history they can browse.

Working with a construct like append-only list can be challenging. For example, when you store a big data file, it can be stored as one huge chunk but for better user experience, should be stored in small chunks so it can be streamed or downloaded in parallel. The problem is that when you append it to a list that already has a bunch of other binary chunks, you will have trouble knowing where one data object ends and the next one starts. To make list usable, we need a way to create an index of the list that tells us what data objects are in the array and where exactly do we find them.

### Stream interfaces
Stream interfaces are extensible and combinable small APIs that will give you different ways to use the stream. Remember, all the stream is, is a cryptographically secure list of items. Anything you can build on top of a list, you can build upon Datagram streams.

Datagram comes with few different stream interfaces built-in. We have an aspiring redis compatible interface which will turn your stream into a key/value database. To make it easier to work with files, there's also nodejs fs compatible interface. This interface turns your stream into a harddrive you can read and write with familiar nodejs fs methods. We have plans for many other interfaces and as always, you are welcome to [create your own](how-to-use/STREAM_INTERFACES.md).

### Indexers
When user creates a new stream, Datagram creates also an indexer for it. Indexer's job is to create a table of contents of the data stream. This helps users to pick and choose what they download from the data stream and we can reuse the same data streams for other same type data.



#### Indexers as primary shareables
All indexers are encrypted with the same password as the data stream and they contain the data stream's sharelink, data positions and sizes. Therefore it makes more sense for the user to share the indexer stream than the data stream. As a precaution, data stream's descriptor will contain a sharelink to the indexer stream as well.

### Data Descriptors
For this purpose we are using so called Data Descriptors. Data Descriptors serve two purposes. Their primary purpose is to help to create that index we talked about for more efficient searching and downloading. Their secondary purpose is to create a common language for annotating our data so when we share our data between our devices and with others, we don't have to fight with cross-platform compatibility problems anymore.

All built-in Data Descriptors can be found at [/definitions/streams](/definitions/streams)

For some people it's easier to think Data Descriptor as a sort of data factory. You choose which type of data you want to create, input all the necessary data it needs and Data Descriptor packages it all up in a way that any other Datagram can read it. The data inside can always be exported so Data Descriptors don't lock you in.

## Multiplexer
Multiplexer takes all of the streams in the container and generates a one stream out of them all that can be replicated easily. This makes it possible to clone whole Datagrams with one command.

Multiplexer has also more advanced features to control what streams are accepted and declined. User can set what streams they want and what streams are they looking for. For example, if datagram is used for a public chat, user probably wants only streams that are not marked as spam. Because there is no central authority controlling who can communicate, moderation is handled via stream replication control.