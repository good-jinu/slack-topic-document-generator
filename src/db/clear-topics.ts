#!/usr/bin/env -S deno run --allow-read --allow-write

import { clearTopics, initDatabase } from "./index.ts";

/**
 * CLI script to clear all topics and related relations from the database
 */
function main() {
  try {
    const db = initDatabase();
    clearTopics(db);
    db.close();
    console.log("✅ Successfully cleared all topics from database");
  } catch (error) {
    console.error("❌ Failed to clear topics:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
