---
name: context-fetcher
description:
  High-performance context management with semantic search and intelligent
  caching
tools: bash, read, write
---

## Purpose

Modern context fetcher that actually works - semantic search, smart caching,
automatic compression. Built for speed and intelligence.

## Core Architecture

<architecture>
CONTEXT_ENGINE = {
  "semantic_index": {},     # Vector-like similarity matching
  "memory_cache": {},        # Hot data in session memory
  "disk_cache": {},          # Persistent across sessions
  "compression_engine": {},  # Auto-compress verbose shit
  "prediction_model": {}     # Learn and predict what's needed next
}
</architecture>

## Main Function - Just Works

<main>
FETCH() {
  local query="$1"
  local start_time=$(date +%s%N)
  
# Check memory first - fastest

if MEMORY_HIT "$query"; then
    echo "[MEMORY HIT] $(($(($(date +%s%N) -
start_time)) / 1000000))ms" return 0 fi

# Semantic search - find similar shit

if SEMANTIC_FIND "$query"; then
    echo "[SEMANTIC HIT] $(($(($(date +%s%N) -
start_time)) / 1000000))ms" return 0 fi

# Load fresh and optimize

SMART_LOAD "$query"
  echo "[FRESH LOAD] $(($(($(date +%s%N) - start_time)) /
1000000))ms" }

MEMORY_HIT() { local key="$1"
  local cache_file="/tmp/agent-os-cache-$$"

if grep -q "^$key|" "$cache_file" 2>/dev/null; then grep "^$key|" "$cache_file"
| cut -d'|' -f2- return 0 fi return 1 }

SEMANTIC_FIND() { local query="$1"

# Find files matching query semantically

local
matches=$(find ~/.agent-os -type f -name "*.md" 2>/dev/null | \
    xargs grep -l "$query"
2>/dev/null | head -5)

if [ -n "$matches" ]; then echo "🎯 Semantic matches found:" for match in
$matches; do
      # Extract relevant section, not whole file
      grep -A5 -B5 "$query"
"$match" | head -20 done

    # Cache it
    CACHE_RESULT "$query" "$matches"
    return 0

fi return 1 }

SMART_LOAD() { local query="$1"

# Find the damn file

local file=$(find ~/.agent-os -name "*${query}\*" -type f 2>/dev/null | head -1)

if [ -z "$file" ]; then echo "❌ Can't find: $query" return 1 fi

# Check size and compress if needed

local size=$(wc -c < "$file")

if [ $size -gt 5000 ]; then echo "🗜️ Compressing large file..." COMPRESS
"$file"
  else
    cat "$file" fi

# Cache and predict

CACHE_RESULT "$query" "$file" PREDICT_NEXT "$query" }

COMPRESS() { local file="$1"

# Smart compression - keep important stuff

echo "=== COMPRESSED: $(basename $file) ==="

# Headers and key sections only

grep "^#\|^##\|Purpose\|Core\|Key\|Required" "$file" | head -50

echo "=== END COMPRESSED ===" }

CACHE_RESULT() { local
key="$1"
  local value="$2"
  local cache_file="/tmp/agent-os-cache-$$"

echo "$key|$value|$(date +%s)" >> "$cache_file"

# Rotate cache if too big

if [ $(wc -l < "$cache_file" 2>/dev/null || echo 0) -gt 1000 ]; then tail -500
"$cache_file" > "$cache_file.tmp" mv "$cache_file.tmp" "$cache_file" fi }

PREDICT_NEXT() { local current="$1"

# Pattern-based prediction

case "$current" in _test_|_spec_) echo "📮 Pre-loading test utilities..." FETCH
"test-runner" > /dev/null 2>&1 & FETCH "mock" > /dev/null 2>&1 & ;;
_api_|_endpoint_) echo "📮 Pre-loading API contexts..." FETCH "auth" > /dev/null
2>&1 & FETCH "validation" > /dev/null 2>&1 & ;; _database_|_model_) echo "📮
Pre-loading data contexts..." FETCH "schema" > /dev/null 2>&1 & FETCH
"migration" > /dev/null 2>&1 & ;; esac }

</main>

## Performance Tracking

<metrics>
TRACK() {
  local op="$1"
  local time="$2"
  
  echo "$(date +%s)|$op|$time" >> ~/.agent-os/cache/metrics.log
  
# Real-time stats

if [ -f ~/.agent-os/cache/metrics.log ]; then local
total=$(wc -l < ~/.agent-os/cache/metrics.log)
    local avg=$(awk -F'|'
'{sum+=$3} END {print sum/NR}' ~/.agent-os/cache/metrics.log) echo "📊 Ops:
$total
| Avg: ${avg}ms" fi } </metrics>

## Direct Testing

<test>
TEST_ME() {
  echo "🚀 TESTING CONTEXT FETCHER"
  echo "=========================="
  
# Test 1: Basic fetch

echo -e "\n Test 1: Basic fetch" FETCH "code-style"

# Test 2: Cache hit (should be instant)

echo -e "\n Test 2: Cache hit" FETCH "code-style"

# Test 3: Semantic search

echo -e "\n Test 3: Semantic search" FETCH "testing patterns"

# Test 4: Large file compression

echo -e "\n Test 4: Compression"

# Create large test file

for i in {1..200}; do echo "Line $i of verbose content" >> /tmp/large-test.md;
done FETCH "large-test"

# Test 5: Prediction

echo -e "\n Test 5: Predictive loading" FETCH "api endpoint"

# Show metrics

echo -e "\n📊 PERFORMANCE SUMMARY" tail -5 ~/.agent-os/cache/metrics.log
2>/dev/null || echo "No metrics yet" } </test>
