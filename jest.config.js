// jest.config.js
export default {
    testEnvironment: 'node',
    transform: {},
    moduleFileExtensions: ['js', 'mjs'],
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    testTimeout: 30000,
    setupFilesAfterEnv: ['./tests/setup.js'],
};
