// This configuration file sets up Jest for testing an Angular application.
// It uses the `jest-preset-angular` preset, which is tailored for Angular projects.
module.exports = {
    preset: 'jest-preset-angular',
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.(css|html)$': '<rootDir>/jest-transformers.js',
        '^.+\\.(ts|mjs|html)$': 'jest-preset-angular',
    },
    moduleFileExtensions: ['ts', 'html', 'js', 'json'],
    moduleNameMapper: {
        '^@app/(.*)$': '<rootDir>/src/app/$1',
        '^@environments/(.*)$': '<rootDir>/src/environments/$1',
        '^src/(.*)$': '<rootDir>/src/$1' 
    },
    testMatch: ['**/+(*.)+(spec).+(ts)'],
    transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
};
