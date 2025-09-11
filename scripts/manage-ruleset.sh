#!/bin/bash

# Manage GitHub Rulesets for the repository
# This script helps configure and manage the recommended ruleset for ADHD-optimized CI

REPO="nathanvale/bun-changesets-template"
RULESET_NAME="Main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_header() {
    echo -e "${BLUE}🔐 GitHub Ruleset Manager${NC}"
    echo "================================"
    echo ""
}

function get_ruleset_id() {
    gh api "repos/$REPO/rulesets" --jq ".[] | select(.name==\"$RULESET_NAME\") | .id" 2>/dev/null
}

function check_ruleset() {
    local ruleset_id=$(get_ruleset_id)
    
    if [ -z "$ruleset_id" ]; then
        echo -e "${YELLOW}⚠️  No ruleset named '$RULESET_NAME' found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Found ruleset '$RULESET_NAME' (ID: $ruleset_id)${NC}"
    
    # Get ruleset details
    local enforcement=$(gh api "repos/$REPO/rulesets/$ruleset_id" --jq '.enforcement')
    local checks_count=$(gh api "repos/$REPO/rulesets/$ruleset_id" --jq '[.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[]] | length')
    
    echo "  • Enforcement: $enforcement"
    echo "  • Required status checks: $checks_count"
    
    return 0
}

function create_ruleset() {
    echo -e "${BLUE}Creating new ruleset '$RULESET_NAME'...${NC}"
    
    cat > /tmp/new-ruleset.json << 'EOF'
{
  "name": "Main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["~DEFAULT_BRANCH"]
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "automatic_copilot_code_review_enabled": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {"context": "🔍 Lint (5m)"},
          {"context": "💅 Format (5m)"},
          {"context": "📝 Types (5m)"},
          {"context": "🔨 Build (10m)"},
          {"context": "⚡ Quick Tests (1m)"},
          {"context": "🎯 Focused Tests (5m)"},
          {"context": "📋 Commit Lint (5m)"},
          {"context": "📦 Bundle Analysis (10m)"},
          {"context": "📊 CI Status"}
        ]
      }
    }
  ],
  "bypass_actors": []
}
EOF
    
    gh api -X POST "repos/$REPO/rulesets" --input /tmp/new-ruleset.json
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Ruleset created successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to create ruleset${NC}"
        return 1
    fi
}

function update_ruleset() {
    local ruleset_id=$(get_ruleset_id)
    
    if [ -z "$ruleset_id" ]; then
        echo -e "${RED}❌ Ruleset not found${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Updating ruleset '$RULESET_NAME' (ID: $ruleset_id)...${NC}"
    
    cat > /tmp/update-ruleset.json << 'EOF'
{
  "name": "Main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["~DEFAULT_BRANCH"]
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "automatic_copilot_code_review_enabled": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {"context": "🔍 Lint (5m)"},
          {"context": "💅 Format (5m)"},
          {"context": "📝 Types (5m)"},
          {"context": "🔨 Build (10m)"},
          {"context": "⚡ Quick Tests (1m)"},
          {"context": "🎯 Focused Tests (5m)"},
          {"context": "📋 Commit Lint (5m)"},
          {"context": "📦 Bundle Analysis (10m)"},
          {"context": "📊 CI Status"}
        ]
      }
    }
  ],
  "bypass_actors": []
}
EOF
    
    gh api -X PUT "repos/$REPO/rulesets/$ruleset_id" --input /tmp/update-ruleset.json
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Ruleset updated successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to update ruleset${NC}"
        return 1
    fi
}

function display_ruleset() {
    local ruleset_id=$(get_ruleset_id)
    
    if [ -z "$ruleset_id" ]; then
        echo -e "${RED}❌ Ruleset not found${NC}"
        return 1
    fi
    
    echo -e "${BLUE}📊 Ruleset Details${NC}"
    echo "=================="
    
    gh api "repos/$REPO/rulesets/$ruleset_id" --jq '
        "🎯 Enforcement: " + .enforcement,
        "📍 Target: " + .target,
        "",
        "📊 Required Status Checks:",
        (.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[] | "  • " + .context),
        "",
        "🔐 Pull Request Rules:",
        (.rules[] | select(.type=="pull_request") | .parameters | 
            "  • Reviews required: " + (.required_approving_review_count | tostring),
            "  • Dismiss stale reviews: " + (.dismiss_stale_reviews_on_push | tostring),
            "  • Require conversation resolution: " + (.required_review_thread_resolution | tostring)
        ),
        "",
        "🔗 View online: https://github.com/" + .source + "/rules/" + (.id | tostring)
    '
}

function disable_ruleset() {
    local ruleset_id=$(get_ruleset_id)
    
    if [ -z "$ruleset_id" ]; then
        echo -e "${RED}❌ Ruleset not found${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}⚠️  Disabling ruleset...${NC}"
    
    gh api -X PATCH "repos/$REPO/rulesets/$ruleset_id" -f enforcement=disabled
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Ruleset disabled${NC}"
    else
        echo -e "${RED}❌ Failed to disable ruleset${NC}"
        return 1
    fi
}

function enable_ruleset() {
    local ruleset_id=$(get_ruleset_id)
    
    if [ -z "$ruleset_id" ]; then
        echo -e "${RED}❌ Ruleset not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Enabling ruleset...${NC}"
    
    gh api -X PATCH "repos/$REPO/rulesets/$ruleset_id" -f enforcement=active
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Ruleset enabled${NC}"
    else
        echo -e "${RED}❌ Failed to enable ruleset${NC}"
        return 1
    fi
}

# Main script logic
print_header

case "${1:-check}" in
    check)
        check_ruleset
        ;;
    create)
        if check_ruleset 2>/dev/null; then
            echo -e "${YELLOW}Ruleset already exists. Use 'update' to modify it.${NC}"
        else
            create_ruleset
        fi
        ;;
    update)
        update_ruleset
        ;;
    display|show)
        display_ruleset
        ;;
    disable)
        disable_ruleset
        ;;
    enable)
        enable_ruleset
        ;;
    *)
        echo "Usage: $0 {check|create|update|display|disable|enable}"
        echo ""
        echo "Commands:"
        echo "  check    - Check if ruleset exists and show status"
        echo "  create   - Create new ruleset with recommended settings"
        echo "  update   - Update existing ruleset with recommended settings"
        echo "  display  - Show detailed ruleset configuration"
        echo "  disable  - Temporarily disable the ruleset"
        echo "  enable   - Re-enable the ruleset"
        exit 1
        ;;
esac

# Clean up
rm -f /tmp/new-ruleset.json /tmp/update-ruleset.json