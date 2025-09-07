#!/bin/bash

# Create test directory
TEST_DIR="/tmp/hook-test-debug"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/src"

cd "$TEST_DIR"

# Create tsconfig
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
TSCONFIG

# Create package.json
cat > package.json << 'PACKAGE'
{
  "name": "test-project",
  "version": "1.0.0",
  "type": "module"
}
PACKAGE

# Test payload
PAYLOAD='{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "'$TEST_DIR'/src/strict-null.ts",
    "content": "interface User {\n  id: number\n  name: string\n  email?: string\n}\n\nexport function getUserEmail(user: User | null): string {\n  // This should trigger strict null check issues\n  return user.email\n}\n\nexport function processUsers(users: User[]): string[] {\n  return users.map(u => u.email)\n}"
  }
}'

echo "Payload:"
echo "$PAYLOAD"
echo ""
echo "Running claude-hook..."

# Run the claude-hook
echo "$PAYLOAD" | node /Users/nathanvale/code/bun-changesets-template/packages/quality-check/bin/claude-hook

echo "Exit code: $?"
