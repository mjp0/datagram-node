# Datagram architecture

Datagram consists of three parts:

- Datagram API layer
- Hypervisor
- Cores

## Datagram API layer

The API layer is a set of easy-to-use functions to help with common tasks like creating connections and adding cores. Unless you are working on Datagram itself, this is the only set of functions you should be using.

## Hypervisor

Hypervisor is a variable-type core management engine that keeps track of all cores and provides tools to replicate all attached cores with others over peer-to-peer connections.

## Cores

Cores are essentially one or more data objects. These data objects are collected into a data array that you can read and replicate between computers. To make the data array so secure that it can be replicated, the data array is append-only. This means that you can add but you can't delete. Instead of deleting, Datagram can forget and update data. If all parties who have replicated a specific datagram deletes the same local data, that data becomes forgotten and can't be retrieved again. Updates are issued by adding updated version of the data to the array. Old version can be either forgotten or kept for potential revisions.

Working with a construct like append-only data array can be challenging. For example, when you store a big data file, it should be stored in small chunks so it can be streamed or downloaded in parallel. Chunking up the data is not particulary challenging but when you append it to a data array that already has a bunch of other binary chunks you will have trouble knowing where one file ends and the next one starts. To make data array usable, we need a way to create an index of the data array that tells us what data objects are in the array and where exactly do we find them.

### Data Descriptors
For this purpose we are using so called Data Descriptors. Data Descriptors serve two purposes. Their primary purpose is to help to create that index we talked about for more efficient searching and downloading. Their secondary purpose is to create a common language for annotating our data so when we share our data between our devices and with others, we don't have to fight with cross-platform compatibility problems anymore.

All built-in Data Descriptors can be found at [/definitions/cores](/definitions/cores)

For some people it's easier to think Data Descriptor as a sort of data factory. You choose which type of data you want to create, input all the necessary data it needs and Data Descriptor packages it all up in a way that any other Datagram can read it. The data inside can always be exported so Data Descriptors don't lock you in.
