# Index Stream

Index stream is a database that stores the contents references from all attached streams.

When container adds new stream, it gives stream a reference to the index stream.

The indexer will then listen to all updates to the stream, read descriptors and make a record of positions of data in the stream. All contents start with descriptor and end with a descriptor so data can be chunked and downloaded in parallel.

Every container is responsible of keeping 