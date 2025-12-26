import { assertEquals, assertThrows } from "std/assert";
import { DB } from "sqlite";
import { getMessagesInTimeRange, getMessagesWithUserMention, getThreadMessages, validateDateRange } from "../db/messageQueries.ts";
import { SlackMessage } from "../utils/types.ts";
import { initDatabase, saveMentions, saveMessages, saveUsers } from "../db/index.ts";
import { getFilteredMessagesGrouped, MessageFilter } from "./messageRetriever.ts";

// Property-based testing using built-in randomization
function generateRandomDate(start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

function generateRandomMessage(
  id: number,
  channelId: string = "C123456",
  userId: string = "U123456",
  timestamp?: Date,
): SlackMessage {
  const ts = timestamp || new Date();
  return {
    channel_id: channelId,
    channel_name: "test-channel",
    user_id: userId,
    user_name: "testuser",
    text: `Test message ${id}`,
    ts: ts.getTime().toString(),
    thread_id: Math.random() > 0.7 ? (ts.getTime() - 1000).toString() : undefined,
    permalink: `https://test.slack.com/archives/${channelId}/p${ts.getTime()}`,
    created_at: ts.toISOString(),
    mention_type: Math.random() > 0.8 ? "user" : null,
  };
}

function setupTestDatabase(): DB {
  const db = initDatabase(":memory:");
  return db;
}

// Property Test 1: Date Range Filtering Accuracy
// **Feature: slack-topic-generator, Property 1: Date Range Filtering Accuracy**
// **Validates: Requirements 1.1, 2.1**
Deno.test("Property 1: Date Range Filtering Accuracy", () => {
  for (let i = 0; i < 100; i++) {
    const db = setupTestDatabase();

    // Generate random date range
    const baseDate = new Date("2024-01-01");
    const endDate = new Date("2024-12-31");
    const startDate = generateRandomDate(baseDate, endDate);
    const queryEndDate = generateRandomDate(startDate, endDate);

    // Generate random messages with various dates
    const messages: SlackMessage[] = [];
    for (let j = 0; j < 20; j++) {
      const messageDate = generateRandomDate(
        new Date("2023-01-01"),
        new Date("2025-12-31"),
      );
      messages.push(
        generateRandomMessage(j, "C123456", "U123456", messageDate),
      );
    }

    saveMessages(db, messages);

    // Query messages in date range
    const result = getMessagesInTimeRange(db, startDate, queryEndDate);

    // Property: All returned messages should be within the date range
    for (const message of result) {
      const messageDate = new Date(message.created_at);
      const withinRange = messageDate >= startDate &&
        messageDate <= queryEndDate;
      assertEquals(
        withinRange,
        true,
        `Message ${message.id} with date ${message.created_at} is outside range ${startDate.toISOString()} - ${queryEndDate.toISOString()}`,
      );
    }

    db.close();
  }
});

// Property Test 3: Thread Relationship Preservation
// **Feature: slack-topic-generator, Property 3: Thread Relationship Preservation**
// **Validates: Requirements 1.3, 2.2, 3.2, 3.4**
Deno.test("Property 3: Thread Relationship Preservation", () => {
  for (let i = 0; i < 100; i++) {
    const db = setupTestDatabase();

    // Generate a parent message with unique timestamp
    const baseTime = Date.now() + i * 100000; // Ensure unique timestamps across iterations
    const parentTs = baseTime.toString();
    const parentMessage: SlackMessage = {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U123456",
      user_name: "testuser",
      text: "Parent message",
      ts: parentTs,
      permalink: `https://test.slack.com/archives/C123456/p${parentTs}`,
      created_at: new Date(baseTime).toISOString(),
      mention_type: null,
    };

    // Generate random number of thread replies
    const numReplies = Math.floor(Math.random() * 10) + 1;
    const threadMessages: SlackMessage[] = [parentMessage];

    for (let j = 0; j < numReplies; j++) {
      const replyTime = baseTime + (j + 1) * 1000; // Ensure replies have different timestamps
      const replyTs = replyTime.toString();
      const replyMessage: SlackMessage = {
        channel_id: "C123456",
        channel_name: "test-channel",
        user_id: `U${j}`,
        user_name: `user${j}`,
        text: `Reply ${j}`,
        ts: replyTs,
        thread_id: parentTs, // Link to parent
        permalink: `https://test.slack.com/archives/C123456/p${replyTs}`,
        created_at: new Date(replyTime).toISOString(),
        mention_type: null,
      };
      threadMessages.push(replyMessage);
    }

    saveMessages(db, threadMessages);

    // Retrieve thread messages
    const retrievedThread = getThreadMessages(db, parentTs);

    // Property: All thread messages should be retrieved and maintain relationships
    assertEquals(
      retrievedThread.length,
      threadMessages.length,
      `Expected ${threadMessages.length} thread messages, got ${retrievedThread.length}`,
    );

    // Property: Parent message should be included
    const hasParent = retrievedThread.some((msg) => msg.ts === parentTs && !msg.thread_id);
    assertEquals(
      hasParent,
      true,
      "Parent message should be included in thread results",
    );

    // Property: All replies should reference the parent
    const replies = retrievedThread.filter((msg) => msg.thread_id === parentTs);
    assertEquals(
      replies.length,
      numReplies,
      `Expected ${numReplies} replies, got ${replies.length}`,
    );

    // Property: Messages should be ordered by creation time
    for (let k = 1; k < retrievedThread.length; k++) {
      const prevDate = new Date(retrievedThread[k - 1].created_at);
      const currDate = new Date(retrievedThread[k].created_at);
      assertEquals(
        prevDate <= currDate,
        true,
        "Thread messages should be ordered by creation time",
      );
    }

    db.close();
  }
});

// Additional unit tests for edge cases
Deno.test("Date range validation", () => {
  const validStart = new Date("2024-01-01");
  const validEnd = new Date("2024-01-31");
  const invalidStart = new Date("invalid");

  // Valid date range should not throw
  validateDateRange(validStart, validEnd);

  // Invalid start date should throw
  assertThrows(() => validateDateRange(invalidStart, validEnd));

  // Invalid end date should throw
  assertThrows(() => validateDateRange(validStart, new Date("invalid")));

  // Start date after end date should throw
  assertThrows(() => validateDateRange(validEnd, validStart));
});

Deno.test("User mention filtering", () => {
  const db = setupTestDatabase();

  // Setup test data with proper Slack mention format
  const baseTime = Date.now();
  const messages: SlackMessage[] = [
    {
      ...generateRandomMessage(1, "C123", "U1", new Date(baseTime)),
      text: "First message",
    },
    {
      ...generateRandomMessage(2, "C123", "U2", new Date(baseTime + 1000)),
      text: "Hello <@U1> how are you?", // Proper Slack mention format
    },
    {
      ...generateRandomMessage(3, "C123", "U3", new Date(baseTime + 2000)),
      text: "Third message",
    },
  ];

  saveMessages(db, messages);
  saveUsers(db, [
    { user_id: "U1", user_name: "testuser", nickname: "Test User" },
    { user_id: "U2", user_name: "otheruser", nickname: "Other User" },
    { user_id: "U3", user_name: "thirduser", nickname: "Third User" },
  ]);

  saveMentions(db, [
    { channel_id: "C123", message_ts: messages[1].ts, user_id: "U1" },
  ]);

  const startDate = new Date("2025-01-01");
  const endDate = new Date("2025-12-31");

  // Test with user ID format
  const mentionResults = getMessagesWithUserMention(
    db,
    startDate,
    endDate,
    "U1",
  );

  // Should find the message that mentions U1
  assertEquals(
    mentionResults.length >= 1,
    true,
    "Should find messages mentioning the user",
  );

  // Test with Slack mention format
  const slackMentionResults = getMessagesWithUserMention(
    db,
    startDate,
    endDate,
    "<@U1>",
  );
  assertEquals(
    slackMentionResults.length >= 1,
    true,
    "Should find messages with Slack mention format",
  );

  db.close();
});

// Property Test 13: Date Format Validation
// **Feature: slack-topic-generator, Property 13: Date Format Validation**
// **Validates: Requirements 4.1, 4.2, 4.3**
Deno.test("Property 13: Date Format Validation", async () => {
  // Import the parseDate function for testing
  const { parseDate } = await import("../agent/index.ts");

  for (let i = 0; i < 100; i++) {
    // Generate valid YYYY-MM-DD format dates
    const year = 2020 + Math.floor(Math.random() * 10); // 2020-2029
    const month = Math.floor(Math.random() * 12) + 1; // 1-12
    const day = Math.floor(Math.random() * 28) + 1; // 1-28 (safe for all months)

    const validDate = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

    // Property: Valid YYYY-MM-DD format should be accepted
    try {
      const parsed = parseDate(validDate, "test");
      assertEquals(
        parsed instanceof Date,
        true,
        `Valid date ${validDate} should parse successfully`,
      );
      assertEquals(
        isNaN(parsed.getTime()),
        false,
        `Parsed date ${validDate} should be valid`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Valid date format ${validDate} was rejected: ${errorMessage}`,
      );
    }

    // Generate invalid date formats (format issues, not calendar validity)
    const invalidFormats = [
      `${year}/${month}/${day}`, // Wrong separator
      `${month}-${day}-${year}`, // Wrong order
      `${year}.${month}.${day}`, // Wrong separator
      `${year}${month}${day}`, // No separators
      "invalid-date",
      "",
      "2024-13-01", // Invalid month (> 12)
      "2024-00-15", // Invalid month (0)
      "abcd-ef-gh", // Non-numeric
      "2024-1-1", // Missing zero padding
      "24-01-01", // Wrong year format (2 digits)
      "2024-1-01", // Missing zero padding in month
      "2024-01-1", // Missing zero padding in day
    ];

    // Property: Invalid formats should be rejected
    for (const invalidDate of invalidFormats) {
      let wasRejected = false;
      try {
        parseDate(invalidDate, "test");
      } catch (error) {
        wasRejected = true;
        assertEquals(
          error instanceof Error,
          true,
          "Should throw an Error object",
        );
        const errorMessage = error instanceof Error ? error.message : String(error);
        assertEquals(
          errorMessage.includes("Invalid") || errorMessage.includes("format"),
          true,
          `Error message should indicate format issue for ${invalidDate}: ${errorMessage}`,
        );
      }
      assertEquals(
        wasRejected,
        true,
        `Invalid date format ${invalidDate} should be rejected`,
      );
    }
  }
});

// Property Test 14: Parameter Validation
// **Feature: slack-topic-generator, Property 14: Parameter Validation**
// **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
Deno.test("Property 14: Parameter Validation", async () => {
  // Import the parseCommandArgs function for testing
  const { parseCommandArgs } = await import("../agent/index.ts");

  for (let i = 0; i < 100; i++) {
    // Generate valid date strings ensuring start <= end
    const year1 = 2020 + Math.floor(Math.random() * 5);
    const year2 = year1 + Math.floor(Math.random() * 2); // Ensure end >= start year
    const month1 = Math.floor(Math.random() * 12) + 1;
    const month2 = Math.floor(Math.random() * 12) + 1;
    const day1 = Math.floor(Math.random() * 28) + 1;
    const day2 = Math.floor(Math.random() * 28) + 1;

    let startDate = `${year1}-${month1.toString().padStart(2, "0")}-${day1.toString().padStart(2, "0")}`;
    let endDate = `${year2}-${month2.toString().padStart(2, "0")}-${day2.toString().padStart(2, "0")}`;

    // Ensure start date is before or equal to end date
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (startDateObj > endDateObj) {
      // Swap them
      [startDate, endDate] = [endDate, startDate];
    }

    // Property: Valid parameters should be accepted
    const validArgs = [startDate, endDate];
    try {
      const result = parseCommandArgs(validArgs);
      assertEquals(
        result.startDate instanceof Date,
        true,
        "Start date should be a Date object",
      );
      assertEquals(
        result.endDate instanceof Date,
        true,
        "End date should be a Date object",
      );
      assertEquals(
        result.startDate <= result.endDate,
        true,
        "Start date should be <= end date",
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Valid args [${validArgs.join(", ")}] were rejected: ${errorMessage}`,
      );
    }

    // Property: Valid parameters with user containing should be accepted
    const validUserContainings = [
      "@testuser",
      "testuser",
      "U123456789",
      "user.name",
      "user-name",
      "user_name",
    ];

    const randomContaining = validUserContainings[Math.floor(Math.random() * validUserContainings.length)];
    const validArgsWithContaining = [startDate, endDate, randomContaining];

    try {
      const result = parseCommandArgs(validArgsWithContaining);
      assertEquals(
        result.userContainings?.[0],
        randomContaining,
        "User containing should be preserved",
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Valid args with containing [${validArgsWithContaining.join(", ")}] were rejected: ${errorMessage}`,
      );
    }

    // Property: Missing required parameters should be rejected
    const insufficientArgs = [
      [], // No parameters
      [startDate], // Only start date
    ];

    for (const args of insufficientArgs) {
      let wasRejected = false;
      try {
        parseCommandArgs(args);
      } catch (error) {
        wasRejected = true;
        assertEquals(
          error instanceof Error,
          true,
          "Should throw an Error object",
        );
        const errorMessage = error instanceof Error ? error.message : String(error);
        assertEquals(
          errorMessage.includes("Missing required parameters"),
          true,
          `Error should indicate missing parameters for args: [${args.join(", ")}]`,
        );
      }
      assertEquals(
        wasRejected,
        true,
        `Insufficient args [${args.join(", ")}] should be rejected`,
      );
    }

    // Property: Multiple user containings should be accepted
    const multipleUserArgs = [startDate, endDate, "user1", "user2", "user3"];
    let multipleUsersAccepted = false;
    try {
      const result = parseCommandArgs(multipleUserArgs);
      multipleUsersAccepted = true;
      assertEquals(
        result.userContainings?.length,
        3,
        "Should accept multiple user containings",
      );
    } catch (error) {
      // Should not throw for multiple valid user containings
    }
    assertEquals(
      multipleUsersAccepted,
      true,
      "Multiple user containings should be accepted",
    );

    // Property: Invalid user containing formats should be rejected
    const invalidContainings = [
      "", // Empty string
      "   ", // Whitespace only
      "@", // Just @ symbol
      "<@U123456>", // Slack mention format (not supported for containings)
      "user@domain", // Email-like format
      "user with spaces", // Spaces in username
      "user!@#$%", // Special characters
    ];

    for (const invalidContaining of invalidContainings) {
      const argsWithInvalidContaining = [startDate, endDate, invalidContaining];
      let wasRejected = false;
      try {
        parseCommandArgs(argsWithInvalidContaining);
      } catch (error) {
        wasRejected = true;
        assertEquals(
          error instanceof Error,
          true,
          "Should throw an Error object",
        );
        const errorMessage = error instanceof Error ? error.message : String(error);
        assertEquals(
          errorMessage.includes("Invalid") || errorMessage.includes("empty"),
          true,
          `Error should indicate invalid containing format for: "${invalidContaining}"`,
        );
      }
      assertEquals(
        wasRejected,
        true,
        `Invalid containing "${invalidContaining}" should be rejected`,
      );
    }

    // Property: Start date after end date should be rejected
    // Generate a case where start > end by adding days to the start date
    const laterYear = year1 + 1;
    const laterDate = `${laterYear}-${month1.toString().padStart(2, "0")}-${day1.toString().padStart(2, "0")}`;
    const invalidDateOrderArgs = [laterDate, startDate]; // later date as start, earlier as end

    let dateOrderRejected = false;
    try {
      parseCommandArgs(invalidDateOrderArgs);
    } catch (error) {
      dateOrderRejected = true;
      assertEquals(
        error instanceof Error,
        true,
        "Should throw an Error object",
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      assertEquals(
        errorMessage.includes("Start date") && errorMessage.includes("before"),
        true,
        "Error should indicate start date must be before end date",
      );
    }
    assertEquals(
      dateOrderRejected,
      true,
      "Start date after end date should be rejected",
    );
  }
});

// Test for grouped messages functionality
Deno.test("Grouped Messages: Thread Grouping Accuracy", () => {
  const db = setupTestDatabase();

  // Create test messages with thread relationships
  const baseTime = Date.now();
  const parentTs = baseTime.toString();

  const messages: SlackMessage[] = [
    // Parent message
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U1",
      user_name: "user1",
      text: "Parent message",
      ts: parentTs,
      permalink: `https://test.slack.com/archives/C123456/p${parentTs}`,
      created_at: new Date(baseTime).toISOString(),
      mention_type: null,
    },
    // Thread replies
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U2",
      user_name: "user2",
      text: "Reply 1",
      ts: (baseTime + 1000).toString(),
      thread_id: parentTs,
      permalink: `https://test.slack.com/archives/C123456/p${baseTime + 1000}`,
      created_at: new Date(baseTime + 1000).toISOString(),
      mention_type: null,
    },
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U3",
      user_name: "user3",
      text: "Reply 2",
      ts: (baseTime + 2000).toString(),
      thread_id: parentTs,
      permalink: `https://test.slack.com/archives/C123456/p${baseTime + 2000}`,
      created_at: new Date(baseTime + 2000).toISOString(),
      mention_type: null,
    },
    // Standalone message
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U4",
      user_name: "user4",
      text: "Standalone message",
      ts: (baseTime + 3000).toString(),
      permalink: `https://test.slack.com/archives/C123456/p${baseTime + 3000}`,
      created_at: new Date(baseTime + 3000).toISOString(),
      mention_type: null,
    },
  ];

  saveMessages(db, messages);

  const filter: MessageFilter = {
    startDate: new Date(baseTime - 1000),
    endDate: new Date(baseTime + 4000),
    includeThreads: true,
  };

  const groupedResult = getFilteredMessagesGrouped(db, filter);

  // Verify thread grouping
  assertEquals(groupedResult.threads.length, 1, "Should have exactly one thread");
  assertEquals(groupedResult.standaloneMessages.length, 1, "Should have exactly one standalone message");
  assertEquals(groupedResult.totalMessageCount, 4, "Should have total of 4 messages");

  const thread = groupedResult.threads[0];
  assertEquals(thread.parentMessage.text, "Parent message", "Parent message should be correctly identified");
  assertEquals(thread.replies.length, 2, "Thread should have 2 replies");
  assertEquals(thread.messageCount, 3, "Thread should have total of 3 messages (parent + 2 replies)");
  assertEquals(thread.threadId, parentTs, "Thread ID should match parent timestamp");

  // Verify replies are in chronological order
  assertEquals(thread.replies[0].text, "Reply 1", "First reply should be Reply 1");
  assertEquals(thread.replies[1].text, "Reply 2", "Second reply should be Reply 2");

  // Verify standalone message
  assertEquals(groupedResult.standaloneMessages[0].text, "Standalone message", "Standalone message should be correctly identified");

  db.close();
});

