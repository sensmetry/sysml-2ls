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

/* eslint-disable @typescript-eslint/no-empty-function */

import { Duplex } from "stream";
import {
    CancellationTokenSource,
    ConfigurationParams,
    ConfigurationRequest,
    InitializedNotification,
    InitializeResult,
    Logger,
    ProtocolConnection,
    RegistrationRequest,
    SemanticTokenModifiers,
    SemanticTokenTypes,
    ShutdownRequest,
} from "vscode-languageserver";
import * as CONFIG from "../../../../../syside-vscode/package.json";
import {
    Connection,
    createConnection,
    createProtocolConnection,
    ProposedFeatures,
    StreamMessageReader,
    StreamMessageWriter,
} from "vscode-languageserver/node";
import { DeepPartial, startLanguageServer } from "langium";
import { InitializeRequest } from "vscode-languageserver";
import { ClientParams } from "../../../testing/server-initialize-params";
import { Trace } from "vscode-languageserver";
import { TEST_SERVER_OPTIONS } from "../../../testing";
import { createSysMLServices } from "../../../sysml-module";
import { asyncWaitWhile } from "../../../utils/common";
import { SysMLConfig, DefaultSysMLConfig } from "../../config";
import { SysMLSharedServices } from "../../services";
import { SETTINGS_KEY } from "../../shared/workspace/configuration-provider";
import { SysMLEmptyFileSystem } from "../../shared/workspace/file-system-provider";
import { SUPPORTED_TRIGGER_CHARACTERS } from "../completion-provider";
import { SysMLExecuteCommandHandler } from "../execute-command-handler";
import { SysMLSemanticTokenTypes, SysMLSemanticTokenModifiers } from "../semantic-token-provider";
import { ClientConfig, GenericLanguageClient, SysMLClientExtender } from "syside-languageclient";

class NullLogger implements Logger {
    error(_message: string): void {}
    warn(_message: string): void {}
    info(_message: string): void {}
    log(_message: string): void {}
}

class TestStream extends Duplex {
    override _write(chunk: string, _encoding: string, done: () => void): void {
        this.emit("data", chunk);
        done();
    }

    override _read(_size: number): void {}
}

class TestClientExtender extends SysMLClientExtender {
    commands: string[] = [];

    override async extend<T extends GenericLanguageClient>(client: T): Promise<T> {
        super.extend(client);
        client.onRequest(ConfigurationRequest.type, (params: ConfigurationParams) =>
            params.items.map((item) => {
                if (item.section === "sysml") return this.configurationRequest();
                return {};
            })
        );

        return client;
    }

    protected registerTextEditorCommand(command: string): void {
        this.commands.push(command);
    }

    selectStdlibPath = jest.fn(() => undefined);
    configurationRequest = jest.fn((): DeepPartial<SysMLConfig> => {
        return {
            ...TEST_SERVER_OPTIONS,
            // want to check that the workspace manager attempts to find the
            // standard library
            standardLibrary: true,
            skipWorkspaceInit: false,
        };
    });

    loadConfig = jest.fn();
    saveConfig = jest.fn();
    maybeUpdateDownloadedStdlib = jest.fn();
}

interface Services {
    server: Connection;
    // can't use any specific client tied to an editor/IDE (VS Code) so a
    // connection will do
    client: ProtocolConnection;
    shared: SysMLSharedServices;
    initialized?: InitializeResult;
    extender: TestClientExtender;
}

let _services: Services | undefined;

async function getLanguageServices(): Promise<Services> {
    if (_services) return _services;

    const up = new TestStream();
    const down = new TestStream();
    const logger = new NullLogger();
    const clientConnection = createProtocolConnection(
        new StreamMessageReader(down),
        new StreamMessageWriter(up),
        logger
    );
    clientConnection.listen();
    const extender = new TestClientExtender();
    await extender.extend(clientConnection);

    // ignore registration request, consumes the requests so that there are no
    // errors reported on disposing the connection
    clientConnection.onRequest(RegistrationRequest.type, () => {});

    const connection = createConnection(ProposedFeatures.all, up, down);
    const { shared } = createSysMLServices(
        { connection, ...SysMLEmptyFileSystem },
        TEST_SERVER_OPTIONS
    );

    // Start the language server with the shared services
    startLanguageServer(shared);

    const services: Services = {
        server: connection,
        client: clientConnection,
        shared: shared,
        extender,
    };

    _services = services;
    return services;
}

async function initializeServices(services: Services): Promise<void> {
    await services.client.trace(Trace.Off, {
        log: (message: string | unknown, data?: string) => {
            console.log(message);
            if (data) console.log(data);
        },
    });
    services.initialized = await services.client.sendRequest(
        InitializeRequest.type,
        ClientParams,
        new CancellationTokenSource().token
    );
    await services.client.sendNotification(InitializedNotification.type, {});
}

async function stopServices(services: Services): Promise<void> {
    await services.client.sendRequest(ShutdownRequest.type);

    services.shared.lsp.Connection?.dispose();
    services.server.dispose();

    services.client.end();
    services.client.dispose();
}

interface ExportedModifier {
    id: string;
    description: string;
}

interface ExportedType extends ExportedModifier {
    superType: string;
}

