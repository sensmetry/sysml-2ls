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

import { MaybePromise } from "langium";
import path from "path";
import { ExecuteCommandRequest, ProtocolConnection } from "vscode-languageserver";
import { cacheDir } from "../common/download";
import {
    FindStdlibRequest,
    RegisterTextEditorCommandsRequest,
} from "../common/protocol-extensions";

/**
 * Minimal interface for generic language clients
 */
export type GenericLanguageClient = Pick<
    ProtocolConnection,
    | "sendRequest"
    | "sendNotification"
    | "onRequest"
    | "onNotification"
    | "sendProgress"
    | "onProgress"
>;

// Period in ms for keep-alive progress messages
const HEARTBEAT_PERIOD = 1000; // ms

/**
 * Extender for IDE agnostic generic language clients with SysML specific functionality
 */
export abstract class SysMLClientExtender {
    /**
     * Client config
     */
    config: ClientConfig = {
        stdlibUrl: this.stdlibRepoZipUrl,
    };

    /**
     * Extend language {@link client} with SysML specific handlers. Should be
     * called before starting the language client.
     * @param client language client to extend
     * @returns same client
     */
    async extend<T extends GenericLanguageClient>(client: T): Promise<T> {
        this.installTextEditorCommandsHandler(client);
        this.installStdlibFinder(client);

        await this.initializeClient();
        return client;
    }

    /**
     * Install a handler for registering custom text editor commands
     */
    private installTextEditorCommandsHandler(client: GenericLanguageClient): void {
        client.onRequest(RegisterTextEditorCommandsRequest.type, (message) => {
            message.commands.forEach((command) =>
                this.registerTextEditorCommand(command, (editor) =>
                    client.sendRequest(ExecuteCommandRequest.type, { command, arguments: [editor] })
                )
            );
        });
    }

    /**
     * Install a handler for stdlib path requests
     */
    private installStdlibFinder(client: GenericLanguageClient): void {
        client.onRequest(FindStdlibRequest.type, async () => {
            // send a periodic message to notify server that we are still alive
            const keepAlive = setInterval(
                () =>
                    client.sendProgress(FindStdlibRequest.type, FindStdlibRequest.ProgressToken, 0),
                HEARTBEAT_PERIOD
            );
            const path = await Promise.resolve(this.selectStdlibPath()).finally(() =>
                clearInterval(keepAlive)
            );

            return path;
        });
    }

    /**
     * Register a custom command that expects an editor as argument. SysML
     * language client implementation should handle the construction of the
     * argument.
     * @param command Custom command identifier
     * @param execute function that sends request to execute {@link command}
     * @see {@link RegisterTextEditorCommandsRequest.Parameters}
     */
    protected abstract registerTextEditorCommand(
        command: string,
        execute: (editor: RegisterTextEditorCommandsRequest.Parameters) => Promise<unknown>
    ): void;

    /**
     * Select/find a standard library path
     * @return string value with path to the standard library or undefined if none selected or found
     */
    protected abstract selectStdlibPath(): MaybePromise<string | undefined>;

    /**
     * URL to a zip file of a compatible SysML v2 Release repo version
     */
    protected get stdlibRepoZipUrl(): string {
        //  TODO: download only a folder somehow (~35 times less data used)
        return "https://github.com/Systems-Modeling/SysML-v2-Release/archive/refs/tags/2023-02.zip";
    }

    /**
     * Path to where the standard library may be cached
     */
    protected get stdlibDir(): string {
        return path.join(cacheDir(), "sysml.library");
    }

    /**
     * Path to persistent config
     */
    protected get configPath(): string {
        return path.join(cacheDir(), ".config");
    }

    /**
     * Perform client initialization
     */
    private async initializeClient(): Promise<void> {
        let config = await this.loadConfig();

        if (config?.stdlibUrl !== this.stdlibRepoZipUrl) {
            await this.maybeUpdateDownloadedStdlib();
        }

        if (!config) config = this.config;
        else this.config = config;

        await this.onInitialize();
        await this.saveConfig(this.config);
    }

    /**
     * Load stored persistent config
     */
    protected abstract loadConfig(): MaybePromise<ClientConfig | undefined>;

    /**
     * Save persistent config
     * @param config
     */
    protected abstract saveConfig(config: ClientConfig): MaybePromise<void>;

    /**
     * Maybe update the previously downloaded standard library
     */
    protected abstract maybeUpdateDownloadedStdlib(): MaybePromise<void>;

    /**
     * Perform specific client initialization if needed
     */
    protected onInitialize(): MaybePromise<void> {
        /* empty */
    }
}

export interface ClientConfig {
    /**
     * Compatible standard library URL used the last time the client was run
     */
    stdlibUrl: string;
}