// Test for grouped messages with no threads
Deno.test("Grouped Messages: No Threads Scenario", () => {
  const db = setupTestDatabase();

  const baseTime = Date.now();
  const messages: SlackMessage[] = [
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U1",
      user_name: "user1",
      text: "Message 1",
      ts: baseTime.toString(),
      permalink: `https://test.slack.com/archives/C123456/p${baseTime}`,
      created_at: new Date(baseTime).toISOString(),
      mention_type: null,
    },
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U2",
      user_name: "user2",
      text: "Message 2",
      ts: (baseTime + 1000).toString(),
      permalink: `https://test.slack.com/archives/C123456/p${baseTime + 1000}`,
      created_at: new Date(baseTime + 1000).toISOString(),
      mention_type: null,
    },
  ];

  saveMessages(db, messages);

  const filter: MessageFilter = {
    startDate: new Date(baseTime - 1000),
    endDate: new Date(baseTime + 2000),
    includeThreads: true,
  };

  const groupedResult = getFilteredMessagesGrouped(db, filter);

  assertEquals(groupedResult.threads.length, 0, "Should have no threads");
  assertEquals(groupedResult.standaloneMessages.length, 2, "Should have 2 standalone messages");
  assertEquals(groupedResult.totalMessageCount, 2, "Should have total of 2 messages");

  db.close();
});

