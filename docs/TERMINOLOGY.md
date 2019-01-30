# Terminology of Datagram

Datagram has a couple moving parts organized in various layers. To make it easier to grok how the whole works, this document explains the terms and gives a bit of context. Please refer to ARCHITECTURE document for explanations how these things play together.

## Terms & concepts
- Datagram: Datagram is a free data platform framework that helps you to containerize, organize and share data in a decentralized peer-to-peer manner
- Core Container: Core Container is a collection of one or more Cores configured based on Core Container Definition
- Core Container Definition: Definition is a set of configuration parameters that allows Datagram to create and re-create a specific type of Container instantly
- Core: Core is data. More specifically, Core is a wrapper around a stream of data.
- Data Descriptor: Data Descriptor describes what data it is and gives the necessary meta data options. Each data transmit starts and ends with Data Descriptor.