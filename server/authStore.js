import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

// Users and sessions live in MongoDB Atlas. Both stores expose the same methods, so the auth routes
// don't care which one they get; the in-memory store is for tests and running without a database.

const withId = (doc) => doc && { ...doc, id: String(doc._id) };

export async function createMongoStore(uri, dbName = "gather") {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection("users");
  const sessions = db.collection("sessions");
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    // Atlas deletes sessions on its own once they expire.
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  const toObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

  return {
    findUserByEmail: async (email) => withId(await users.findOne({ email })),
    findUserById: async (id) => withId(await users.findOne({ _id: toObjectId(id) })),
    // Returns null when the email is already registered (unique index).
    async insertUser(user) {
      try {
        const { insertedId } = await users.insertOne(user);
        return { ...user, id: String(insertedId) };
      } catch (error) {
        if (error.code === 11000) return null;
        throw error;
      }
    },
    insertSession: (session) => sessions.insertOne({ ...session, userId: toObjectId(session.userId) }),
    async findSession(tokenHash) {
      const session = await sessions.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
      return session && { ...session, userId: String(session.userId) };
    },
    deleteSession: (tokenHash) => sessions.deleteOne({ tokenHash }),
    close: () => client.close(),
  };
}

export function createMemoryStore() {
  const users = new Map();
  const sessions = new Map();
  return {
    findUserByEmail: async (email) => [...users.values()].find((user) => user.email === email) ?? null,
    findUserById: async (id) => users.get(id) ?? null,
    async insertUser(user) {
      if ([...users.values()].some((existing) => existing.email === user.email)) return null;
      const saved = { ...user, id: randomUUID() };
      users.set(saved.id, saved);
      return saved;
    },
    insertSession: async (session) => sessions.set(session.tokenHash, session),
    async findSession(tokenHash) {
      const session = sessions.get(tokenHash);
      return session && session.expiresAt > new Date() ? session : null;
    },
    deleteSession: async (tokenHash) => sessions.delete(tokenHash),
    close: async () => {},
  };
}
