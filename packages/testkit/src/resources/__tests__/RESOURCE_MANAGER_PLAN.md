# Resource Manager Implementation Plan

## Overview
Comprehensive resource cleanup manager to prevent memory leaks and resource exhaustion in @orchestr8/testkit.

## Implementation Tasks

### Phase 1: Core Infrastructure
- [x] Create directory structure
- [ ] Create type definitions (types.ts)
- [ ] Implement ResourceManager class (manager.ts)
- [ ] Create export barrel (index.ts)

### Phase 2: ResourceManager Core Features
- [ ] Resource registration and tracking
- [ ] Async/sync cleanup function support
- [ ] Resource categorization (db, files, processes, timers)
- [ ] Cleanup ordering by priority/category
- [ ] Error handling during cleanup (graceful degradation)
- [ ] Resource leak detection and warnings

### Phase 3: Advanced Features
- [ ] Process exit hooks (SIGINT, SIGTERM, uncaughtException)
- [ ] Manual cleanup triggers
- [ ] Resource usage tracking and metrics
- [ ] Cleanup timeout handling
- [ ] Resource dependency management
- [ ] Batch cleanup operations

### Phase 4: Integration Features
- [ ] Vitest setup/teardown integration
- [ ] Global process cleanup registration
- [ ] Memory usage monitoring
- [ ] Performance metrics collection

## Test Requirements

### Unit Tests (manager.test.ts)
- [ ] Resource registration
  - [ ] Register sync cleanup function
  - [ ] Register async cleanup function
  - [ ] Register with category and priority
  - [ ] Register with custom metadata
  - [ ] Prevent duplicate registration
  - [ ] Handle invalid inputs

- [ ] Resource cleanup execution
  - [ ] Execute single resource cleanup
  - [ ] Execute all resources cleanup
  - [ ] Execute by category
  - [ ] Execute by priority order
  - [ ] Handle cleanup errors gracefully
  - [ ] Timeout handling for slow cleanup

- [ ] Error handling
  - [ ] Continue cleanup on individual failures
  - [ ] Collect and report all errors
  - [ ] Handle timeout scenarios
  - [ ] Handle invalid cleanup functions

- [ ] Process exit handling
  - [ ] Register process exit handlers
  - [ ] Cleanup on SIGINT
  - [ ] Cleanup on SIGTERM
  - [ ] Cleanup on uncaughtException
  - [ ] Prevent multiple cleanup runs

- [ ] Resource tracking and monitoring
  - [ ] Track resource count by category
  - [ ] Detect potential leaks (unused resources)
  - [ ] Report resource usage statistics
  - [ ] Monitor cleanup performance

- [ ] Dependency management
  - [ ] Register resource dependencies
  - [ ] Cleanup in dependency order
  - [ ] Handle circular dependencies
  - [ ] Validate dependency chains

## Resource Categories

### Database Resources
- Connection pools
- Open transactions
- Prepared statements
- Database locks

### File System Resources
- File descriptors
- Temporary files and directories
- File watchers
- Stream handles

### Process Resources
- Child processes
- Worker threads
- Process monitors
- Signal handlers

### Network Resources
- TCP/UDP sockets
- HTTP servers/clients
- WebSocket connections
- Network timeouts

### Timer Resources
- setTimeout handles
- setInterval handles
- Immediate timers
- Animation frames

### Event Resources
- Event listeners
- Observable subscriptions
- Stream subscriptions
- Custom event emitters

## Implementation Details

### ResourceManager Class Structure
```typescript
class ResourceManager {
  // Core functionality
  register(id: string, cleanup: CleanupFunction, options?: ResourceOptions): void
  unregister(id: string): boolean
  cleanup(options?: CleanupOptions): Promise<CleanupResult>
  
  // Category management
  cleanupByCategory(category: ResourceCategory): Promise<CleanupResult>
  
  // Monitoring
  getResourceCount(): number
  getResourcesByCategory(): Record<ResourceCategory, number>
  detectLeaks(): ResourceLeak[]
  
  // Process integration
  registerProcessHandlers(): void
  unregisterProcessHandlers(): void
  
  // Batch operations
  registerBatch(resources: ResourceDefinition[]): void
  cleanupBatch(ids: string[]): Promise<CleanupResult>
}
```

### Type Definitions
```typescript
// Resource categories for organization
enum ResourceCategory {
  DATABASE = 'database',
  FILE = 'file',
  PROCESS = 'process',
  TIMER = 'timer',
  NETWORK = 'network',
  EVENT = 'event',
  CRITICAL = 'critical'
}

// Priority levels for cleanup ordering
enum ResourcePriority {
  CRITICAL = 0,    // Database connections, file locks
  HIGH = 1,        // Open files, network connections
  MEDIUM = 2,      // Timers, event listeners
  LOW = 3          // Temporary files, caches
}

// Cleanup function types
type SyncCleanupFunction = () => void
type AsyncCleanupFunction = () => Promise<void>
type CleanupFunction = SyncCleanupFunction | AsyncCleanupFunction

// Resource definition
interface ResourceDefinition {
  id: string
  cleanup: CleanupFunction
  category: ResourceCategory
  priority: ResourcePriority
  description?: string
  tags?: string[]
  timeout?: number
  dependencies?: string[]
}

// Cleanup results and errors
interface CleanupResult {
  success: boolean
  resourcesProcessed: number
  errors: CleanupError[]
  duration: number
  summary: Record<ResourceCategory, { success: number; failed: number }>
}

interface CleanupError {
  resourceId: string
  category: ResourceCategory
  error: Error
  timeout: boolean
}
```

## Success Criteria
- [ ] 100% test coverage
- [ ] All resource categories supported
- [ ] Graceful error handling
- [ ] Process exit integration working
- [ ] Memory leak detection functional
- [ ] Performance benchmarks met (<10ms for 100 resources)
- [ ] Integration with existing testkit patterns
- [ ] Zero breaking changes to existing code

## Edge Cases to Handle
- [ ] Cleanup functions that throw synchronously
- [ ] Cleanup functions that never resolve
- [ ] Multiple cleanup attempts on same resource
- [ ] Process exit during active cleanup
- [ ] Resource registration during cleanup
- [ ] Circular dependencies in resource cleanup
- [ ] Memory exhaustion during cleanup
- [ ] Cleanup of already cleaned resources

## Performance Requirements
- [ ] Register 1000 resources in <50ms
- [ ] Cleanup 100 resources in <100ms
- [ ] Memory overhead <1MB for 1000 resources
- [ ] Zero memory leaks in the manager itself
- [ ] Efficient category-based filtering
- [ ] Minimal impact on application performance