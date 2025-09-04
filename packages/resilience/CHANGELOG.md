# @orchestr8/resilience

## 1.0.3

### Patch Changes

- Updated dependencies [[`30e0c59`](https://github.com/nathanvale/orchestr8/commit/30e0c598c56b1d2ec1ea83558e2a34bde79d90ea)]:
  - @orchestr8/logger@2.1.0

## 1.0.2

### Patch Changes

- [#15](https://github.com/nathanvale/orchestr8/pull/15) [`b76f513`](https://github.com/nathanvale/orchestr8/commit/b76f513b11dd73cc3e6937441f221415a01420f1) Thanks [@nathanvale](https://github.com/nathanvale)! - fix(resilience): handle object timeout policies correctly

  Fixes TimeoutError displaying '[object Object]ms' when timeout policy
  is an object with global/perStep properties. Now properly extracts
  the numeric duration value from the object with defensive type handling.

  The fix adds proper type guards to safely handle both number and object
  formats for timeout policies, preventing confusing error messages.

  Resolves first reported support ticket about error message clarity.

## 1.0.1

### Patch Changes

- [#12](https://github.com/nathanvale/orchestr8/pull/12) [`6848811`](https://github.com/nathanvale/orchestr8/commit/68488117bb0ffcf0ea2490778747d613e26bffc9) Thanks [@nathanvale](https://github.com/nathanvale)! - fix: republish all packages with clean exports

  Remove development export conditions from all published packages to ensure
  external consumers receive clean, production-ready package.json files without
  development-specific export mappings that could cause module resolution issues.

  The prepublishOnly scripts automatically strip development exports during
  npm publishing while preserving them for fast local development workflow.

- Updated dependencies [[`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`6848811`](https://github.com/nathanvale/orchestr8/commit/68488117bb0ffcf0ea2490778747d613e26bffc9)]:
  - @orchestr8/logger@2.0.0
  - @orchestr8/schema@1.1.0

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
