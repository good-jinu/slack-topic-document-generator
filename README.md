# Slack Enhance Work

A powerful tool to crawl Slack messages, analyze conversations, and automatically generate documentation using AI. This project helps teams capture knowledge from Slack discussions and transform them into organized, searchable documents.

## Features

- **Slack Message Crawling**: Extract messages from specified Slack channels
- **Mention Tracking**: Track user and group mentions across conversations
- **AI-Powered Analysis**: Use Google's Gemini AI to identify topics and generate documentation
- **Document Generation**: Automatically create markdown documents from conversation topics
- **Database Storage**: Store messages, users, and relationships in SQLite database
- **Flexible Viewing**: Browse stored data with built-in viewer tools

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
# Slack Configuration
SLACK_USER_TOKEN=xoxp-your-slack-user-token
SLACK_CHANNELS=C1234567890,C0987654321

# Google AI Configuration
GOOGLE_AI_API_KEY=your-google-ai-api-key
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
deno task crawl
```

This will:

- Connect to Slack using your token
- Fetch messages from specified channels
- Extract user mentions and group mentions
- Store everything in SQLite database (`slack_messages.db`)

#### Generate Documentation

```bash
deno task generate <start_date> <end_date>
```

Examples:

```bash
# Generate docs for last week
deno task generate 2025-12-17 2025-12-24

# Generate docs for specific day
deno task generate 2025-12-20 2025-12-20
```

This will:

- Analyze messages in the date range
- Use AI to identify discussion topics
- Generate markdown documents in `db_docs/` folder
- Link documents to original messages

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

#### Deploy to Slack (Optional)

```bash
deno task deploy
```

Deploys the project as a Slack app (requires additional Slack app configuration).

### Advanced Workflows

#### Complete Pipeline

Run the full workflow in sequence:

```bash
deno task dev:full-pipeline
```

This runs: crawl → generate (with prompts for dates) → view

#### Crawl and Generate

```bash
deno task dev:crawl-and-generate
```

Runs crawling followed by document generation.

### Development Commands

#### Code Quality

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

## Project Structure

```
src/
├── crawler/           # Slack message crawling
│   ├── index.ts       # Main crawler entry point
│   ├── messagesFetcher.ts
│   ├── userGroups.ts
│   ├── usersFetcher.ts
│   └── utils.ts
├── agent/             # AI document generation
│   ├── index.ts       # Main generator entry point
│   ├── aiGenerator.ts
│   ├── documentManager.ts
│   ├── markdownFormatter.ts
│   ├── messageParser.ts
│   └── messageRetriever.ts
├── utils/             # Shared utilities
│   ├── types.ts       # TypeScript interfaces
│   └── viewer.ts      # Database viewer
├── db.ts              # Database operations
└── deploy.ts          # Slack app deployment

db_docs/               # Generated documentation
slack_messages.db      # SQLite database
```

## Configuration Options

### Environment Variables

| Variable            | Description                 | Required             |
| ------------------- | --------------------------- | -------------------- |
| `SLACK_USER_TOKEN`  | Slack user OAuth token      | Yes                  |
| `SLACK_CHANNELS`    | Comma-separated channel IDs | Yes                  |
| `GOOGLE_AI_API_KEY` | Google AI API key           | Yes (for generation) |

### Customization

#### Modify AI Prompts

Edit prompts in `src/agent/aiGenerator.ts`:

- `generateTopics()` - How topics are identified
- `generateDocumentContent()` - How documents are structured

#### Change Database Schema

Modify `src/db.ts` to add fields or tables as needed.

#### Adjust Rate Limits

Update delays in crawler modules to respect Slack API limits.

## Troubleshooting

### Common Issues

**"Error: SLACK_USER_TOKEN environment variable is not set"**

- Ensure `.env` file exists and contains valid token
- Check token has required scopes

**"Error fetching channel history"**

- Verify channel IDs are correct
- Ensure bot has access to channels
- Check if channels are private (may need different scopes)

**"GOOGLE_AI_API_KEY environment variable is required"**

- Get API key from Google AI Studio
- Add to `.env` file

**"No messages found in specified channels"**

- Check date ranges
- Verify channels have messages in timeframe
- Ensure proper channel access

### Debug Mode

Add debug logging by modifying console.log statements in relevant modules.

### Database Issues

If database gets corrupted:

```bash
rm slack_messages.db
deno task crawl  # Re-crawl data
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing code style
4. Run `deno task check` and `deno task fmt`
5. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review Slack API documentation
3. Check Google AI API documentation
4. Open an issue in the repository
