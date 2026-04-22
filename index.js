import { createServer } from "http";
import { Server } from "socket.io"
import express from 'express';

async function main() {
  const app = express();
  app.use(express.static('.'));

  const server = createServer(app);
  const io = new Server();
  io.attach(server);

  const checkboxStates = new Map();
  let totalUsers = 0;
  let totalChecked = 0;

  io.on('connection', (socket) => {
    console.log(`A new socket is connected`, socket.id);

    socket.emit('initialStates', Object.fromEntries(checkboxStates));
    io.emit('totalDataUpdate', { totalUsers: ++totalUsers, totalChecked });

    socket.on('checkboxUpdate', (data) => {
      const previousState = checkboxStates.get(data.id) || false;
      
      if (previousState !== data.checked) {
        if (data.checked) {
          totalChecked++;
        } else {
          totalChecked--;
        }
        checkboxStates.set(data.id, data.checked);
        
        socket.broadcast.emit('checkboxUpdate', data);
        io.emit('totalDataUpdate', { totalUsers, totalChecked });
      }
    });

    socket.on('disconnect', (data) => {
      totalUsers--;
      io.emit('totalDataUpdate', { totalUsers, totalChecked });
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
