# Slack Topic Generator

A powerful tool to crawl Slack messages, analyze conversations, and automatically generate documentation using AI. This project helps teams capture knowledge from Slack discussions and transform them into organized, searchable documents.

## Features

- **Slack Message Crawling**: Extract messages from specified Slack channels with date filtering
- **User Mention Filtering**: Generate documents for specific user mentions
- **AI-Powered Analysis**: Use Google's Gemini AI to identify topics and generate documentation
- **Document Management**: Automatically create and update markdown documents from conversation topics
- **Robust Architecture**: Built with TypeScript, comprehensive error handling, and retry logic
- **Configurable Logging**: Structured logging with multiple levels
- **Database Storage**: Store messages, users, and relationships in SQLite database with backup support

## Architecture

This project follows a modern, modular architecture with clear separation of concerns:

- **Configuration Layer**: Centralized configuration management
- **Service Layer**: Business logic and external integrations (AI, Documents, Database)
- **Utility Layer**: Shared utilities (logging, retry, validation)
- **Agent Layer**: Core processing logic
- **Data Layer**: Database operations and queries

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

- [Deno](https://deno.land/) runtime installed
- Slack workspace with appropriate permissions
- Google AI API key for document generation

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd slack-enhance-work
```

### 2. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
GOOGLE_AI_API_KEY=your-google-ai-api-key

# Slack Configuration
SLACK_CONFIG_TOKEN="xoxp-your-token-here"
SLACK_USER_TOKEN=xoxp-your-token-here
SLACK_CHANNELS=C1234567890,C0987654321,C1111111111

# Optional - AI Configuration
AI_MODEL=gemini-2.5-flash-lite
AI_RATE_LIMIT_DELAY=10000
AI_MAX_RETRIES=3

# Optional - Database Configuration
DATABASE_PATH=slack_messages.db
DATABASE_BACKUP_ENABLED=false

# Optional - Output Configuration
DOCUMENTS_PATH=db_docs
OUTPUT_FORMAT=markdown

# Optional - Logging Configuration
LOG_LEVEL=info
LOG_CONSOLE=true
```

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

### 4. Get Google AI API Key

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Add it to your `.env` file

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
deno task generate <start-date> <end-date> [user-mention]
```

Examples:

```bash
# Generate docs for date range
deno task generate 2025-12-20 2025-12-24

# Generate docs for specific user mentions
deno task generate 2025-12-20 2025-12-24 @john.doe
deno task generate 2025-12-20 2025-12-24 <@U123456789>

# Generate docs for specific day
deno task generate 2025-12-20 2025-12-20
```

**User mention formats supported:**

- `@username` - Username with @ prefix
- `username` - Username without @ prefix
- `<@U123456>` - Slack user ID format
- `U123456` - Raw Slack user ID

This will:

- Analyze messages in the date range (optionally filtered by user mentions)
- Use AI to identify discussion topics with retry logic
- Generate or update markdown documents in configured output directory
- Link documents to original messages in database

#### View Stored Data

```bash
deno task view
```

Shows a summary of:

- Recent messages
- Users in database
- Mentions tracked
- Generated documents
- Message-document relationships

#### Database Management

```bash
# Clear all documents and relations
deno task db:clear-documents
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

## Project Structure

```
src/
├── config/            # Configuration management
│   └── index.ts       # App configuration and validation
├── services/          # Business logic services
│   ├── aiService.ts   # Google AI integration with retry
│   ├── documentService.ts  # Document creation and management
│   └── databaseService.ts  # Enhanced database operations
├── utils/             # Shared utilities
│   ├── logger.ts      # Structured logging
│   ├── retry.ts       # Retry mechanisms
│   ├── validation.ts  # Input validation
│   └── types.ts       # TypeScript interfaces
├── agent/             # Document generation logic
│   ├── index.ts       # Main generator entry point
│   ├── messageRetriever.ts  # Message filtering and retrieval
│   ├── messageParser.ts     # Slack message parsing
│   └── markdownFormatter.ts # Message formatting
├── crawler/           # Slack message crawling
│   ├── index.ts       # Main crawler entry point
│   ├── messagesFetcher.ts
│   ├── userGroups.ts
│   ├── usersFetcher.ts
│   └── utils.ts
├── db/                # Database operations
│   ├── index.ts       # Database initialization and CRUD
│   ├── messageQueries.ts  # Specialized message queries
│   └── clear-documents.ts # Database cleanup
└── deploy.ts          # Slack app deployment

docs/                  # Documentation
├── ARCHITECTURE.md    # Detailed architecture documentation

db_docs/              # Generated documentation (configurable)
slack_messages.db     # SQLite database (configurable)
```

## Configuration

### Environment Variables

| Variable                  | Description                           | Default                 | Required |
| ------------------------- | ------------------------------------- | ----------------------- | -------- |
| `GOOGLE_AI_API_KEY`       | Google AI API key                     | -                       | Yes      |
| `AI_MODEL`                | AI model to use                       | `gemini-2.5-flash-lite` | No       |
| `AI_RATE_LIMIT_DELAY`     | Delay between AI requests (ms)        | `10000`                 | No       |
| `AI_MAX_RETRIES`          | Max retry attempts for AI calls       | `3`                     | No       |
| `DATABASE_PATH`           | SQLite database file path             | `slack_messages.db`     | No       |
| `DATABASE_BACKUP_ENABLED` | Enable automatic backups              | `false`                 | No       |
| `DOCUMENTS_PATH`          | Output directory for documents        | `db_docs`               | No       |
| `OUTPUT_FORMAT`           | Document format (markdown/html)       | `markdown`              | No       |
| `LOG_LEVEL`               | Logging level (debug/info/warn/error) | `info`                  | No       |
| `LOG_CONSOLE`             | Enable console logging                | `true`                  | No       |

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

**"GOOGLE_AI_API_KEY environment variable is required"**

- Get API key from Google AI Studio
- Add to `.env` file

**"Invalid start date format"**

- Use YYYY-MM-DD format for dates
- Example: `2025-12-20`

**"Invalid user mention format"**

- Use supported formats: `@username`, `username`, `<@U123456>`, `U123456`

**AI generation failures**

- Check your Google AI API key and quota
- The system will automatically retry failed requests
- Check logs for detailed error information

### Debug Mode

Set `LOG_LEVEL=debug` in your `.env` file for detailed logging.

### Database Issues

If database gets corrupted:

```bash
rm slack_messages.db
deno task crawl  # Re-crawl data
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing architecture
4. Add tests for new functionality
5. Run `deno task check`, `deno task fmt`, and `deno task test`
6. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details
3. Check logs with `LOG_LEVEL=debug`
4. Open an issue in the repository
