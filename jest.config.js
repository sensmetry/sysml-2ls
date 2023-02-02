/** @type {import('jest').Config} */
module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/src/testing/setup-jest.ts"],
    testTimeout: 5000,
    roots: ["<rootDir>/src"],
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts"],
    coveragePathIgnorePatterns: [
        "node_modules",
        "__test__",
        "<rootDir>/src/testing",
        // auto-generated
        "generated",
        // IDE specific
        "<rootDir>/src/extension.ts",
        // can only be tested through respective IDEs
        "<rootDir>/src/language-client/vscode.ts",
        // server CLI entry point
        "<rootDir>/src/language-server/main.ts",
    ],
    coverageReporters: ["html", "text", "text-summary", "cobertura"],
    testRegex: "(\\.|/)(test|spec)\\.[jt]sx?$",
};
