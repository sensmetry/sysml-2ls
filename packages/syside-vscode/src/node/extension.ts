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

import * as vscode from "vscode";
import { LanguageClient, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { SysMLVSCodeClientExtender } from "./vscode";
import { Extension, initialize, runExtensions } from "../common/extension";
import { uriToFsPath } from "vscode-uri/lib/umd/uri";
import { SETTINGS_KEY } from "syside-languageserver";

let data: {
    client: LanguageClient;
    extensions: Extension[];
};

function migrateConfig(): void {
    const sysmlSection = vscode.workspace.getConfiguration("sysml");
    const sysideSection = vscode.workspace.getConfiguration("syside");
    const newSection = vscode.workspace.getConfiguration(SETTINGS_KEY);
    for (const section of [
        "trace.server",
        "standardLibrary",
        "standardLibraryPath",
        "logStatistics",
        "defaultBuildOptions.validationChecks",
        "defaultBuildOptions.ignoreMetamodelErrors",
        "debug.scopeInLinkingErrors",
        "debug.stacktraceInLinkingErrors",
        "debug.linkingTrace",
        "plugins",
        "client.extensions",
        "server.args.run",
        "server.args.debug",
        "server.path",
    ]) {
        for (const oldSection of [sysmlSection, sysideSection]) {
            const config = oldSection.inspect(section);
            if (!config) continue;

            for (const [value, target] of [
                [config.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder],
                [config.workspaceValue, vscode.ConfigurationTarget.Workspace],
                [config.globalValue, vscode.ConfigurationTarget.Global],
            ] as const) {
                if (value === undefined) continue;
                newSection.update(section, value, target);
                oldSection.update(section, undefined, target);
            }
        }
    }
}

// This function is called when the extension is activated.
export async function activate(context: vscode.ExtensionContext): Promise<LanguageClient> {
    migrateConfig();
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

async function startLanguageClient(context: vscode.ExtensionContext): Promise<typeof data> {
    const {
        config: serverConfig,
        extensions,
        serverModule: serverUri,
        clientOptions,
    } = await initialize(context, "node");

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
    const serverModule = uriToFsPath(serverUri, true);
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

    clientOptions.synchronize = {
        // Notify the server about file changes to files contained in the
        // workspace
        fileEvents: [sysmlWatcher, kermlWatcher],
    };

    // Create the language client and start the client.
    const client = new LanguageClient("syside", "SysIDE", serverOptions, clientOptions);

    // Start the client. This will also launch the server
    await new SysMLVSCodeClientExtender(context).extend(client);
    await client.start();
    // commands registered in execute command handler seem to be automatically
    // registered with VSCode

    await runExtensions(extensions, "onStarted", context, client);
    return { client, extensions };
}
