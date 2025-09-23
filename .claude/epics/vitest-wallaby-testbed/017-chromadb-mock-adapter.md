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
updated: 2025-09-23T14:45:00Z
---

# Task 017: ChromaDB Mock Adapter

## Objective

Implement a comprehensive mock adapter for ChromaDB to enable fast,
deterministic testing of RAG (Retrieval-Augmented Generation) features without
external dependencies.

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
- **Trigger to revisit:** When query latency > 100ms in tests or need for real
  Chroma integration

## Requirements

### Functional Requirements

1. **ChromaDB Client Mock**
   - [ ] Create/get/list/delete collections
   - [ ] Server simulation methods (heartbeat, version, reset)
   - [ ] Metadata management
   - [ ] Error state handling

2. **Collection Operations**
   - [ ] Add documents with embeddings
   - [ ] Query with vector similarity search
   - [ ] Update existing documents
   - [ ] Delete documents by ID or filter
   - [ ] Upsert operations
   - [ ] Metadata filtering with where clauses

3. **Vector Operations**
   - [ ] Deterministic embedding generation (384 dimensions default)
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

## Implementation Plan

### Phase 1: Minimal Viable Mock (4 hours)

**Test-First Development:**

```typescript
describe('ChromaDB Mock Client', () => {
  it('creates and retrieves a collection', async () => {
    const client = createMockChromaClient()
    const collection = await client.createCollection({ name: 'test' })
    expect(collection.name).toBe('test')
  })

  it('adds and retrieves documents', async () => {
    const client = createMockChromaClient()
    const collection = await client.createCollection({ name: 'docs' })
    await collection.add({
      ids: ['1'],
      documents: ['Hello world'],
    })
    const result = await collection.get({ ids: ['1'] })
    expect(result.documents[0]).toBe('Hello world')
  })
})
```

**Implementation:**

- Basic ChromaClient with createCollection, getCollection
- Simple Collection with add, get methods
- InMemoryStore with Map-based storage

### Phase 2: Similarity Search (4 hours)

**Test-First:**

```typescript
it('returns documents by similarity', async () => {
  const client = createMockChromaClient()
  const collection = await client.createCollection({ name: 'docs' })

  await collection.add({
    ids: ['1', '2', '3'],
    documents: ['cat', 'dog', 'cat food'],
  })

  const results = await collection.query({
    queryTexts: ['cat'],
    nResults: 2,
  })

  expect(results.ids[0]).toContain('1') // 'cat' exact match
  expect(results.ids[0]).toContain('3') // 'cat food' partial match
})
```

**Implementation:**

- Deterministic embedding function
- Cosine similarity implementation
- Top-k retrieval algorithm

### Phase 3: Metadata & Filtering (4 hours)

**Test-First:**

```typescript
it('filters by metadata', async () => {
  const collection = await client.createCollection({ name: 'docs' })

  await collection.add({
    ids: ['1', '2'],
    documents: ['doc1', 'doc2'],
    metadatas: [{ type: 'article' }, { type: 'blog' }],
  })

  const results = await collection.query({
    queryTexts: ['content'],
    where: { type: { $eq: 'article' } },
    nResults: 10,
  })

  expect(results.ids).toEqual([['1']])
})
```

**Implementation:**

- Metadata storage in InMemoryStore
- Filter predicate evaluation ($eq, $ne, $in, $nin, $gt, $gte, $lt, $lte)
- Combined similarity + filter queries

### Phase 4: Polish & Documentation (4 hours)

- Debug logging with environment detection
- Performance benchmarks
- Comprehensive test suite
- README with usage examples
- TypeScript type exports

## Module Structure

```
packages/testkit/src/chromadb/
├── index.ts           # Public API exports
├── mock-client.ts     # ChromaClient + Collection in one file
├── storage.ts         # Simple in-memory engine
├── embeddings.ts      # Single mock embedder
└── __tests__/
    └── chromadb.test.ts  # Comprehensive test suite
```

## Key Implementation Details

### Deterministic Embedding Function

```typescript
export function mockEmbedding(text: string, dimensions = 384): number[] {
  const hash = simpleHash(text)
  return Array(dimensions)
    .fill(0)
    .map(
      (_, i) => Math.sin(hash * (i + 1)), // Deterministic but varied
    )
}
```

### Simple Storage Engine

```typescript
export class InMemoryVectorStore {
  private vectors = new Map<string, Float32Array>()
  private documents = new Map<string, string>()
  private metadata = new Map<string, Record<string, any>>()

  add(id: string, vector: Float32Array, document: string, metadata?: any) {
    this.vectors.set(id, vector)
    this.documents.set(id, document)
    if (metadata) this.metadata.set(id, metadata)
  }

  search(queryVector: Float32Array, k: number, filter?: any): string[] {
    // Cosine similarity + optional filter
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
   - Query latency with varying document counts
   - Memory usage patterns
   - Bulk operation throughput

## Success Criteria

- [ ] All ChromaDB API methods used in codebase are mocked
- [ ] Tests pass with both mock and real ChromaDB
- [ ] Sub-second test execution for typical usage
- [ ] Zero flakiness in CI
- [ ] Documentation includes migration guide from real to mock

## Dependencies

- Existing testkit patterns (Convex harness as reference)
- Environment detection utilities
- Seed and random utilities from testkit
- TypeScript 5.x for proper type inference

## Risks & Mitigations

| Risk                    | Impact | Mitigation                                       |
| ----------------------- | ------ | ------------------------------------------------ |
| API compatibility drift | Medium | Pin chromadb-js version, add compatibility tests |
| Performance regression  | Low    | Benchmark tests, optimize hot paths              |
| Missing edge cases      | Medium | Shadow testing against real ChromaDB             |

## Notes

- Start simple with YAGNI principle - no transactions, single embedding function
- Follow existing Convex harness patterns for consistency
- Use existing testkit utilities (env detection, seed, random)
- Consider future integration with Ollama for real embeddings (feature-flagged)

## References

- [ChromaDB JS Client Docs](https://docs.trychroma.com/reference/js-client)
- [Convex Test Harness](../../../packages/testkit/src/convex/harness.ts)
- [MSW Setup Pattern](../../../packages/testkit/src/msw/setup.ts)
