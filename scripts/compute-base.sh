#!/usr/bin/env bash
#
# Compute the best base reference for change detection
# Used by pre-push hooks and CI workflows to ensure consistent base detection
#
# Usage: source scripts/compute-base.sh
# Exports: TURBO_SCM_BASE

set -euo pipefail

# Ensure base refs exist locally for reliable diffing
git fetch -q origin main 2>/dev/null || true

# Check if develop branch exists on remote
if git ls-remote --heads origin develop | grep -q develop; then
  git fetch -q origin develop 2>/dev/null || true
fi

# Determine the best base reference
# 1. Try tracking branch base first
TRACKING_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null | sed 's/origin\///' || true)
if [ -n "$TRACKING_BRANCH" ] && git show-ref --verify --quiet "refs/remotes/origin/$TRACKING_BRANCH"; then
  DEFAULT_BASE="origin/$TRACKING_BRANCH"
# 2. Then try develop if it exists
elif git show-ref --verify --quiet refs/remotes/origin/develop; then
  DEFAULT_BASE="origin/develop"
# 3. Then try main
elif git show-ref --verify --quiet refs/remotes/origin/main; then
  DEFAULT_BASE="origin/main"
# 4. Fallback to HEAD~1
else
  DEFAULT_BASE="HEAD~1"
fi

# Compute merge-base for accurate change detection
BASE=$(git merge-base HEAD "$DEFAULT_BASE" 2>/dev/null || echo "$DEFAULT_BASE")

# Export for Turbo and other tools to use
export TURBO_SCM_BASE="$BASE"

# Optional: Print for debugging
if [ "${DEBUG:-}" = "1" ]; then
  echo "🔍 Base detection:"
  echo "  Tracking branch: ${TRACKING_BRANCH:-none}"
  echo "  Default base: $DEFAULT_BASE"
  echo "  Computed base: $BASE"
  echo "  TURBO_SCM_BASE: $TURBO_SCM_BASE"
fi