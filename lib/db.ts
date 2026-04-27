import Database from "better-sqlite3";

const DB_PATH = "C:\\Logs\\rdp_access.db";

const db = new Database(DB_PATH);

export default db;