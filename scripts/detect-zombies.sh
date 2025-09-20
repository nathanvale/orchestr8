#!/bin/bash

# Zombie Process Detection Script
# Finds and analyzes node(vitest) zombie processes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧟 Zombie Process Detection${NC}"
echo "=============================="

# Find all node processes related to vitest
echo -e "\n${YELLOW}Searching for vitest-related processes...${NC}"
VITEST_PROCESSES=$(ps aux | grep -E "node.*vitest" | grep -v grep || true)

if [ -z "$VITEST_PROCESSES" ]; then
    echo -e "${GREEN}✅ No zombie vitest processes found${NC}"
    echo "Process count: 0"
    echo "Memory usage: 0 MB"
    exit 0
else
    echo -e "${RED}⚠️  Found vitest-related processes:${NC}"
    echo "$VITEST_PROCESSES"
    echo ""

    # Count zombie processes
    ZOMBIE_COUNT=$(echo "$VITEST_PROCESSES" | wc -l)
    echo -e "${RED}Zombie process count: $ZOMBIE_COUNT${NC}"

    # Calculate memory usage
    MEMORY_MB=$(echo "$VITEST_PROCESSES" | awk '{sum+=$6} END {printf "%.1f", sum/1024}')
    echo -e "${RED}Total memory usage: ${MEMORY_MB} MB${NC}"

    # Show PIDs
    PIDS=$(echo "$VITEST_PROCESSES" | awk '{print $2}' | tr '\n' ' ')
    echo -e "${RED}PIDs: $PIDS${NC}"

    # Generate JSON output if requested
    if [ "$1" = "--json" ]; then
        cat << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "zombie_count": $ZOMBIE_COUNT,
  "memory_mb": $MEMORY_MB,
  "pids": [$(echo "$PIDS" | sed 's/ /, /g' | sed 's/, $//')],
  "processes": [
$(echo "$VITEST_PROCESSES" | awk '{printf "    {\"user\": \"%s\", \"pid\": %s, \"cpu\": \"%s\", \"mem\": \"%s\", \"command\": \"", $1, $2, $3, $4; for(i=11;i<=NF;i++) printf "%s ", $i; printf "\"},\n"}' | sed '$ s/,$//')
  ]
}
EOF
    fi

    exit 1
fi