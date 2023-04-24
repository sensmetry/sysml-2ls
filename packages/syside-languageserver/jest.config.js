/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-var-requires

/** @type {import('jest').Config} */
module.exports = {
    ...require("../../jest.config.base"),
    roots: ["<rootDir>/src"],
    setupFilesAfterEnv: ["<rootDir>/src/testing/setup-jest.ts"],
    coveragePathIgnorePatterns: [
        "node_modules",
        "__tests__",
        "<rootDir>/src/testing",
        // auto-generated
        "<rootDir>/src/generated",
        // server CLI entry point
        "<rootDir>/src/main.ts",
    ],
};