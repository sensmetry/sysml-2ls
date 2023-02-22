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

import { LangiumDocument, ParseResult } from "langium";
import { CancellationToken, TextDocumentIdentifier } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { parseKerML, parseSysML, services, TEST_BUILD_OPTIONS } from "../../../../testing";
import { RegisterTextEditorCommandsRequest } from "../../../../common/protocol-extensions";
import { SysMLExecuteCommandHandler } from "../execute-command-handler";

const log = console.log;
const mockLock = jest.fn();
beforeEach(() => {
    console.log = mockLock;
});

afterEach(() => {
    mockLock.mockClear();
    console.log = log;
});

const SimpleCommands = [
    {
        command: "sysml.editorCommands",
        expected: expect.arrayContaining(["sysml.dumpAst", "sysml.dumpAst.console"]),
    },
    {
        command: "sysml.simpleCommands",
        expected: expect.arrayContaining(["sysml.simpleCommands", "sysml.simpleCommands.console"]),
    },
    {
        command: "sysml.allCommands",
        expected: expect.arrayContaining(["sysml.simpleCommands", "sysml.simpleCommands.console"]),
    },
];

describe("simple commands can be executed", () => {
    const handler = services.shared.lsp.ExecuteCommandHandler;

    test.each(SimpleCommands)("command: $command", async ({ command, expected }) => {
        expect(handler?.executeCommand(command, [])).resolves.toEqual(expected);

        const result = await handler?.executeCommand(command + ".console", []);
        expect(result).toEqual(expected);
        expect(mockLock).toHaveBeenCalledTimes(1);
    });
});

describe("document commands can be executed", () => {
    const handler = services.shared.lsp.ExecuteCommandHandler;
    const builder = services.shared.workspace.DocumentBuilder;
    let result: ParseResult;
    let uri: URI | undefined;
    beforeAll(async () => {
        result = await parseKerML("package P;", TEST_BUILD_OPTIONS);
        uri = result.value.$document?.uri;
    });

    const mock = jest.fn();
    const update = builder.update;
    builder.update = mock;
    afterAll(() => (builder.update = update));

    test("sysml.updateDocument triggers document update", async () => {
        expect(handler?.executeCommand("sysml.updateDocument", [uri?.toJSON()])).resolves;
        expect(mock).toHaveBeenCalledTimes(1);
        expect(mock).toHaveBeenCalledWith(
            // jest somehow puts an extra `external` property on plain URI...
            [expect.objectContaining({ path: uri?.path, scheme: uri?.scheme })],
            [],
            CancellationToken.None
        );
    });
});

const EditorText = `part A { part a; protected part b; private part c; }
part B : A { part x; protected part y; private part z; attribute v = 1 + (2 * 3); }
part C;
`;

const EditorCommands = [
    {
        command: "sysml.dumpAst",
        position: { line: 1, character: 3 }, // 'par|t'
        expected: expect.objectContaining({
            $meta: expect.objectContaining({ qualifiedName: "B" }),
        }),
    },
    {
        command: "sysml.dumpMeta",
        position: { line: 1, character: 3 },
        expected: expect.objectContaining({ qualifiedName: "B" }),
    },
    {
        command: "sysml.mro",
        position: { line: 1, character: 3 },
        expected: [expect.stringMatching(/^B/), expect.stringMatching(/^A/)],
    },
    {
        command: "sysml.children",
        position: { line: 1, character: 3 },
        expected: ["x", "y", "z", "v", "B", "A", "a", "b"].map((v) =>
            expect.stringMatching(new RegExp(`^${v}`))
        ),
    },
    {
        command: "sysml.scope",
        position: { line: 1, character: 3 },
        expected: ["x", "y", "z", "v", "B", "A", "a", "b", "C"].map((v) =>
            expect.stringMatching(new RegExp(`^${v}`))
        ),
    },
    {
        command: "sysml.evaluate",
        position: { line: 1, character: 68 }, // '=|'
        expected: [7],
    },
    {
        command: "sysml.evaluate",
        position: { line: 1, character: 77 }, // '*|'
        expected: [6],
    },
    {
        command: "sysml.evaluate",
        position: { line: 1, character: 62 }, // 'attribu|te'
        expected: [7],
    },
];

describe("editor commands can be executed", () => {
    let result: ParseResult;
    let document: LangiumDocument;
    let id: TextDocumentIdentifier;

    beforeAll(async () => {
        result = await parseSysML(EditorText, TEST_BUILD_OPTIONS);
        document = result.value.$document as LangiumDocument;
        id = TextDocumentIdentifier.create(document.uriString);
        (
            services.shared.lsp.ExecuteCommandHandler as SysMLExecuteCommandHandler
        )?.registerCustomClientCommands();
        services.shared.workspace.LangiumDocuments.addDocument(document);
    });
    afterAll(() => {
        services.shared.workspace.LangiumDocuments.deleteDocument(document.uri);
    });

    const handler = services.shared.lsp.ExecuteCommandHandler;

    test.each(EditorCommands)("command: $command", async ({ command, position, expected }) => {
        const argument: RegisterTextEditorCommandsRequest.Parameters = {
            document: id,
            selection: {
                start: position,
                end: position,
                anchor: position,
                active: position,
                isReversed: false,
            },
            selections: [],
        };
        let result = await handler?.executeCommand(command, [argument]);
        expect(result).toBeDefined();
        expect(result).toEqual(expected);

        result = await handler?.executeCommand(command + ".console", [argument]);
        expect(result).toEqual(expected);
        expect(mockLock).toHaveBeenCalledTimes(1);
    });
});
