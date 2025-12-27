# Slack Enhance Work Server

A Deno HTTP server that provides API access to the Slack message database and document management system.

## Quick Start

```bash
# Run the server
deno run --allow-net --allow-read src/server/serve.ts

# Or use the shortcut
deno task serve
```

The server will start on `http://localhost:8000` by default.

## Environment Variables

- `PORT` - Server port (default: 8000)
- `HOST` - Server hostname (default: localhost)

## API Endpoints

### Documents

- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get specific document with content
- `GET /api/documents/:id/messages` - Get messages related to a document
- `GET /api/documents/search?q=query` - Search documents by title or description

### Health Check

- `GET /health` - Server health status

## Response Format

All API responses follow this format:

```json
{
  "documents": [...],
  "count": 10,
  "error": "Error message if any"
}
```

## Examples

### Get all documents

```bash
curl http://localhost:8000/api/documents
```

### Get specific document

```bash
curl http://localhost:8000/api/documents/1
```

### Search documents

```bash
curl "http://localhost:8000/api/documents/search?q=migration"
```

## CORS Support

The server includes CORS headers to allow cross-origin requests from web applications.
