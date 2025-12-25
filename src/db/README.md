# Database Module

This module handles all SQLite database operations for the Slack message enhancement application.

## Files

- `index.ts` - Main database functions and schema definitions
- `clear-documents.ts` - CLI script to clear all documents and relations

## Available Functions

### Database Initialization

- `initDatabase(dbPath?)` - Initialize SQLite database with required tables

### Message Operations

- `saveMessages(db, messages)` - Insert/update messages
- `getMessages(db, limit?)` - Fetch messages with optional limit

### User Operations

- `saveUsers(db, users)` - Insert/update users
- `getUsers(db, limit?)` - Fetch users with optional limit
- `getUserName(db, userId)` - Get display name for a user ID

### Group Operations

- `saveGroups(db, groups)` - Insert/update groups
- `getGroups(db, limit?)` - Fetch groups with optional limit
- `getGroupName(db, groupId)` - Get group name for a group ID

### Mention Operations

- `saveMentions(db, mentions)` - Insert/update mentions
- `getMentions(db, limit?)` - Fetch mentions with optional limit

### Document Operations

- `saveDocument(db, name, isUpdate?)` - Insert/update document
- `getDocumentByName(db, name)` - Get document by name
- `getDocuments(db, limit?)` - Get all documents
- `clearDocuments(db)` - Clear all documents and relations

### Message-Document Relations

- `saveMessageDocumentRelations(db, relations)` - Save message-document links
- `getMessageDocumentRelations(db, messageId?, documentId?, limit?)` - Get relations

## CLI Tasks

Run `deno task db:clear-documents` to clear all documents and their relations from the database.
