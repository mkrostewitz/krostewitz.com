import {MongoClient} from "mongodb";

const uri = process.env.MONGO_DB_URI;
const dbName = process.env.MONGO_DB_NAME;
const user = process.env.MONGO_DB_USER;
const pass = process.env.MONGO_DB_PASSWORD;

if (!uri || !dbName || !user || !pass) {
  console.warn("MongoDB environment variables are not fully configured.");
}

let cachedClient = null;
let cachedDb = null;

export async function getDb() {
  if (cachedDb) return cachedDb;

  const client = new MongoClient(uri, {
    auth: {username: user, password: pass},
  });
  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;
  return db;
}

export async function closeDb() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
