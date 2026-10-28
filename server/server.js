import dns from "node:dns";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createMemoryStore, createMongoStore } from "./authStore.js";

dotenv.config();

// Atlas "mongodb+srv://" URIs need an SRV DNS lookup. Some Windows setups hand Node a local resolver (127.0.0.1)
// that refuses those, so DNS_SERVERS (e.g. "1.1.1.1,8.8.8.8") lets Node ask a public resolver instead.
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(",").map((server) => server.trim()).filter(Boolean));

const port = Number(process.env.PORT) || 3001;
let store = null;

// The server starts even if MongoDB is unreachable, so recipes keep working; account requests get a 503 until it connects.
async function connectStore() {
  if (process.env.AUTH_STORE === "memory") {
    store = createMemoryStore();
    console.log("Accounts use an in-memory store (AUTH_STORE=memory); they are lost on restart.");
    return;
  }
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI is not set, so login and sign-up are unavailable. Add it to .env.");
    return;
  }
  try {
    store = await createMongoStore(process.env.MONGODB_URI, process.env.MONGODB_DB || "gather");
    console.log("Connected to MongoDB.");
  } catch (error) {
    console.error("Could not connect to MongoDB. Check MONGODB_URI, the database user's password, and Atlas Network Access.", error.message);
  }
}

createApp({ getStore: () => store }).listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
connectStore();
