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
import { LanguageClient } from "vscode-languageclient/browser";
import { SysMLVSCodeClientExtender } from "./vscode";
import { Extension, initialize, runExtensions } from "../common/extension";

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

async function startLanguageClient(context: vscode.ExtensionContext): Promise<typeof data> {
    const { extensions, serverModule, clientOptions } = await initialize(context, "browser");

    // Create the language client and start the client.
    const client = new LanguageClient(
        "sysml",
        "sysml",
        clientOptions,
        new Worker(serverModule.toString(true))
    );

    // Start the client. This will also launch the server
    await new SysMLVSCodeClientExtender(context).extend(client);
    await client.start();
    // commands registered in execute command handler seem to be automatically
    // registered with VSCode

    await runExtensions(extensions, "onStarted", context, client);
    return { client, extensions };
}
