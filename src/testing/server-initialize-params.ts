/********************************************************************************
 * Copyright (c) 2022-2023 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { InitializeParams } from "vscode-languageserver-protocol";
import { URI } from "vscode-uri";

/**
 * Parameters that client sends to the server as part of initialize request.
 * Copied from VS Code.
 */
export const ClientParams: InitializeParams = {
    // use null id since we are running the test server in the same process,
    // prevents watchdog from keeping test script alive
    processId: null,
    locale: "en-gb",
    rootPath: __dirname,
    rootUri: URI.file(__dirname).toString(),
    capabilities: {
        workspace: {
            applyEdit: true,
            workspaceEdit: {
                documentChanges: true,
                resourceOperations: ["create", "rename", "delete"],
                failureHandling: "textOnlyTransactional",
                normalizesLineEndings: true,
                changeAnnotationSupport: {
                    groupsOnLabel: true,
                },
            },
            configuration: true,
            didChangeWatchedFiles: {
                dynamicRegistration: true,
                relativePatternSupport: true,
            },
            symbol: {
                dynamicRegistration: true,
                symbolKind: {
                    valueSet: [
                        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
                        22, 23, 24, 25, 26,
                    ],
                },
                tagSupport: {
                    valueSet: [1],
                },
                resolveSupport: {
                    properties: ["location.range"],
                },
            },
            codeLens: {
                refreshSupport: true,
            },
            executeCommand: {
                dynamicRegistration: true,
            },
            didChangeConfiguration: {
                dynamicRegistration: true,
            },
            workspaceFolders: true,
            semanticTokens: {
                refreshSupport: true,
            },
            fileOperations: {
                dynamicRegistration: true,
                didCreate: true,
                didRename: true,
                didDelete: true,
                willCreate: true,
                willRename: true,
                willDelete: true,
            },
            inlineValue: {
                refreshSupport: true,
            },
            inlayHint: {
                refreshSupport: true,
            },
            diagnostics: {
                refreshSupport: true,
            },
        },
        textDocument: {
            publishDiagnostics: {
                relatedInformation: true,
                versionSupport: false,
                tagSupport: {
                    valueSet: [1, 2],
                },
                codeDescriptionSupport: true,
                dataSupport: true,
            },
            synchronization: {
                dynamicRegistration: true,
                willSave: true,
                willSaveWaitUntil: true,
                didSave: true,
            },
            completion: {
                dynamicRegistration: true,
                contextSupport: true,
                completionItem: {
                    snippetSupport: true,
                    commitCharactersSupport: true,
                    documentationFormat: ["markdown", "plaintext"],
                    deprecatedSupport: true,
                    preselectSupport: true,
                    tagSupport: {
                        valueSet: [1],
                    },
                    insertReplaceSupport: true,
                    resolveSupport: {
                        properties: ["documentation", "detail", "additionalTextEdits"],
                    },
                    insertTextModeSupport: {
                        valueSet: [1, 2],
                    },
                    labelDetailsSupport: true,
                },
                insertTextMode: 2,
                completionItemKind: {
                    valueSet: [
                        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
                        22, 23, 24, 25,
                    ],
                },
                completionList: {
                    itemDefaults: [
                        "commitCharacters",
                        "editRange",
                        "insertTextFormat",
                        "insertTextMode",
                    ],
                },
            },
            hover: {
                dynamicRegistration: true,
                contentFormat: ["markdown", "plaintext"],
            },
            signatureHelp: {
                dynamicRegistration: true,
                signatureInformation: {
                    documentationFormat: ["markdown", "plaintext"],
                    parameterInformation: {
                        labelOffsetSupport: true,
                    },
                    activeParameterSupport: true,
                },
                contextSupport: true,
            },
            definition: {
                dynamicRegistration: true,
                linkSupport: true,
            },
            references: {
                dynamicRegistration: true,
            },
            documentHighlight: {
                dynamicRegistration: true,
            },
            documentSymbol: {
                dynamicRegistration: true,
                symbolKind: {
                    valueSet: [
                        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
                        22, 23, 24, 25, 26,
                    ],
                },
                hierarchicalDocumentSymbolSupport: true,
                tagSupport: {
                    valueSet: [1],
                },
                labelSupport: true,
            },
            codeAction: {
                dynamicRegistration: true,
                isPreferredSupport: true,
                disabledSupport: true,
                dataSupport: true,
                resolveSupport: {
                    properties: ["edit"],
                },
                codeActionLiteralSupport: {
                    codeActionKind: {
                        valueSet: [
                            "",
                            "quickfix",
                            "refactor",
                            "refactor.extract",
                            "refactor.inline",
                            "refactor.rewrite",
                            "source",
                            "source.organizeImports",
                        ],
                    },
                },
                honorsChangeAnnotations: false,
            },
            codeLens: {
                dynamicRegistration: true,
            },
            formatting: {
                dynamicRegistration: true,
            },
            rangeFormatting: {
                dynamicRegistration: true,
            },
            onTypeFormatting: {
                dynamicRegistration: true,
            },
            rename: {
                dynamicRegistration: true,
                prepareSupport: true,
                prepareSupportDefaultBehavior: 1,
                honorsChangeAnnotations: true,
            },
            documentLink: {
                dynamicRegistration: true,
                tooltipSupport: true,
            },
            typeDefinition: {
                dynamicRegistration: true,
                linkSupport: true,
            },
            implementation: {
                dynamicRegistration: true,
                linkSupport: true,
            },
            colorProvider: {
                dynamicRegistration: true,
            },
            foldingRange: {
                dynamicRegistration: true,
                rangeLimit: 5000,
                lineFoldingOnly: true,
                foldingRangeKind: {
                    valueSet: ["comment", "imports", "region"],
                },
                foldingRange: {
                    collapsedText: false,
                },
            },
            declaration: {
                dynamicRegistration: true,
                linkSupport: true,
            },
            selectionRange: {
                dynamicRegistration: true,
            },
            callHierarchy: {
                dynamicRegistration: true,
            },
            semanticTokens: {
                dynamicRegistration: true,
                tokenTypes: [
                    "namespace",
                    "type",
                    "class",
                    "enum",
                    "interface",
                    "struct",
                    "typeParameter",
                    "parameter",
                    "variable",
                    "property",
                    "enumMember",
                    "event",
                    "function",
                    "method",
                    "macro",
                    "keyword",
                    "modifier",
                    "comment",
                    "string",
                    "number",
                    "regexp",
                    "operator",
                    "decorator",
                ],
                tokenModifiers: [
                    "declaration",
                    "definition",
                    "readonly",
                    "static",
                    "deprecated",
                    "abstract",
                    "async",
                    "modification",
                    "documentation",
                    "defaultLibrary",
                ],
                formats: ["relative"],
                requests: {
                    range: true,
                    full: {
                        delta: true,
                    },
                },
                multilineTokenSupport: false,
                overlappingTokenSupport: false,
                serverCancelSupport: true,
                augmentsSyntaxTokens: true,
            },
            linkedEditingRange: {
                dynamicRegistration: true,
            },
            typeHierarchy: {
                dynamicRegistration: true,
            },
            inlineValue: {
                dynamicRegistration: true,
            },
            inlayHint: {
                dynamicRegistration: true,
                resolveSupport: {
                    properties: [
                        "tooltip",
                        "textEdits",
                        "label.tooltip",
                        "label.location",
                        "label.command",
                    ],
                },
            },
            diagnostic: {
                dynamicRegistration: true,
                relatedDocumentSupport: false,
            },
        },
        window: {
            showMessage: {
                messageActionItem: {
                    additionalPropertiesSupport: true,
                },
            },
            showDocument: {
                support: true,
            },
            workDoneProgress: true,
        },
        general: {
            staleRequestSupport: {
                cancel: true,
                retryOnContentModified: [
                    "textDocument/semanticTokens/full",
                    "textDocument/semanticTokens/range",
                    "textDocument/semanticTokens/full/delta",
                ],
            },
            regularExpressions: {
                engine: "ECMAScript",
                version: "ES2020",
            },
            markdown: {
                parser: "marked",
                version: "1.1.0",
            },
            positionEncodings: ["utf-16"],
        },
        notebookDocument: {
            synchronization: {
                dynamicRegistration: true,
                executionSummarySupport: true,
            },
        },
    },
    trace: "verbose",
    workspaceFolders: [
        {
            uri: URI.file(__dirname).toString(),
            name: "tests",
        },
    ],
};
