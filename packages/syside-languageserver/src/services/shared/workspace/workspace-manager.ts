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

import { AstNode, DefaultWorkspaceManager, LangiumDocument, OperationCancelled } from "langium";
import {
    CancellationToken,
    Connection,
    MessageType,
    ShowMessageRequest,
    WorkspaceFolder,
} from "vscode-languageserver";
import { URI, Utils } from "vscode-uri";
import { SysMLSharedServices } from "../../services";
import { SysMLConfigurationProvider } from "./configuration-provider";
import { FindStdlibRequest } from "syside-protocol";
import now from "performance-now";
import { SysMLFileSystemProvider } from "./file-system-provider";
import { ExtensionManager } from "../extension-manager";
import path from "path";
import { isUriLike, pathToURI } from "syside-base";

/**
 * Extension of Langium workspace manager that loads the standard library on
 * initialization
 */
export class SysMLWorkspaceManager extends DefaultWorkspaceManager {
    protected readonly config: SysMLConfigurationProvider;
    protected readonly connection?: Connection;
    protected override readonly fileSystemProvider: SysMLFileSystemProvider;
    protected readonly extensions: ExtensionManager;

    constructor(services: SysMLSharedServices) {
        super(services);

        this.fileSystemProvider = services.workspace.FileSystemProvider;
        this.config = services.workspace.ConfigurationProvider;
        this.connection = services.lsp.Connection;
        this.extensions = services.ExtensionManager;
    }

    override async initializeWorkspace(
        folders: WorkspaceFolder[],
        cancelToken?: CancellationToken | undefined
    ): Promise<void> {
        await this.config.firstTimeSetup();
        const config = this.config.get();
        if (config.skipWorkspaceInit) {
            return;
        }

        await this.loadPlugins(folders);
        await super.initializeWorkspace(folders, cancelToken);
    }

    /**
     * Load declared .js plugins
     * @param folders workspace folders used to resolve relative paths
     */
    protected async loadPlugins(folders: WorkspaceFolder[]): Promise<void> {
        const plugins = this.config.get().plugins;
        const promises = folders.map((folder) => {
            const uri = URI.parse(folder.uri);
            this.extensions.loadScripts(
                plugins.map((plugin) => {
                    if (isUriLike(plugin)) return URI.parse(plugin);
                    if (path.isAbsolute(plugin)) return URI.file(plugin);
                    return Utils.joinPath(uri, plugin);
                })
            );
        });

        await Promise.allSettled(promises);
    }

    protected override async loadAdditionalDocuments(
        folders: WorkspaceFolder[],
        collector: (document: LangiumDocument<AstNode>) => void
    ): Promise<void> {
        const config = this.config.get();
        if (!config.standardLibrary) return;

        let dir = this.fileSystemProvider.standardLibrary;
        if (!dir || !this.fileSystemProvider.existsSync(dir)) {
            if (dir) {
                // path is set but it doesn't exist, maybe a user error?
                this.connection?.sendRequest(ShowMessageRequest.type, {
                    type: MessageType.Error,
                    message: `Standard library path '${dir ? dir : ""}' does not exist`,
                });
                return;
            }

            // no path set so request client to find one
            const result = await this.requestClientStdlibDir();
            if (!result) return;
            dir = pathToURI(result);
        }

        const content = await this.fileSystemProvider.readDirectory(dir);

        const collected: URI[] = [];
        const fileExtensions = this.serviceRegistry.all.flatMap(
            (e) => e.LanguageMetaData.fileExtensions
        );
        for (const node of content) {
            if (!this.includeEntry(folders[0], node, fileExtensions)) continue;

            if (node.isFile) {
                collected.push(node.uri);
            } else {
                content.push(...(await this.fileSystemProvider.readDirectory(node.uri)));
            }
        }

        // Preload all documents on the web asynchronously since
        // `getOrCreatedDocument` would otherwise fail as it uses sync overload.
        // Async here has great performance benefits as we are actually fetching
        // documents from another site and browsers can easily parallelize it.
        await this.fileSystemProvider.preloadFiles(collected);
        collected.forEach((uri) => collector(this.langiumDocuments.getOrCreateDocument(uri)));

        console.log(
            `Collected standard library:\n${JSON.stringify(
                collected.map((uri) => uri.toString()),
                undefined,
                2
            )}`
        );

        return;
    }

    /**
     * Request client to find the path to the standard library
     * @returns a promise that resolves to the standard library path if found or undefined
     */
    protected async requestClientStdlibDir(): Promise<string | undefined> {
        // no connection, nothing to wait on
        if (!this.connection) return;

        // install progress handler to keep delaying timeout on alive clients
        let end = now() + 5000;
        const disposable = this.connection?.onProgress(
            FindStdlibRequest.type,
            FindStdlibRequest.ProgressToken,
            () => {
                end = now() + 5000;
            }
        );

        let resolved = false;
        const findRequest = this.connection.sendRequest(FindStdlibRequest.type);
        const timeout = new Promise<void>((resolve, reject) => {
            const check = (): void => {
                if (resolved) resolve();
                else if (now() > end) reject(OperationCancelled);
                else setTimeout(check, 1000);
            };
            check();
        });

        // race until request completes or it times out, we don't want to stay
        // alive forever if something has happened to the client anyway
        const result = await Promise.race([findRequest, timeout]).finally(() => {
            // remove progress handler
            disposable.dispose();
            resolved = true;
        });

        if (typeof result !== "string") return;
        return result;
    }
}
