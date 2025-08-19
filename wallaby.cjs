module.exports = function(wallaby) {
  return {
    autoDetect: ['vitest'],
    
    // Force use of root vitest config - critical for monorepo
    testFramework: {
      configFile: './vitest.config.ts'
    },
    
    env: {
      type: 'node',
      runner: 'node'
    },
    
    workers: {
      initial: 1,
      regular: 1
    }
  };
};