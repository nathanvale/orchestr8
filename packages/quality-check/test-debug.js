import { TypeScriptEngine } from './dist/engines/typescript-engine.js';
import path from 'path';
import fs from 'fs';

// Create test directory
const testDir = '/tmp/ts-test-debug';
fs.mkdirSync(testDir, { recursive: true });

// Create strict tsconfig
const tsconfig = {
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'bundler',
    esModuleInterop: true,
    skipLibCheck: true,
    strict: true,
    strictNullChecks: true,
    strictFunctionTypes: true
  },
  include: ['src/**/*'],
  exclude: ['node_modules', 'dist']
};

fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

// Create src directory
fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

// Create test file with strict null issues
const testCode = `interface User {
  id: number
  name: string
  email?: string
}

export function getUserEmail(user: User | null): string {
  // This should trigger strict null check issues
  return user.email
}

export function processUsers(users: User[]): string[] {
  return users.map(u => u.email)
}`;

const testFile = path.join(testDir, 'src', 'strict-null.ts');
fs.writeFileSync(testFile, testCode);

// Test TypeScript engine
const engine = new TypeScriptEngine();
process.chdir(testDir);

const result = await engine.check({
  files: [testFile]
});

console.log('Result:', JSON.stringify(result, null, 2));
console.log('Issues found:', result.issues.length);
result.issues.forEach(issue => {
  console.log(`- ${issue.ruleId}: ${issue.message}`);
});
