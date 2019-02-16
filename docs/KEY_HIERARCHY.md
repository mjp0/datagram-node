1. master_key
2. datagram public & private (derive(master_key))
3. datagram_id (hash(datagram public + private))
4. container_password (hash(datagram_id))
5. container public & private AND replication public & private (derive(container_password))
6. streams' public & private (independent)
7. streams' encryption key (independent)