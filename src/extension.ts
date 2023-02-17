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
import { SysMLVSCodeClientExtender } from "./language-client/vscode";

let client: LanguageClient;

// This function is called when the extension is activated.
export async function activate(context: vscode.ExtensionContext): Promise<LanguageClient> {
    client = await startLanguageClient(context);
    return client;
}

// This function is called when the extension is deactivated.
export async function deactivate(): Promise<void> {
    if (client) {
        return client.stop();
    }
    return;
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    const serverModule = context.asAbsolutePath(path.join("out", "language-server", "main"));
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
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
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

    return client;
}
