#!/bin/bash

# Setup Branch Protection Rules for main branch
# This script configures the recommended status checks for the ADHD-optimized CI pipeline

REPO="nathanvale/bun-changesets-template"
BRANCH="main"

echo "🔐 Setting up branch protection for $REPO:$BRANCH"
echo "================================================"

# Create the JSON configuration
cat > /tmp/branch-protection-config.json << 'EOF'
{
  "required_status_checks": {
    "strict": false,
    "checks": [
      {"context": "🔍 Lint (5m)"},
      {"context": "💅 Format (5m)"},
      {"context": "📝 Types (5m)"},
      {"context": "🔨 Build (10m)"},
      {"context": "⚡ Quick Tests (1m)"},
      {"context": "📊 CI Status"}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF

# Apply the branch protection rules
echo "📝 Applying branch protection rules..."
gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" \
  --input /tmp/branch-protection-config.json

if [ $? -eq 0 ]; then
  echo "✅ Branch protection successfully configured!"
  echo ""
  echo "Required status checks:"
  echo "  • 🔍 Lint (5m)"
  echo "  • 💅 Format (5m)"
  echo "  • 📝 Types (5m)"
  echo "  • 🔨 Build (10m)"
  echo "  • ⚡ Quick Tests (1m)"
  echo "  • 📊 CI Status"
  echo ""
  echo "Additional protections:"
  echo "  • 1 approving review required"
  echo "  • Stale reviews dismissed on new commits"
  echo "  • Conversations must be resolved"
  echo "  • Force pushes blocked"
else
  echo "❌ Failed to configure branch protection"
  echo ""
  echo "If you see 'Branch protection has been disabled', you need to:"
  echo "1. Go to https://github.com/$REPO/settings/branches"
  echo "2. Manually enable branch protection"
  echo "3. Then run this script again"
fi

# Clean up
rm -f /tmp/branch-protection-config.json