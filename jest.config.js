/** @type {import('jest').Config} */
const config = {
    verbose: true,
    setupFilesAfterEnv: ['./jest/expectations.ts'],
};

module.exports = config;