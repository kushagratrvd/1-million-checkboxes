import Redis from "ioredis"

function createNewConnection(){
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL);
  }
  
  return new Redis({
    host: 'localhost',
    port: 6379,
  })
}

export const redis = createNewConnection();

export const publisher = createNewConnection();

export const subscriber = createNewConnection();