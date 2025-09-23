---
task_number: 017
name: chromadb-mock-adapter
status: not-started
priority: P1
complexity: L
estimated_hours: 16
actual_hours: 0
assigned_to: unassigned
dependencies: []
created: 2025-09-23T14:45:00Z
updated: 2025-09-23T15:00:00Z
---

# Task 017: ChromaDB Mock Adapter

> "Our mock ChromaDB stores vectors faster than an ADHD brain switches contexts - which is saying something since both use hash maps!" 🧠

## Objective

Implement a comprehensive mock adapter for ChromaDB to enable fast, deterministic testing of RAG (Retrieval-Augmented Generation) features without external dependencies.

## TDD Applicability Decision

- **Risk class:** High (AI adapter boundary, data retrieval contracts)
- **Decision:** TDD Required
- **Why:** Core AI adapter requiring deterministic mocks per testing guide
- **Scope under TDD:**
  - Unit: Vector similarity calculations, metadata filtering, storage engine
  - Integration: Collection CRUD with harness context
  - Contract: ChromaDB API compatibility layer
- **Out-of-scope (YAGNI):**
  - Real Ollama integration (feature-flagged)
  - Advanced indexing algorithms (basic cosine similarity sufficient)
  - Distributed storage patterns
  - Transaction support
  - Multiple embedding providers
- **Trigger to revisit:** When query latency > 100ms in tests or need for real Chroma integration

## Requirements

### Functional Requirements

1. **ChromaDB Client Mock**
   - [ ] Create/get/list/delete collections
   - [ ] Server simulation methods (heartbeat, version, reset)
   - [ ] Metadata management
   - [ ] Error state handling (duplicate collections, not found)

2. **Collection Operations**
   - [ ] Add documents with embeddings
   - [ ] Query with vector similarity search
   - [ ] Update existing documents
   - [ ] Delete documents by ID or filter
   - [ ] Upsert operations
   - [ ] Metadata filtering with where clauses

3. **Vector Operations**
   - [ ] Deterministic embedding generation (configurable dimensions)
   - [ ] Cosine similarity calculation
   - [ ] Top-k retrieval
   - [ ] Distance metrics support

4. **Storage Engine**
   - [ ] In-memory vector storage with Map
   - [ ] Document storage
   - [ ] Metadata indexing
   - [ ] Efficient similarity search

### Non-Functional Requirements

- All tests complete in < 500ms total
- Zero external dependencies
- 100% API compatibility with chromadb-js v1.5.x subset used
- Single environment flag swap between mock/real (`CHROMA_USE_MOCK`)
- Deterministic results with seeded random
- Memory efficient for up to 10,000 documents
- Individual query operations < 100ms for 1000 documents

## Implementation Plan

### Phase 1: Minimal Viable Mock (4 hours)

**Test-First Development:**
```typescript
describe('ChromaDB Mock Client', () => {
  it('creates and retrieves a collection', async () => {
    const client = createMockChromaClient();
    const collection = await client.createCollection({ name: 'test' });
    expect(collection.name).toBe('test');
  });

  it('adds and retrieves documents', async () => {
    const client = createMockChromaClient();
    const collection = await client.createCollection({ name: 'docs' });
    await collection.add({
      ids: ['1'],
      documents: ['Hello world']
    });
    const result = await collection.get({ ids: ['1'] });
    expect(result.documents[0]).toBe('Hello world');
  });

  // Error cases
  it('throws on duplicate collection names', async () => {
    const client = createMockChromaClient();
    await client.createCollection({ name: 'test' });
    await expect(
      client.createCollection({ name: 'test' })
    ).rejects.toThrow('Collection already exists');
  });

  it('throws when collection not found', async () => {
    const client = createMockChromaClient();
    await expect(
      client.getCollection({ name: 'nonexistent' })
    ).rejects.toThrow('Collection not found');
  });
});
```

**Implementation:**
- Basic ChromaClient with createCollection, getCollection
- Simple Collection with add, get methods
- InMemoryStore with Map-based storage
- Error handling for duplicate/missing collections

### Phase 2: Similarity Search (4 hours)

