import { createServer } from "http";
import { Server } from "socket.io"
import express from 'express';
import { randomUUID } from "crypto";
import { publisher, subscriber, redis } from "./redis-connection.js";

const instanceId = randomUUID();

async function main() {
  const app = express();
  app.use(express.static('.'));

  const server = createServer(app);
  const io = new Server();
  io.attach(server);

  const CHECKBOX_STATE_KEY = 'checkbox-state';

  // Periodically report this server's user count to Redis
  setInterval(async () => {
    await redis.hset('active-servers', instanceId, `${Date.now()}:${io.engine.clientsCount}`);
  }, 3000);

  // Helper to calculate total active users across all servers
  async function getGlobalUserCount() {
    const servers = await redis.hgetall('active-servers');
    let total = 0;
    
    for (const [id, data] of Object.entries(servers || {})) {
      const [lastSeen, count] = data.split(':');
      
      if (Date.now() - Number(lastSeen) < 10000) {
        total += Number(count);
      } else {
        redis.hdel('active-servers', id); // Clear dead servers
      }
    }
    return total;
  }

  await subscriber.subscribe("internal-server:checkbox:change");
  await subscriber.subscribe("internal-server:totalDataUpdate");
  subscriber.on('message', async (channel, message) => {
    if(channel === 'internal-server:checkbox:change'){
      const { id, checked, totalChecked } = JSON.parse(message);
      
      const totalUsers = await getGlobalUserCount();

      io.emit('server:totalDataUpdate', { totalUsers, totalChecked });
      io.emit('server:checkbox:change', { id, checked });
    }
    else if(channel === 'internal-server:totalDataUpdate'){
      const { totalUsers, totalChecked } = JSON.parse(message);
      io.emit('server:totalDataUpdate', { totalUsers, totalChecked });
    }
  });

  io.on('connection', async (socket) => {
    console.log(`A new socket is connected`, socket.id);

    const existingState = await redis.hgetall(CHECKBOX_STATE_KEY);
    const initialStates = {};
    if (existingState) {
      for (const [id, val] of Object.entries(existingState)) {
          initialStates[id] = val === 'true';
      }
    }
    socket.emit('initialStates', initialStates);
    
    // Force an immediate heartbeat so this user is counted right away
    await redis.hset('active-servers', instanceId, `${Date.now()}:${io.engine.clientsCount}`);

    const totalUsers = await getGlobalUserCount();
    const totalChecked = parseInt(await redis.get('total-checked') || '0', 10);
    
    publisher.publish(
      'internal-server:totalDataUpdate',
      JSON.stringify({ totalUsers, totalChecked })
    );

    socket.on('client:checkbox:change', async (data) => {
      const lastOperationTime = await redis.get(`rate-limiting:${socket.id}`);
      if(lastOperationTime){
        const timeElapsed = Date.now() - lastOperationTime;
        if(timeElapsed < 3 * 1000){
          socket.emit("server:error", { error: "Please wait 3 seconds before clicking again." });
          return;
        }
      } 

      await redis.set(`rate-limiting:${socket.id}`, Date.now());

      await redis.hset(CHECKBOX_STATE_KEY, data.id, data.checked.toString());
      
      // Update global checked count atomically
      const newTotalChecked = data.checked 
        ? await redis.incr('total-checked') 
        : await redis.decr('total-checked');

      await publisher.publish(
        "internal-server:checkbox:change", 
        JSON.stringify({ ...data, totalChecked: newTotalChecked })
      );
    });

    socket.on('disconnect', async () => {
      // Force an immediate heartbeat reduction
      await redis.hset('active-servers', instanceId, `${Date.now()}:${io.engine.clientsCount}`);
      
      const totalUsers = await getGlobalUserCount();
      const totalChecked = parseInt(await redis.get('total-checked') || '0', 10);
      
      await publisher.publish(
        'internal-server:totalDataUpdate', 
        JSON.stringify({ totalUsers, totalChecked })
      );
    });
  });

  //app.get("/", index.html);
  const port = process.env.PORT || 8081
  server.listen(port, ()=>{
    console.log(`server is running on port ${port}`);

    const PING_INTERVAL = 840000;

    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

    setInterval(async () => {
      try {
        console.log(`Pinging ${url} to keep awake...`);
        const response = await fetch(url);
        if (response.ok) {
          console.log('Ping successful!');
        } else {
          console.error(`Ping failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error('Error during ping:', error.message);
      }
    }, PING_INTERVAL);
  });
}

main();
