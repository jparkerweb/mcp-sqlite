module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Test file patterns
    testMatch: ['**/test/**/*.test.js', '**/__tests__/**/*.js'],

    // Coverage configuration
    collectCoverageFrom: [
        'src/mcp-sqlite-server.js',
        '!**/node_modules/**',
        '!**/test/**',
        '!**/coverage/**',
    ],

    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

    // Coverage thresholds (disabled since we test with mock implementations)
    // coverageThreshold: {
    //   global: {
    //     branches: 80,
    //     functions: 80,
    //     lines: 80,
    //     statements: 80
    //   }
    // },

    // Test timeout
    testTimeout: 10000,

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks between tests
    restoreMocks: true,

    // Verbose output
    verbose: true,

    // Force exit after tests complete
    forceExit: true,

    // Detect open handles
    detectOpenHandles: true,
};