// Test for grouped messages with orphaned replies
Deno.test("Grouped Messages: Orphaned Replies Handling", () => {
  const db = setupTestDatabase();

  const baseTime = Date.now();
  const messages: SlackMessage[] = [
    // Reply without parent in the result set
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U1",
      user_name: "user1",
      text: "Orphaned reply",
      ts: baseTime.toString(),
      thread_id: "nonexistent_parent",
      permalink: `https://test.slack.com/archives/C123456/p${baseTime}`,
      created_at: new Date(baseTime).toISOString(),
      mention_type: null,
    },
  ];

  saveMessages(db, messages);

  const filter: MessageFilter = {
    startDate: new Date(baseTime - 1000),
    endDate: new Date(baseTime + 1000),
    includeThreads: true,
  };

  const groupedResult = getFilteredMessagesGrouped(db, filter);

  // With the new logic, orphaned replies are grouped into threads with the first reply as pseudo-parent
  assertEquals(groupedResult.threads.length, 1, "Should create a thread from orphaned reply");
  assertEquals(groupedResult.standaloneMessages.length, 0, "Should have no standalone messages");
  assertEquals(groupedResult.totalMessageCount, 1, "Should have total of 1 message");

  // Verify the thread structure
  const thread = groupedResult.threads[0];
  assertEquals(thread.messageCount, 1, "Thread should have 1 message");
  assertEquals(thread.replies.length, 0, "Thread should have no replies (orphaned reply becomes pseudo-parent)");
  assertEquals(thread.parentMessage.text, "Orphaned reply", "Orphaned reply should become the pseudo-parent");
  assertEquals(thread.parentMessage.thread_id, undefined, "Pseudo-parent should not have thread_id");

  db.close();
});

