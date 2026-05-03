import Redis from "ioredis"

function createNewConnection(){
  return new Redis({
    host: 'localhost',
    port: 6379,
  })
}

export const redis = createNewConnection();

export const publisher = createNewConnection();

export const subscriber = createNewConnection();