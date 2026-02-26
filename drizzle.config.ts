import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// This loads your DATABASE_URL from the .env file
dotenv.config();

export default defineConfig({
    schema: "./db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});