**Test-First:**
```typescript
it('returns documents by similarity', async () => {
  const client = createMockChromaClient();
  const collection = await client.createCollection({ name: 'docs' });

  await collection.add({
    ids: ['1', '2', '3'],
    documents: ['cat', 'dog', 'cat food']
  });

  const results = await collection.query({
    queryTexts: ['cat'],
    nResults: 2
  });

  expect(results.ids[0]).toContain('1'); // 'cat' exact match
  expect(results.ids[0]).toContain('3'); // 'cat food' partial match
});
```

**Implementation:**
- Deterministic embedding function
- Cosine similarity implementation
- Top-k retrieval algorithm

### Phase 3: Metadata & Filtering (4 hours)

**Test-First:**
```typescript
it('filters by metadata', async () => {
  const collection = await client.createCollection({ name: 'docs' });

  await collection.add({
    ids: ['1', '2'],
    documents: ['doc1', 'doc2'],
    metadatas: [{ type: 'article' }, { type: 'blog' }]
  });

  const results = await collection.query({
    queryTexts: ['content'],
    where: { type: { $eq: 'article' } },
    nResults: 10
  });

  expect(results.ids).toEqual([['1']]);
});
```

**Implementation:**
- Metadata storage in InMemoryStore
- Filter predicate evaluation ($eq, $ne, $in, $nin, $gt, $gte, $lt, $lte)
- Combined similarity + filter queries

### Phase 4: Polish & Documentation (4 hours)

**Performance Tests:**
```typescript
it('queries 1000 documents in under 100ms', async () => {
  const client = createMockChromaClient({
    embeddingDimension: EMBEDDING_CONFIGS.mini // Use 128 dims for speed
  });
  const collection = await client.createCollection({ name: 'perf' });

  // Add 1000 documents
  const ids = Array.from({ length: 1000 }, (_, i) => `doc${i}`);
  const documents = ids.map(id => `Document content for ${id}`);
  await collection.add({ ids, documents });

  // Measure query time
  const start = performance.now();
  const results = await collection.query({
    queryTexts: ['test query'],
    nResults: 10
  });
  const elapsed = performance.now() - start;

  expect(elapsed).toBeLessThan(100);
  expect(results.ids[0]).toHaveLength(10);
});
```

**Additional Work:**
- Debug logging with environment detection
- Performance benchmarks
- README with usage examples
- TypeScript type exports

## Module Structure

```
packages/testkit/src/chromadb/
├── index.ts           # Public API exports & feature flag integration
├── mock-client.ts     # ChromaClient + Collection in one file
├── storage.ts         # Simple in-memory engine
├── embeddings.ts      # Single mock embedder
└── __tests__/
    └── chromadb.test.ts  # Comprehensive test suite
```

## Key Implementation Details

### Feature Flag Integration
```typescript
// packages/testkit/src/chromadb/index.ts
export function createChromaClient(config?: ChromaConfig) {
  // Explicit env var takes precedence
  if (process.env.CHROMA_USE_MOCK === 'true') return createMockChromaClient(config);
  if (process.env.CHROMA_USE_MOCK === 'false') {
    // Real ChromaDB client (when implemented)
    const { ChromaClient } = await import('chromadb');
    return new ChromaClient(config);
  }

  // Default to mock in test environment
  if (process.env.NODE_ENV === 'test') return createMockChromaClient(config);

  // Production defaults to real
  const { ChromaClient } = await import('chromadb');
  return new ChromaClient(config);
}
```

### Embedding Dimension Strategy
```typescript
// Support multiple embedding dimensions for different models
export const EMBEDDING_CONFIGS = {
  default: 384,    // Ollama llama2
  openai: 1536,    // text-embedding-ada-002
  mini: 128        // For fast tests
} as const;

// Allow override in tests
const client = createMockChromaClient({
  embeddingDimension: EMBEDDING_CONFIGS.mini
});
```

### Deterministic Embedding Function
```typescript
export function mockEmbedding(text: string, dimensions = 384): number[] {
  const hash = simpleHash(text);
  return Array(dimensions).fill(0).map((_, i) =>
    Math.sin(hash * (i + 1)) // Deterministic but varied
  );
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}
```

