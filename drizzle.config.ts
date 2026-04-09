import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./shared/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: "postgresql://bus_w3id_user:npZkYzgf50Xp6T68keN9oR6CDXYGw0lk@dpg-d79sr87kijhs73dui1eg-a/bus_w3id",
    },
});
