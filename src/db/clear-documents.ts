#!/usr/bin/env -S deno run --allow-read --allow-write

import { clearDocuments, initDatabase } from "./index.ts";

/**
 * CLI script to clear all documents and related relations from the database
 */
function main() {
  try {
    const db = initDatabase();
    clearDocuments(db);
    db.close();
    console.log("✅ Successfully cleared all documents from database");
  } catch (error) {
    console.error("❌ Failed to clear documents:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
