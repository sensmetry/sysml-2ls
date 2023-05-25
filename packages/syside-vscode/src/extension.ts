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

import * as vscode from "vscode";
import * as path from "path";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";
import { SysMLVSCodeClientExtender } from "./vscode";
import { URI, Utils } from "vscode-uri";
import { uriToFsPath } from "vscode-uri/lib/umd/uri";
import { LanguageClientExtension, ServerConfig } from "syside-languageclient";

type ClientExtension = LanguageClientExtension<vscode.ExtensionContext>;
type Extension = {
    id: string;
    api: ClientExtension;
};

let data: {
    client: LanguageClient;
    extensions: Extension[];
};

// This function is called when the extension is activated.
export async function activate(context: vscode.ExtensionContext): Promise<LanguageClient> {
    data = await startLanguageClient(context);
    return data.client;
}

// This function is called when the extension is deactivated.
export async function deactivate(): Promise<void> {
    if (data) {
        await runExtensions(data.extensions, "onDeactivate", data.client);
        return data.client.stop();
    }
    return;
}

interface ClientConfig {
    extensions: string[];
}

async function collectExtensions(ids: string[]): Promise<Extension[]> {
    return Promise.allSettled(
        ids.map(async (id) => {
            const extension = vscode.extensions.getExtension(id);
            if (!extension) {
                // not showing a message here since this would also be shown for
                // uninstalled extensions
                console.error(`No extension '${id}' found.`);
                return;
            }

            if (!extension.isActive) await extension.activate();

            const exported = extension.exports;
            if (!LanguageClientExtension.is(exported)) {
                vscode.window.showErrorMessage(`Extension '${id}' is invalid - bad exported type`);
                return;
            }

            return <Extension>{ id, api: exported };
        })
    ).then((results) =>
        results
            .map((result, index) => {
                if (result.status === "fulfilled") return result.value;

                vscode.window.showErrorMessage(
                    `Extension ${ids[index]} failed to activate: ${result.reason}`
                );
                return;
            })
            .filter((value): value is Extension => value !== undefined)
    );
}

async function runExtensions<K extends keyof ClientExtension>(
    extensions: Extension[],
    method: K,
    ...args: Parameters<ClientExtension[K]>
): Promise<void> {
    return Promise.allSettled(
        extensions.map(({ api }) => {
            api[method].call(
                api,
                // @ts-expect-error types checked in the signature
                ...args
            );
        })
    ).then((results) =>
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                vscode.window.showErrorMessage(
                    `Error in ${extensions[index].id}.${method}: ${result.reason}`
                );
            }
        })
    );
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<typeof data> {
    const config = vscode.workspace.getConfiguration("sysml");
    const clientConfig: Partial<ClientConfig> = config.client;
    const extensions = await collectExtensions(clientConfig.extensions ?? []);

    // vscode config returns readonly proxy objects, convert to a JS object
    // instead
    const serverConfigProxy: Partial<ServerConfig> = config.server;
    const releaseArgs = serverConfigProxy.args?.run ?? [];
    const debugArgs = serverConfigProxy.args?.debug ?? releaseArgs;
    const serverConfig: ServerConfig = {
        args: {
            run: releaseArgs,
            debug: debugArgs,
        },
        path: serverConfigProxy.path ?? undefined,
    };
    await runExtensions(extensions, "onBeforeStart", context, serverConfig);

    let serverModule: string;
    if (serverConfig.path) {
        if (path.isAbsolute(serverConfig.path)) {
            serverModule = serverConfig.path;
        } else {
            serverModule = vscode.workspace.workspaceFolders?.at(0)
                ? uriToFsPath(
                      Utils.resolvePath(
                          vscode.workspace.workspaceFolders.at(0)?.uri as URI,
                          serverConfig.path
                      ),
                      true
                  )
                : path.resolve(serverConfig.path);
        }

        console.info(
            `Running custom SysIDE at ${serverModule} with ${JSON.stringify(
                serverConfig.args,
                null,
                4
            )}`
        );
    } else {
        serverModule = context.asAbsolutePath(path.join("out", "language-server", "main"));
    }

    // The debug options for the server --inspect=6009: runs the server in
    // Node's Inspector mode so VS Code can attach to the server for debugging.
    // By setting `process.env.DEBUG_BREAK` to a truthy value, the language
    // server will wait until a debugger is attached.
    const debugOptions = {
        execArgv: [
            "--nolazy",
            `--inspect${process.env.DEBUG_BREAK ? "-brk" : ""}=${
                process.env.DEBUG_SOCKET || "6009"
            }`,
        ],
    };

    // If the extension is launched in debug mode then the debug server options
    // are used Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
            args: serverConfig.args.run.map(String),
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
            args: serverConfig.args.debug.map(String),
        },
    };

    const sysmlWatcher = vscode.workspace.createFileSystemWatcher("**/*.sysml");
    const kermlWatcher = vscode.workspace.createFileSystemWatcher("**/*.kerml");
    context.subscriptions.push(kermlWatcher, sysmlWatcher);

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: "file", language: "sysml" },
            { scheme: "file", language: "kerml" },
        ],
        synchronize: {
            // Notify the server about file changes to files contained in the
            // workspace
            fileEvents: [sysmlWatcher, kermlWatcher],
        },
    };

    // Create the language client and start the client.
    const client = new LanguageClient("sysml", "sysml", serverOptions, clientOptions);

    // Start the client. This will also launch the server
    await new SysMLVSCodeClientExtender(context).extend(client);
    await client.start();
    // commands registered in execute command handler seem to be automatically
    // registered with VSCode

    await runExtensions(extensions, "onStarted", context, client);
    return { client, extensions };
}
