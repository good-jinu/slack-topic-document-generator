# Slack Topic Document Generator

A powerful tool to crawl Slack messages, analyze conversations, and automatically generate documentation using AI. This project helps teams capture knowledge from Slack discussions and transform them into organized, searchable documents with comprehensive topic tracking.

## Features

- **Slack Message Crawling**: Extract messages from specified Slack channels with date filtering
- **User and Group Mention Filtering**: Generate documents for specific user or group mentions with support for multiple filters
- **Merged User/Group Management**: Unified handling of users and groups in a single database table
- **AI-Powered Analysis**: Use Google Gemini, OpenAI, or compatible AI providers to identify topics and generate documentation
- **Enhanced Topic Management**: Store topics with titles, descriptions, date ranges, and associated documents
- **Document Management**: Automatically create and update markdown documents from conversation topics
- **Robust Architecture**: Built with TypeScript, comprehensive error handling, and retry logic
- **Configurable Logging**: Structured logging with multiple levels
- **Database Storage**: Store messages, users, topics, and relationships in SQLite database with backup support

## Prerequisites

- [mise](https://mise.jdx.dev/) installed (recommended) or [Deno](https://deno.land/) runtime
- Slack workspace with appropriate permissions
- AI API key (Google AI, OpenAI, or compatible API provider)

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd slack-topic-document-generator

# Install runtime using mise (recommended)
mise install

# Or install Deno directly if you prefer
# Visit https://deno.land/ for installation instructions
```

### 2. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your credentials

### 3. Get Slack Token

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create a new app or use existing one
3. Navigate to "OAuth & Permissions"
4. Add these scopes:
   - `channels:history`
   - `groups:history`
   - `users:read`
   - `usergroups:read`
5. Install app to workspace and copy the "User OAuth Token"

### 4. Get AI API Key

Choose one of the supported AI providers:

#### Google AI (Gemini)

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Add it to your `.env` file as `AI_API_KEY`
4. Set `AI_PROVIDER=google` (default)

#### OpenAI

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add it to your `.env` file as `AI_API_KEY`
4. Set `AI_PROVIDER=openai`
5. Optionally set `AI_MODEL=gpt-4` or your preferred model

#### Compatible APIs (Anthropic, etc.)

1. Get your API key from your provider
2. Add it to your `.env` file as `AI_API_KEY`
3. Set `AI_PROVIDER=openai` (uses OpenAI-compatible format)
4. Set `AI_BASE_URL` to your provider's endpoint
5. Set `AI_MODEL` to your preferred model

### 5. Find Channel IDs

In Slack, right-click on a channel → "View channel details" → Copy the Channel ID from the bottom of the modal.

## Usage

### Basic Workflow

1. **Crawl Messages**: Extract messages from Slack channels
2. **Generate Documents**: Use AI to analyze and create documentation
3. **View Results**: Browse stored data and generated documents

### Commands

#### Crawl Slack Messages

```bash
deno task crawl [start-date] [end-date]
```

Examples:

```bash
# Crawl all available messages
deno task crawl

# Crawl messages from specific date range
deno task crawl 2025-12-01 2025-12-24
```

This will:

- Connect to Slack using your token
- Fetch messages from specified channels and date range
- Extract user mentions and group mentions
- Store everything in SQLite database

#### Generate Documentation

```bash
deno task generate <start-date> <end-date> [user1] [user2] [group1] ...
```

Examples:

```bash
# Generate docs for date range
deno task generate 2025-12-20 2025-12-24

# Generate docs for specific user mentions
deno task generate 2025-12-20 2025-12-24 @john.doe
deno task generate 2025-12-20 2025-12-24 <@U123456789>

# Generate docs for multiple users and groups
deno task generate 2025-12-20 2025-12-24 @john.doe @team-leads developers
deno task generate 2025-12-20 2025-12-24 U123456 S789012 @support-team

# Generate docs for specific day
deno task generate 2025-12-20 2025-12-20
```

**User/Group mention formats supported:**

- `@username` - Username with @ prefix
- `username` - Username without @ prefix
- `<@U123456>` - Slack user ID format
- `U123456` - Raw Slack user ID
- `@groupname` - Group name with @ prefix
- `groupname` - Group name without @ prefix
- `S123456` - Raw Slack group ID

This will:

- Analyze messages in the date range (optionally filtered by user/group mentions)
- Use AI to identify discussion topics with retry logic
- Generate or update markdown documents in configured output directory
- Store topic metadata including titles, descriptions, and date ranges
- Link topics to original messages in database

#### View Stored Data

```bash
deno task view
```

Shows a summary of:

- Recent messages
- Users in database
- Groups in database
- Mentions tracked
- Generated topics and documents
- Message-topic relationships

#### Database Management

```bash
# Clear all topics and relations
deno task db:clear-topics

# Migrate existing database to new schema (merges groups into users table, converts documents to topics)
deno task db:migrate
```

#### Development Commands

```bash
# Type check all files
deno task check

# Format code
deno task fmt

# Run linter
deno task lint

# Run tests
deno task test
```

### Advanced Workflows

#### Complete Pipeline

```bash
deno task dev:full-pipeline
```

Runs: crawl → generate (with prompts for dates) → view

#### Crawl and Generate

```bash
deno task dev:crawl-and-generate
```

Runs crawling followed by document generation.

## Configuration

### Environment Variables

| Variable                  | Description                               | Default                 | Required |
| ------------------------- | ----------------------------------------- | ----------------------- | -------- |
| `AI_API_KEY`              | AI API key                                | -                       | Yes      |
| `AI_PROVIDER`             | AI provider (google/openai)               | `google`                | No       |
| `AI_MODEL`                | AI model to use                           | `gemini-2.5-flash-lite` | No       |
| `AI_BASE_URL`             | Custom API base URL (for compatible APIs) | -                       | No       |
| `AI_RATE_LIMIT_DELAY`     | Delay between AI requests (ms)            | `10000`                 | No       |
| `AI_MAX_RETRIES`          | Max retry attempts for AI calls           | `3`                     | No       |
| `DATABASE_PATH`           | SQLite database file path                 | `slack_messages.db`     | No       |
| `DATABASE_BACKUP_ENABLED` | Enable automatic backups                  | `false`                 | No       |
| `DOCUMENTS_PATH`          | Output directory for documents            | `db_docs`               | No       |
| `LOG_LEVEL`               | Logging level (debug/info/warn/error)     | `info`                  | No       |
| `LOG_CONSOLE`             | Enable console logging                    | `true`                  | No       |

### Logging Levels

- `debug`: Detailed debugging information
- `info`: General information about operations
- `warn`: Warning messages for potential issues
- `error`: Error messages for failures

## Error Handling

The application includes comprehensive error handling:

- **Retry Logic**: AI operations automatically retry on failure with exponential backoff
- **Input Validation**: All user inputs are validated with clear error messages
- **Structured Logging**: All operations are logged with appropriate context
- **Graceful Degradation**: System continues operating when non-critical components fail

## Testing

Run the test suite:

```bash
deno task test
```

The project includes:

- Unit tests for utilities and validation
- Integration tests for services
- Mock services for external dependencies

## Troubleshooting

### Common Issues

**"AI_API_KEY environment variable is required"**

- Get API key from your chosen AI provider (Google AI, OpenAI, etc.)
- Add to `.env` file
- Set `AI_PROVIDER` to match your provider

**"Invalid start date format"**

- Use YYYY-MM-DD format for dates
- Example: `2025-12-20`

**"Invalid user mention format"**

- Use supported formats: `@username`, `username`, `<@U123456>`, `U123456`

**AI generation failures**

- Check your AI API key and quota for your chosen provider
- Verify `AI_PROVIDER` setting matches your API key type
- For custom APIs, ensure `AI_BASE_URL` is correctly set
- The system will automatically retry failed requests
- Check logs for detailed error information

### Debug Mode

Set `LOG_LEVEL=debug` in your `.env` file for detailed logging.

### Database Issues

If database gets corrupted or you need to reset:

```bash
rm slack_messages.db
deno task crawl  # Re-crawl data
```

To clear just topics while keeping messages:

```bash
deno task db:clear-topics
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing architecture
4. Add tests for new functionality
5. Run `deno task check`, `deno task fmt`, and `deno task test`
6. Submit a pull request

## License

[MIT](./LICENSE)
