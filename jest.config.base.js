/** @type {import('@swc/core').Config} */
const swcConfig = {
    jsc: {
        parser: {
            syntax: "typescript",
            decorators: true,
        },
        target: "es2022",
        loose: false,
        externalHelpers: false,
        // Requires v1.2.50 or upper and requires target to be es2016 or upper.
        keepClassNames: false,
    },
    minify: false,
};

/** @type {import('jest').Config} */
// eslint-disable-next-line no-undef
module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest", swcConfig],
    },
    transformIgnorePatterns: ["<rootDir>/node_modules/"],
    testEnvironment: "node",
    testTimeout: 10000,
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts"],
    coveragePathIgnorePatterns: ["node_modules", "__tests__", "__test__", "testing"],
    coverageReporters: ["html", "text", "text-summary", "cobertura"],
    testRegex: "(\\.|/)(test|spec)\\.[jt]sx?$",
};
