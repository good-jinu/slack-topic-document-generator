import { getMessages, getMessageTopicRelations, getTopicById, getTopics, initDatabase } from "@/db/index.ts";
import { DB } from "sqlite";

// Initialize database
const db: DB = initDatabase();

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Main server handler
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    try {
      // Route handling
      if (pathname === "/api/documents" && request.method === "GET") {
        return handleGetDocuments();
      }

      // Search documents endpoint (must come before the :id route)
      if (pathname === "/api/documents/search" && request.method === "GET") {
        const query = url.searchParams.get("q") || "";
        return handleSearchDocuments(query);
      }

      // Get messages related to a document
      if (pathname.startsWith("/api/documents/") && pathname.endsWith("/messages") && request.method === "GET") {
        const id = pathname.split("/")[3];
        return handleGetDocumentMessages(id);
      }

      if (pathname.startsWith("/api/documents/") && request.method === "GET") {
        const id = pathname.split("/")[3];
        return handleGetDocument(id);
      }

      // Health check endpoint
      if (pathname === "/health" && request.method === "GET") {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Default 404 response
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Server error:", error);
      return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
} satisfies Deno.ServeDefaultExport;

/**
 * Handle GET /api/documents - Returns list of all documents
 */
function handleGetDocuments(): Response {
  try {
    const topics = getTopics(db);

    const documents = topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      fileName: topic.file_name,
      startDate: topic.start_date,
      endDate: topic.end_date,
      createdAt: topic.created_at,
      updatedAt: topic.updated_at,
    }));

    return new Response(JSON.stringify({ documents }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch documents" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle GET /api/documents/:id - Returns specific document content
 */
function handleGetDocument(id: string): Response {
  try {
    const topicId = parseInt(id);
    if (isNaN(topicId)) {
      return new Response(
        JSON.stringify({ error: "Invalid document ID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const topic = getTopicById(db, topicId);
    if (!topic) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Read the actual file content if file_name exists
    let content = "";
    if (topic.file_name) {
      try {
        content = Deno.readTextFileSync(`db_docs/${topic.file_name}`);
      } catch (error) {
        console.warn(`Could not read file: ${topic.file_name}`, error);
        content = topic.description || "";
      }
    } else {
      content = topic.description || "";
    }

    const document = {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      fileName: topic.file_name,
      content,
      startDate: topic.start_date,
      endDate: topic.end_date,
      createdAt: topic.created_at,
      updatedAt: topic.updated_at,
    };

    return new Response(JSON.stringify({ document }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch document" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle GET /api/documents/:id/messages - Returns messages related to a document
 */
function handleGetDocumentMessages(id: string): Response {
  try {
    const topicId = parseInt(id);
    if (isNaN(topicId)) {
      return new Response(
        JSON.stringify({ error: "Invalid document ID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const relations = getMessageTopicRelations(db, undefined, topicId);
    const messageIds = relations.map((r) => r.message_id);

    // Get the actual messages (this would need a more specific query in a real implementation)
    const messages = getMessages(db, 100).filter((msg) => messageIds.includes(parseInt(msg.ts)) // This is a simplified approach
    );

    return new Response(JSON.stringify({ messages, count: messages.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching document messages:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch document messages" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle GET /api/documents/search?q=query - Search documents by title or content
 */
function handleSearchDocuments(query: string): Response {
  try {
    if (!query.trim()) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const allTopics = getTopics(db);
    const searchTerm = query.toLowerCase();

    const filteredDocuments = allTopics
      .filter((topic) =>
        topic.title.toLowerCase().includes(searchTerm) ||
        (topic.description && topic.description.toLowerCase().includes(searchTerm))
      )
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        fileName: topic.file_name,
        startDate: topic.start_date,
        endDate: topic.end_date,
        createdAt: topic.created_at,
        updatedAt: topic.updated_at,
      }));

    return new Response(
      JSON.stringify({
        documents: filteredDocuments,
        count: filteredDocuments.length,
        query,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error searching documents:", error);
    return new Response(
      JSON.stringify({ error: "Failed to search documents" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
