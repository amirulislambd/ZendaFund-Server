import "dotenv/config";
import { MongoClient, Db, Collection, Document } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is required in environment variables");
}

const client = new MongoClient(uri);
const dbPromise: Promise<Db> = client.connect().then(() => client.db("ZendaFund"));

export type Collections = {
  user: Collection<Document>;
  session: Collection<Document>;
  campaigns: Collection<Document>;
  contributions: Collection<Document>;
  payments: Collection<Document>;
  withdrawals: Collection<Document>;
  notifications: Collection<Document>;
  reports: Collection<Document>;
};

export async function getCollections(): Promise<Collections> {
  const db = await dbPromise;
  return {
    user: db.collection("user"),
    session: db.collection("session"),
    campaigns: db.collection("campaigns"),
    contributions: db.collection("contributions"),
    payments: db.collection("payments"),
    withdrawals: db.collection("withdrawals"),
    notifications: db.collection("notifications"),
    reports: db.collection("reports"),
  };
}

export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await dbPromise;
  return db.collection<T>(name);
}

export { client, dbPromise };
