#!/usr/bin/env -S deno run --allow-net --allow-read

import server from "./main.ts";

const port = parseInt(Deno.env.get("PORT") || "8000");
const hostname = Deno.env.get("HOST") || "localhost";

console.log(`🚀 Server starting on http://${hostname}:${port}`);
console.log(`📚 API endpoints:`);
console.log(`  GET /api/documents - List all documents`);
console.log(`  GET /api/documents/:id - Get specific document`);
console.log(`  GET /health - Health check`);

Deno.serve({ port, hostname }, server.fetch);
