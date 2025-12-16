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
let initPromise = null;

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

export async function initMongoConnection() {
  if (cachedDb) {
    console.info("[mongo] Connected to database \"%s\".", cachedDb.databaseName);
    return cachedDb;
  }

  if (!initPromise) {
    initPromise = getDb()
      .then((db) => {
        console.info("[mongo] Connected to database \"%s\".", db.databaseName);
        return db;
      })
      .catch((err) => {
        console.error("[mongo] Failed to connect on startup:", err);
        throw err;
      })
      .finally(() => {
        initPromise = null;
      });
  }

  return initPromise;
}

export async function closeDb() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
