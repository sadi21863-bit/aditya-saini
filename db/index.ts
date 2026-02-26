import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema"; // 👈 This is the key change

// Check if we have a connection string
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from your environment variables");
}

// 1. Initialize the Postgres client
const client = postgres(process.env.DATABASE_URL, {
    prepare: false // Recommended for serverless environments like Vercel
});

// 2. Export the db instance with the schema attached
// This "Schema-Aware" setup fixes the Relational API crashes
export const db = drizzle(client, { schema });

// Export the schema so you can import it easily in other files
export * from "./schema";