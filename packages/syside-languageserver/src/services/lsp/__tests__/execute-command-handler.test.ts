/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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
import { CancellationToken, Disposable, TextDocumentIdentifier } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { parseKerML, parseSysML, services, TEST_BUILD_OPTIONS } from "../../../testing";
import { RegisterTextEditorCommandsRequest } from "syside-protocol";
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
        command: "syside.editor.editorCommands",
        expected: expect.arrayContaining([
            "syside.editor.dumpAst",
            "syside.editor.dumpAst.console",
        ]),
    },
    {
        command: "syside.editor.simpleCommands",
        expected: expect.arrayContaining([
            "syside.editor.simpleCommands",
            "syside.editor.simpleCommands.console",
        ]),
    },
    {
        command: "syside.editor.allCommands",
        expected: expect.arrayContaining([
            "syside.editor.simpleCommands",
            "syside.editor.simpleCommands.console",
        ]),
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

    test("syside.editor.updateDocument triggers document update", async () => {
        expect(handler?.executeCommand("syside.editor.updateDocument", [uri?.toJSON()])).resolves;
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
        command: "syside.editor.dumpAst",
        position: { line: 1, character: 3 }, // 'par|t'
        expected: expect.objectContaining({
            $meta: expect.objectContaining({ qualifiedName: "B" }),
        }),
    },
    {
        command: "syside.editor.dumpMeta",
        position: { line: 1, character: 3 },
        expected: expect.objectContaining({ qualifiedName: "B" }),
    },
    {
        command: "syside.editor.mro",
        position: { line: 1, character: 3 },
        expected: [expect.stringMatching(/^B/), expect.stringMatching(/^A/)],
    },
    {
        command: "syside.editor.children",
        position: { line: 1, character: 3 },
        expected: ["x", "y", "z", "v", "a", "b"].map((v) =>
            expect.stringMatching(new RegExp(`^${v}`))
        ),
    },
    {
        command: "syside.editor.scope",
        position: { line: 1, character: 3 },
        expected: ["x", "y", "z", "v", "a", "b", "A", "B", "C"].map((v) =>
            expect.stringMatching(new RegExp(`^${v}`))
        ),
    },
    {
        command: "syside.editor.evaluate",
        position: { line: 1, character: 68 }, // '=|'
        expected: [7],
        name: "feature value",
    },
    {
        command: "syside.editor.evaluate",
        position: { line: 1, character: 77 }, // '*|'
        expected: [6],
        name: "expression",
    },
    {
        command: "syside.editor.evaluate",
        position: { line: 1, character: 62 }, // 'attribu|te'
        expected: [7],
        name: "feature",
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

    test.each(EditorCommands.map((item) => ("name" in item ? item : { ...item, name: "" })))(
        "command: $command - $name",
        async ({ command, position, expected }) => {
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
        }
    );
});

describe("Custom commands", () => {
    function testRegister(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        register: (name: string, command: any, thisObj?: ThisParameterType<unknown>) => Disposable
    ): void {
        const command = "my custom command";
        let handler: SysMLExecuteCommandHandler;
        const fn = jest.fn(function (this: unknown) {
            return this;
        });
        const self = { $hello: "world" };
        let disposable: Disposable;

        beforeEach(() => {
            handler = new SysMLExecuteCommandHandler(services.shared);
            disposable = register.call(handler, command, fn, self);
        });

        test("commands can be registered", () => {
            expect(handler.commands).toEqual(expect.arrayContaining([command]));
        });

        test("commands can be removed", () => {
            disposable.dispose();
            expect(handler.commands).not.toEqual(expect.arrayContaining([command]));
        });

        test("commands can be execute", async () => {
            await handler.executeCommand(command, [0], CancellationToken.None);
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveLastReturnedWith(self);
        });
    }

    describe("editor commands can be registered and executed", () => {
        testRegister(SysMLExecuteCommandHandler.prototype.registerEditorCommand);
    });

    describe("document commands can be registered and executed", () => {
        testRegister(SysMLExecuteCommandHandler.prototype.registerDocumentCommand);
    });

    describe("simple commands can be registered and executed", () => {
        testRegister(SysMLExecuteCommandHandler.prototype.registerSimpleCommand);
    });
});
