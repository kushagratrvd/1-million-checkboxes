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

  io.on('connection', (socket) => {
    console.log(`A new socket is connected`, socket.id);

    socket.emit('initialStates', Object.fromEntries(checkboxStates));

    socket.on('checkboxUpdate', (data) => {
      checkboxStates.set(data.id, data.checked);
      socket.broadcast.emit('checkboxUpdate', data);
    });

    //socket.on('disconnect')
  });

  //app.get("/", index.html);
  const port = process.env.PORT || 8080
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
