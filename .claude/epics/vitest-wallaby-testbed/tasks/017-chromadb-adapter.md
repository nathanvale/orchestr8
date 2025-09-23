---
task: 017
name: ChromaDB mock adapter
status: open
priority: low
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 017: ChromaDB mock adapter

## Status: ❌ NOT STARTED

## Planned Implementation

Implement ChromaDB mock adapter for vector similarity testing.

### Planned Components

- In-memory vector storage
- Deterministic embeddings
- Cosine similarity search
- Metadata filtering
- Collection management

### Requirements

- Full API compatibility with chromadb-js v1.5.x
- Deterministic embedding generation
- Configurable similarity thresholds
- Support for common distance metrics
- Metadata filtering and queries

### Proposed Architecture

```typescript
// src/mocks/chromadb/
├── adapter.ts       # Main ChromaDB adapter
├── embeddings.ts    # Deterministic embeddings
├── similarity.ts    # Similarity calculations
├── collection.ts    # Collection management
└── index.ts        # Public API
```

### API Surface

```typescript
- createChromaDBMock()
- mockEmbeddings()
- Collection operations
- Query and filter utilities
- Reset and cleanup
```

### Implementation Tasks

1. Study ChromaDB JS client API
2. Implement in-memory vector store
3. Create deterministic embeddings
4. Add similarity search algorithms
5. Implement metadata filtering
6. Write comprehensive tests
7. Add documentation

## Dependencies

- chromadb-js (for API reference)
- No runtime dependencies (pure mock)

## Priority

Low - Not blocking other work
