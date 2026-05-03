# 1 Million Checkboxes 🟩

A wildly fun, real-time, globally synchronized web application where users collaborate (and compete) to tick or untick one million checkboxes. Built with scalability in mind to support massive concurrent user traffic across multiple servers.


*Demo Link:* https://one-million-checkboxes.onrender.com

## 🚀 Project Overview
This project renders an infinite-scroll board of 1 million checkboxes. Whenever anyone on the internet checks or unchecks a box, the state updates live on everybody else's screen instantly. It also tracks the total number of connected users and the global count of ticked checkboxes in real-time.

## 🛠 Tech Stack
* **Frontend:** Vanilla HTML, CSS, JavaScript
* **Backend:** Node.js, Express
* **WebSockets:** Socket.IO
* **Database / Message Broker:** Redis (via `ioredis`) 
* **Package Manager:** pnpm
* **Local Dev:** Docker Compose

## ✨ Features Implemented
* **Real-time Syncing:** Sub-millisecond latency when remote users interact with checkboxes.
* **Infinite Scroll (Lazy Loading):** Checkboxes are batched and rendered seamlessly on scroll to prevent the DOM from crashing the browser. 
* **Horizontal Scalability:** App uses Redis Pub/Sub to allow multiple backend instances (servers) to instantly exchange box-toggle messages.
* **Drift-Free Active Users:** Implements a "Heartbeat Pattern" where servers report their load into a centralized Redis Hash, ensuring live user counts never stagger.
* **Rate Limiting:** Global 3-second throttle on clicks to prevent malicious spamming / automated abuse.

## 💻 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kushagratrvd/1-million-checkboxes.git
   cd 1-million-checkboxes
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start Local Redis:** (Requires Docker)
   ```bash
   docker-compose up -d
   ```

4. **Start the server:**
   ```bash
   pnpm run dev
   ```

5. **Open your browser:** Navigate to `http://localhost:8081`. 

## 🔐 Environment Variables Required
Copy the `.env.example` file to `.env` or set these in your hosting provider (like Render):

* `PORT` (Optional): Port to run the HTTP server on (defaults to 8081).
* `REDIS_URL` (Required for Production): Full connection string for your hosted Redis instance. If undefined, defaults to local `localhost:6379`.


## 🗄 Redis Setup Instructions
* **Local:** Just run `docker-compose up -d`. Our code will automatically fallback to `localhost:6379`.
* **Production (Render):** Deploy a free "Redis" instance on Render. Set its Eviction Policy to `noeviction` (preventing box-deletions when memory is high). Copy the "Internal Connection String" from your Render Redis dashboard and add it to your Web Service as the `REDIS_URL` environment variable.

## 👤 Auth Flow Explanation
Current design opts for **frictionless anonymous access**.
There are no user accounts, passwords, or OAuth flows. Identity and session tracking are tied directly to the ephemeral `socket.id` established during the WebSocket handshake.

## 🔌 WebSocket Flow Explanation

1. **Connection & Hydration:** Client opens a socket. Server fetches all previously ticked checkboxes from a Redis Hash (`checkbox-state`) and sends them to the client via the `initialStates` event.
2. **Global Analytics:** The server broadcasts `server:totalDataUpdate` indicating total users and checkboxes currently active.
3. **The Toggle:** User clicks a box. Client instantly emits `client:checkbox:change`.
4. **Broadcast & Pub/Sub:** The server updates the box value in Redis. To inform users on *other* servers, it publishes a message over Redis (`internal-server:checkbox:change`). All nodes receive this message, and subsequently emit a `server:checkbox:change` directly to their connected frontend clients. 

## 🛡 Rate Limiting Logic Explanation
To prevent an individual from mass-toggling thousands of boxes instantly with a script:
1. **Client-Side:** `clickCooldownMs` is set to 3000 (3 seconds). If a user clicks locally before the time elapses, the UI blocks the emit and shows a toast error.
2. **Server-Side:** Because client-side logic can be bypassed, the server tracks a timestamp in Redis (`rate-limiting:<socket.id>`). If a socket emits an event within 3 seconds of their previous event, the server abandons the database update and sends back a `server:error` warning payload.
