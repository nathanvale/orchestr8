// Server-specific vitest setup without MSW
// This setup file is used for server integration tests that make real HTTP requests

// No MSW setup for server tests - we want real HTTP requests to go through
console.log('Server test setup: Skipping MSW configuration for real HTTP requests')