describe("package.json exports custom contributions", () => {
    test("exported custom semantic token types match the types defined", () => {
        const builtin: string[] = Object.values(SemanticTokenTypes);
        const types: ExportedType[] = CONFIG.contributes.semanticTokenTypes;
        const supertypes = types.map((t) => t.superType);
        const exported = builtin.concat(types.map((t) => t.id));
        const expected = Object.values(SysMLSemanticTokenTypes);

        expect(exported).toEqual(expect.arrayContaining(expected));
        expect(expected).toEqual(expect.arrayContaining(exported));
        expect(exported).toEqual(expect.arrayContaining(supertypes));
    });

    test("exported custom semantic token modifiers match the modifiers defined", () => {
        const builtin: string[] = Object.values(SemanticTokenModifiers);
        const modifiers: ExportedModifier[] = CONFIG.contributes.semanticTokenModifiers;
        const exported = builtin.concat(modifiers.map((m) => m.id));
        const expected = Object.values(SysMLSemanticTokenModifiers);

        expect(exported).toEqual(expect.arrayContaining(expected));
        expect(expected).toEqual(expect.arrayContaining(exported));
    });

    describe("exported configuration properties are known and valid", () => {
        test.each(Object.entries(CONFIG.contributes.configuration.properties))(
            "property: %p",
            (property, data) => {
                const parts = property.split(".");
                expect(parts.length).toBeGreaterThanOrEqual(1);
                expect(parts[0]).toEqual(SETTINGS_KEY);
                let section: Record<string, unknown> = DefaultSysMLConfig;
                for (const part of parts.slice(1)) {
                    expect(Object.keys(section)).toContain(part);
                    section = section[part] as Record<string, unknown>;
                }

                if ("enum" in data && section) {
                    expect(data.enum).toContain(section);
                }

                // can only check that the type field contains one of the type
                // alternatives since compile time types are discarded at
                // runtime
                expect(data.type).toContain(
                    typeof section === "undefined"
                        ? "null"
                        : Array.isArray(section)
                        ? "array"
                        : typeof section
                );
            }
        );
    });

    test("exported commands are all known", async () => {
        const exported = CONFIG.contributes.commands.map((v) => v.command);
        // don't initialize the client/server as there are other tests for that
        const services = await getLanguageServices();

        const lsp = services.shared.lsp;
        expect(lsp.ExecuteCommandHandler).toBeDefined();
        expect(lsp.ExecuteCommandHandler instanceof SysMLExecuteCommandHandler).toBeTruthy();

        const handler = lsp.ExecuteCommandHandler as SysMLExecuteCommandHandler;
        const registered = handler.commands.concat(handler["getEditorCommands"]());

        expect(registered).toEqual(expect.arrayContaining(exported));
    });
});

async function asyncWhile(predicate: () => boolean): Promise<void> {
    // ignore errors, the tests should show it instead
    await asyncWaitWhile(predicate, { timeout: 100 }).catch(() => {});
}

describe("Language server registration tests", () => {
    let services: Services;

    beforeAll(async () => {
        services = await getLanguageServices();
        await initializeServices(services);

        // put test wait conditions here as initialized is only a notification
        // so it doesn't block until it is resolved
        await asyncWhile(() => services.extender.commands.length === 0);
        await asyncWhile(() => services.extender.configurationRequest.mock.calls.length === 0);
        await asyncWhile(() => services.extender.selectStdlibPath.mock.calls.length === 0);
    });

    test("custom semantic token types and modifiers are registered", () => {
        expect(services.initialized).toBeDefined();
        expect(services.initialized?.capabilities.semanticTokensProvider?.legend).toMatchObject({
            tokenTypes: Object.values(SysMLSemanticTokenTypes),
            tokenModifiers: Object.values(SysMLSemanticTokenModifiers),
        });
    });

    test("suggestion trigger characters are registered and valid", () => {
        expect(services.initialized).toBeDefined();
        expect(services.initialized?.capabilities.completionProvider?.triggerCharacters).toEqual(
            SUPPORTED_TRIGGER_CHARACTERS
        );
        expect(SUPPORTED_TRIGGER_CHARACTERS).toEqual(
            // word characters already trigger completion
            Array(SUPPORTED_TRIGGER_CHARACTERS.length).fill(expect.stringMatching(/[^\w]/))
        );
    });

    test("custom editor commands are requested for registration", async () => {
        expect(services.extender.commands).toEqual(
            (services.shared.lsp.ExecuteCommandHandler as SysMLExecuteCommandHandler)[
                "getEditorCommands"
            ]()
        );
    });

    test("configuration was requested on initialization", async () => {
        expect(services.extender.configurationRequest).toHaveBeenCalled();
    });

    test("a request is sent if no standard library was found", async () => {
        expect(services.extender.selectStdlibPath).toHaveBeenCalledTimes(1);
    });

    test("client loads config on initialization", async () => {
        expect(services.extender.loadConfig).toHaveBeenCalledTimes(1);
    });

    test("client saves config on initialization", async () => {
        expect(services.extender.saveConfig).toHaveBeenCalledTimes(1);
        expect(services.extender.saveConfig).toHaveBeenCalledWith(services.extender.config);
    });

    test("client asks to download a newer version of standard library if no config was loaded", async () => {
        expect(services.extender.maybeUpdateDownloadedStdlib).toHaveBeenCalledTimes(1);
    });

    test("client asks to download a newer version of standard library if the urls don't match", async () => {
        services.extender.maybeUpdateDownloadedStdlib.mockClear();
        services.extender.maybeUpdateDownloadedStdlib.mockReturnValueOnce(<ClientConfig>{
            stdlibUrl: services.extender["stdlibRepoZipUrl"] + "...",
        });
        await services.extender["initializeClient"]();

        expect(services.extender.maybeUpdateDownloadedStdlib).toHaveBeenCalledTimes(1);
    });
});

afterAll(async () => {
    if (!_services) return;
    await stopServices(_services);
});
