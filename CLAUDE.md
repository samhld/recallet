# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with hot reloading (uses tsx watch)
- `npm run build` - Build production version (TypeScript compilation + Vite build)
- `npm run check` - Run TypeScript type checking
- `npm start` - Start production server
- `npm run db:generate` - Generate database migrations with Drizzle Kit
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes to database

## Project Architecture

**Recallet** is a personal knowledge management system that allows users to store inputs, extract entities and relationships, and perform intelligent search using OpenAI embeddings.

### Tech Stack
- **Frontend**: React with Vite, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: MySQL/TiDB with Drizzle ORM
- **AI**: OpenAI API for entity extraction and embeddings
- **Authentication**: Express sessions with bcrypt

### Key Architecture Patterns

**Full-Stack TypeScript**: Shared schema definitions in `shared/schema.ts` ensure type safety across client and server.

**Database Schema**: Core entities include:
- `users` - User accounts with bcrypt password hashing
- `inputs` - User-submitted content with category/tags
- `entities` - Extracted entities with vector embeddings for search
- `relationships` - Connections between entities
- `queries` - Search query history with result metadata

**AI Integration**: The system uses OpenAI's API to:
- Parse user inputs into entity-relationship triples (`parseInputToEntityRelationships`)
- Generate embeddings for semantic search (`createEmbedding`)
- Synthesize answers from search context (`synthesizeAnswerFromContext`)

### Project Structure

```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── pages/          # Route components
│   │   ├── hooks/          # React hooks (auth, etc.)
│   │   └── lib/            # Utilities, query client
├── server/          # Express backend
│   ├── index.ts     # Server entry point
│   ├── routes.ts    # API routes and auth
│   ├── db.ts        # Database connection
│   ├── llm.ts       # OpenAI integration
│   └── storage.ts   # Database operations
├── shared/          # Shared TypeScript definitions
│   └── schema.ts    # Drizzle schema and types
└── drizzle/         # Database migrations
```

### Development Environment

- Database requires `DATABASE_URL` environment variable
- OpenAI API key required in `OpenAI_Sam_D` or `OPENAI_API_KEY`
- Server runs on port 5001 by default
- Frontend served via Vite dev server in development
- Uses MySQL2 connection pooling with SSL support for cloud databases

### Key Features

1. **Entity Extraction**: Converts user inputs into structured entity-relationship triples
2. **Semantic Search**: Vector similarity search using OpenAI embeddings
3. **Smart Search**: Natural language querying with context synthesis
4. **Query History**: Tracks user searches and results
5. **Authentication**: Session-based auth with secure password hashing

### Database Migration Note

The project is currently migrating from PostgreSQL to TiDB (MySQL-compatible), as evidenced by the current branch name and MySQL schema definitions.