### Cosine Similarity Implementation
```typescript
// storage.ts
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Simple Storage Engine
```typescript
export class InMemoryVectorStore {
  private vectors = new Map<string, Float32Array>();
  private documents = new Map<string, string>();
  private metadata = new Map<string, Record<string, any>>();

  add(id: string, vector: Float32Array, document: string, metadata?: any) {
    this.vectors.set(id, vector);
    this.documents.set(id, document);
    if (metadata) this.metadata.set(id, metadata);
  }

  search(queryVector: Float32Array, k: number, filter?: any): string[] {
    const scores: Array<[string, number]> = [];

    for (const [id, vector] of this.vectors) {
      // Apply metadata filter if provided
      if (filter && !this.matchesFilter(id, filter)) {
        continue;
      }

      const similarity = cosineSimilarity(queryVector, vector);
      scores.push([id, similarity]);
    }

    // Sort by similarity (descending) and take top k
    scores.sort((a, b) => b[1] - a[1]);
    return scores.slice(0, k).map(([id]) => id);
  }

  private matchesFilter(id: string, filter: any): boolean {
    const meta = this.metadata.get(id);
    if (!meta) return false;

    // Simple filter evaluation (expand as needed)
    for (const [key, condition] of Object.entries(filter)) {
      if (typeof condition === 'object' && condition !== null) {
        const [op, value] = Object.entries(condition)[0];
        if (!this.evaluateCondition(meta[key], op, value)) {
          return false;
        }
      } else if (meta[key] !== condition) {
        return false;
      }
    }
    return true;
  }
}
```

## Testing Strategy

1. **Unit Tests**
   - Embedding generation determinism
   - Cosine similarity accuracy
   - Filter predicate evaluation
   - Storage operations

2. **Integration Tests**
   - Collection lifecycle
   - Query pipeline
   - Error handling
   - API compatibility

3. **Performance Tests**
   - Query latency with varying document counts (100, 1000, 10000)
   - Memory usage patterns
   - Bulk operation throughput

## Success Criteria

- [ ] All ChromaDB API methods used in codebase are mocked
- [ ] Tests pass with both mock and real ChromaDB
- [ ] Performance targets met:
  - Collection creation: < 1ms
  - Document add (batch of 100): < 10ms
  - Query (1000 docs): < 100ms
  - Full test suite: < 500ms total
- [ ] Zero flakiness in CI
- [ ] Documentation includes migration guide from real to mock
- [ ] Query performance < 100ms for 1000 documents

## Dependencies

- Existing testkit patterns (Convex harness as reference)
- Environment detection utilities
- Seed and random utilities from testkit
- TypeScript 5.x for proper type inference

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API compatibility drift | Medium | Pin chromadb-js version, add compatibility tests |
| Performance regression | Low | Benchmark tests, optimize hot paths |
| Missing edge cases | Medium | Shadow testing against real ChromaDB |
| Deterministic embeddings too simplistic | Medium | Add "quality mode" with more realistic vector distributions for integration tests |
| Embedding dimension mismatch | High | Validate dimensions match across mock/real, add dimension config |

## Answers to Clarifying Questions

1. **Collection Limits**: Ignore ChromaDB's limits in mock for test flexibility
2. **Embedding Caching**: Always regenerate for test isolation (no caching) - deterministic but not memoized
3. **Query Response Format**: Full format with distances for compatibility
4. **Persistence Between Tests**: Always fresh instances, each client has isolated state
5. **Compatibility Verification**: Building mock-first, will add compatibility tests later
6. **Test Helpers**: Factory functions preferred (`createTestCollection()`, `createTestDocuments()`)
7. **Dimension Configuration**: Global per client - all collections in a client share dimensions

## Notes

- Start simple with YAGNI principle - no transactions, single embedding function
- Follow existing Convex harness patterns for consistency
- Use existing testkit utilities (env detection, seed, random)
- Consider future integration with Ollama for real embeddings (feature-flagged)
- Performance targets based on typical test scenarios, not production load

## References

- [ChromaDB JS Client Docs](https://docs.trychroma.com/reference/js-client)
- [Convex Test Harness](../../../packages/testkit/src/convex/harness.ts)
- [MSW Setup Pattern](../../../packages/testkit/src/msw/setup.ts)