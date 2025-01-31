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
import { LanguageClientExtension, ServerConfig } from "syside-languageclient";
import { Utils, URI } from "vscode-uri";
import path from "path";
import { LanguageClientOptions } from "vscode-languageclient";
import { isUriLike } from "syside-base";
import { NonNullable, SETTINGS_KEY } from "syside-languageserver";

type ClientExtension = LanguageClientExtension<vscode.ExtensionContext>;
export type Extension = {
    id: string;
    api: ClientExtension;
};

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
            .filter(NonNullable)
    );
}

export async function runExtensions<K extends keyof ClientExtension>(
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

export interface ClientConfig {
    /**
     * VS Code extensions that extend the language client
     * @default []
     * @items.description VS Code extension identifier
     */
    extensions: string[];
}

export async function initialize(
    context: vscode.ExtensionContext,
    root: string
): Promise<{
    config: ServerConfig;
    extensions: Extension[];
    serverModule: vscode.Uri;
    clientOptions: LanguageClientOptions;
}> {
    const config = vscode.workspace.getConfiguration(SETTINGS_KEY);
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

    let serverModule: vscode.Uri;
    if (serverConfig.path) {
        if (path.isAbsolute(serverConfig.path)) {
            serverModule = vscode.Uri.file(serverConfig.path);
        } else if (isUriLike(serverConfig.path)) {
            serverModule = vscode.Uri.parse(serverConfig.path);
        } else {
            serverModule = vscode.workspace.workspaceFolders?.at(0)
                ? Utils.resolvePath(
                      vscode.workspace.workspaceFolders.at(0)?.uri as URI,
                      serverConfig.path
                  )
                : vscode.Uri.file(path.resolve(serverConfig.path));
        }

        console.info(
            `Running custom SysIDE at ${serverModule} with ${JSON.stringify(
                serverConfig.args,
                null,
                4
            )}`
        );
    } else {
        serverModule = vscode.Uri.joinPath(
            context.extensionUri,
            `dist/${root}/language-server/main.js`
        );
    }

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Use sysml by default, no scheme to work on the web and untitled
        // files. KerML requires pattern to not accidentally parse KerML files
        // as SysML for untitled files. Blame langium for using extension to
        // infer language when TextDocument already has it...
        documentSelector: [{ language: "sysml" }, { language: "kerml", scheme: "file" }],
        synchronize: {},
    };

    return { config: serverConfig, extensions, serverModule, clientOptions };
}
