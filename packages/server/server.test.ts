import { assertEquals, assertExists } from "std/assert";
import server from "./main.ts";

/**
 * Unit tests for the HTTP server
 * These tests can be run with: deno test
 */

Deno.test("Server - Health check endpoint", async () => {
  const request = new Request("http://localhost:8000/health", {
    method: "GET",
  });

  const response = await server.fetch(request);
  const data = await response.json();

  assertEquals(response.status, 200);
  assertEquals(data.status, "ok");
});

Deno.test("Server - CORS preflight request", async () => {
  const request = new Request("http://localhost:8000/api/documents", {
    method: "OPTIONS",
  });

  const response = await server.fetch(request);

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
});

Deno.test("Server - 404 for unknown endpoint", async () => {
  const request = new Request("http://localhost:8000/unknown", {
    method: "GET",
  });

  const response = await server.fetch(request);
  const data = await response.json();

  assertEquals(response.status, 404);
  assertEquals(data.error, "Not Found");
});

Deno.test("Server - Documents endpoint structure", async () => {
  const request = new Request("http://localhost:8000/api/documents", {
    method: "GET",
  });

  const response = await server.fetch(request);
  const data = await response.json();

  assertEquals(response.status, 200);
  assertExists(data.documents);
  assertEquals(Array.isArray(data.documents), true);
});

Deno.test("Server - Invalid document ID returns 400", async () => {
  const request = new Request("http://localhost:8000/api/documents/invalid", {
    method: "GET",
  });

  const response = await server.fetch(request);
  const data = await response.json();

  assertEquals(response.status, 400);
  assertEquals(data.error, "Invalid document ID");
});

Deno.test("Server - Search without query returns 400", async () => {
  const request = new Request("http://localhost:8000/api/documents/search", {
    method: "GET",
  });

  const response = await server.fetch(request);
  const data = await response.json();

  assertEquals(response.status, 400);
  assertEquals(data.error, "Search query is required");
});

Deno.test("Server - Search with query returns proper structure", async () => {
  const request = new Request("http://localhost:8000/api/documents/search?q=test", {
    method: "GET",
  });

  const response = await server.fetch(request);
  const data = await response.json();

  assertEquals(response.status, 200);
  assertExists(data.documents);
  assertExists(data.count);
  assertExists(data.query);
  assertEquals(data.query, "test");
});