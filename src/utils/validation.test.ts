import { assertEquals, assertThrows } from "std/assert";
import {
  parseAndValidateDate,
  validateDateRange,
  validateDateString,
  validateUserMention,
} from "./validation.ts";

Deno.test("validateDateRange - valid range", () => {
  const start = new Date("2025-01-01");
  const end = new Date("2025-01-31");
  const result = validateDateRange(start, end);
  assertEquals(result.isValid, true);
});

Deno.test("validateDateRange - invalid start date", () => {
  const start = new Date("invalid");
  const end = new Date("2025-01-31");
  const result = validateDateRange(start, end);
  assertEquals(result.isValid, false);
  assertEquals(result.error, "Invalid start date");
});

Deno.test("validateDateRange - start after end", () => {
  const start = new Date("2025-01-31");
  const end = new Date("2025-01-01");
  const result = validateDateRange(start, end);
  assertEquals(result.isValid, false);
  assertEquals(result.error, "Start date must be before or equal to end date");
});

Deno.test("validateUserMention - valid username", () => {
  const result = validateUserMention("@john.doe");
  assertEquals(result.isValid, true);
});

Deno.test("validateUserMention - valid user ID", () => {
  const result = validateUserMention("<@U123456>");
  assertEquals(result.isValid, true);
});

Deno.test("validateUserMention - empty mention", () => {
  const result = validateUserMention("");
  assertEquals(result.isValid, false);
  assertEquals(result.error, "User mention cannot be empty");
});

Deno.test("validateDateString - valid format", () => {
  const result = validateDateString("2025-01-01", "test date");
  assertEquals(result.isValid, true);
});

Deno.test("validateDateString - invalid format", () => {
  const result = validateDateString("01/01/2025", "test date");
  assertEquals(result.isValid, false);
});

Deno.test("parseAndValidateDate - valid date", () => {
  const date = parseAndValidateDate("2025-01-01", "test date");
  assertEquals(date.getFullYear(), 2025);
  assertEquals(date.getMonth(), 0); // January is 0
  assertEquals(date.getDate(), 1);
});

Deno.test("parseAndValidateDate - invalid date", () => {
  assertThrows(
    () => parseAndValidateDate("invalid", "test date"),
    Error,
    "Invalid test date format",
  );
});
