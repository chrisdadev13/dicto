import Database from "@tauri-apps/plugin-sql";

export const db = await Database.load("sqlite:mydatabase.db");

// Insert a user
await db.execute("INSERT INTO users (id, name) VALUES (?, ?)", [1, "Chris"]);

// Select all users
const users = await db.select("SELECT * FROM users");
console.log("Users:", users);