// Test for multiple orphaned replies
Deno.test("Grouped Messages: Multiple Orphaned Replies", () => {
  const db = setupTestDatabase();

  const baseTime = Date.now();
  const messages: SlackMessage[] = [
    // Multiple replies without parent in the result set
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U1",
      user_name: "user1",
      text: "First orphaned reply",
      ts: baseTime.toString(),
      thread_id: "nonexistent_parent",
      permalink: `https://test.slack.com/archives/C123456/p${baseTime}`,
      created_at: new Date(baseTime).toISOString(),
      mention_type: null,
    },
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U2",
      user_name: "user2",
      text: "Second orphaned reply",
      ts: (baseTime + 1000).toString(),
      thread_id: "nonexistent_parent",
      permalink: `https://test.slack.com/archives/C123456/p${baseTime + 1000}`,
      created_at: new Date(baseTime + 1000).toISOString(),
      mention_type: null,
    },
    {
      channel_id: "C123456",
      channel_name: "test-channel",
      user_id: "U3",
      user_name: "user3",
      text: "Third orphaned reply",
      ts: (baseTime + 2000).toString(),
      thread_id: "nonexistent_parent",
      permalink: `https://test.slack.com/archives/C123456/p${baseTime + 2000}`,
      created_at: new Date(baseTime + 2000).toISOString(),
      mention_type: null,
    },
  ];

  saveMessages(db, messages);

  const filter: MessageFilter = {
    startDate: new Date(baseTime - 1000),
    endDate: new Date(baseTime + 3000),
    includeThreads: true,
  };

  const groupedResult = getFilteredMessagesGrouped(db, filter);

  // Should create one thread with first reply as pseudo-parent and others as replies
  assertEquals(groupedResult.threads.length, 1, "Should create one thread from orphaned replies");
  assertEquals(groupedResult.standaloneMessages.length, 0, "Should have no standalone messages");
  assertEquals(groupedResult.totalMessageCount, 3, "Should have total of 3 messages");

  // Verify the thread structure
  const thread = groupedResult.threads[0];
  assertEquals(thread.messageCount, 3, "Thread should have 3 messages");
  assertEquals(thread.replies.length, 2, "Thread should have 2 replies");
  assertEquals(thread.parentMessage.text, "First orphaned reply", "First orphaned reply should become pseudo-parent");
  assertEquals(thread.parentMessage.thread_id, undefined, "Pseudo-parent should not have thread_id");
  assertEquals(thread.replies[0].text, "Second orphaned reply", "Second reply should be in replies");
  assertEquals(thread.replies[1].text, "Third orphaned reply", "Third reply should be in replies");

  db.close();
});
