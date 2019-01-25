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

Cores are individual data streams that can be of any type from video stream to chat messages.