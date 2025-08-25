# @orchestr8/resilience

## 1.0.0

### Patch Changes

- Initial NPM publication setup for resilience package

- Updated dependencies []:
  - @orchestr8/logger@1.0.0
  - @orchestr8/schema@1.0.0

## 1.0.0-beta.2

### Major Changes

#### 🔒 Enhanced Security & Reliability

- **Memory Race Condition Fix**: Implemented deterministic LRU eviction to prevent race conditions in circuit breaker state management
- **Configuration Validation**: Added comprehensive Zod-based validation for `CircuitBreakerConfig` with minimum sampleSize enforcement (>=10)

#### ⚡ Performance Improvements

- **Async Cleanup Optimization**: Converted blocking cleanup operations to non-blocking async operations with chunked processing
- **Event Loop Protection**: Added setImmediate-based chunking to prevent event loop blocking during cleanup

#### 🎯 Enhanced Error Types

- **CircuitBreakerTimeoutError**: New error type for timeout scenarios during half-open probes
- **CircuitBreakerConfigurationError**: Detailed validation errors with field-specific information
- **CircuitBreakerThresholdError**: Enhanced error with failure rate and threshold context
- **Backward Compatibility**: All new error types maintain compatibility with existing `CircuitBreakerOpenError` handling

#### 📊 Advanced Observability

- **Structured Logging**: Comprehensive state transition logging with structured metadata
- **Performance Metrics**: Built-in tracking of operation duration, success rates, and failure counts
- **Telemetry Integration**: Optional telemetry hooks for external monitoring systems
- **Minimal Overhead**: Optimized for production use with negligible performance impact

#### 🛠️ Configuration Enhancements

- **Runtime Validation**: All configuration parameters validated at construction time
- **Enhanced Error Messages**: Clear, actionable validation error messages
- **Schema Export**: Zod schemas available for external validation

#### 📈 Breaking Changes

- **Minimum Sample Size**: CircuitBreaker now requires `sampleSize >= 10` for statistical reliability
- **Constructor Signature**: Added optional `telemetry` parameter for observability integration

### Dependencies

- Added `zod` ^3.25.76 for configuration validation

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @orchestr8/schema@0.1.1
