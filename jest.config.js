/* eslint-disable no-undef */
/** @type {import('jest').Config} */
module.exports = {
    ...require("./jest.config.base"),
    projects: [
        "<rootDir>/packages/syside-protocol",
        "<rootDir>/packages/syside-languageclient",
        "<rootDir>/packages/syside-languageserver",
        "<rootDir>/packages/syside-cli",
    ],
};
