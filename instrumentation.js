import {initMongoConnection} from "./src/app/lib/mongo";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  await initMongoConnection();
}
