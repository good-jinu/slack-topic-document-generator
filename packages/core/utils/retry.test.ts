import { assertEquals, assertRejects } from "std/assert";
import { createRetryWrapper, RetryError, withRetry } from "./retry.ts";

Deno.test("withRetry - successful operation", async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    return Promise.resolve("success");
  };

  const result = await withRetry(operation, {
    maxRetries: 3,
    delay: 10,
  });

  assertEquals(result, "success");
  assertEquals(attempts, 1);
});

Deno.test("withRetry - retry on failure then success", async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) {
      throw new Error("Temporary failure");
    }
    return Promise.resolve("success");
  };

  const result = await withRetry(operation, {
    maxRetries: 3,
    delay: 10,
  });

  assertEquals(result, "success");
  assertEquals(attempts, 3);
});

Deno.test("withRetry - max retries exceeded", async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    throw new Error("Persistent failure");
  };

  await assertRejects(
    () =>
      withRetry(operation, {
        maxRetries: 2,
        delay: 10,
      }),
    RetryError,
    "Operation failed after 2 attempts",
  );

  assertEquals(attempts, 2);
});

Deno.test("createRetryWrapper - wraps function with retry logic", async () => {
  let attempts = 0;
  const originalFn = (value: string) => {
    attempts++;
    if (attempts < 2) {
      throw new Error("Failure");
    }
    return Promise.resolve(`processed: ${value}`);
  };

  const wrappedFn = createRetryWrapper(originalFn, {
    maxRetries: 3,
    delay: 10,
  });

  const result = await wrappedFn("test");
  assertEquals(result, "processed: test");
  assertEquals(attempts, 2);
});
