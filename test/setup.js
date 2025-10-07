// Test setup file
// This file runs before each test file

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
    // Helper to create unique test database paths
    createTestDbPath: testName => {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        return require('path').join(__dirname, `test-${testName}-${timestamp}-${randomId}.db`);
    },

    // Helper to clean up test files
    cleanupTestFiles: () => {
        const fs = require('fs');
        const path = require('path');

        try {
            const files = fs.readdirSync(__dirname);
            files.forEach(file => {
                if (file.startsWith('test-') && file.endsWith('.db')) {
                    fs.unlinkSync(path.join(__dirname, file));
                }
            });
        } catch (error) {
            // Ignore cleanup errors
        }
    },
};

// Clean up any leftover test files before starting
global.testUtils.cleanupTestFiles();

// Clean up after all tests
afterAll(() => {
    global.testUtils.cleanupTestFiles();
});
