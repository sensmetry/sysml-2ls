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

import { SysMLClientExtender } from "./sysml-language-client";
import * as vscode from "vscode";
import { TextEditor } from "../common/protocol-extensions";
import { TextDocumentIdentifier } from "vscode-languageserver-protocol";
import fs from "fs-extra";
import path from "path";
import {
    cacheDir,
    downloadFile,
    DownloadInfo,
    formatBytes,
    tmpdir,
    unzipFile,
} from "../common/download";

/**
 * SysML language client for VS Code.
 */
export class SysMLVSCodeClientExtender extends SysMLClientExtender {
    protected readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
    }

    protected registerTextEditorCommand(
        command: string,
        execute: (editor: TextEditor) => Promise<unknown>
    ): void {
        const disposable = vscode.commands.registerTextEditorCommand(command, (editor) =>
            execute({
                document: TextDocumentIdentifier.create(editor.document.uri.toString()),
                selection: editor.selection,
                selections: editor.selections,
            })
        );
        this.context.subscriptions.push(disposable);
    }

    protected async selectStdlibPath(): Promise<string | undefined> {
        const answer = await vscode.window.showInformationMessage(
            "The SysML v2 standard library was not found, would you like to download or locate it in the filesystem?",
            "Download",
            "Locate",
            "Disable in workspace",
            "Disable"
        );

        // closed/timed out without an answer, do nothing until the next startup
        if (!answer) return;

        if (answer === "Disable") {
            await this.disableStdlib(true);
            return;
        }

        if (answer === "Disable in workspace") {
            await this.disableStdlib(false);
            return;
        }

        if (answer === "Locate") {
            return this.findStdlibDir();
        }

        return this.downloadStdlibDir();
    }

    /**
     * Update VS Code configuration to disable standard library
     * @param globally if true, updates user configuration, otherwise workspace
     */
    protected async disableStdlib(globally: boolean): Promise<void> {
        const target = globally
            ? vscode.ConfigurationTarget.Global
            : vscode.ConfigurationTarget.Workspace;
        const config = vscode.workspace.getConfiguration();
        await config.update("sysml.standardLibrary", false, target);
        await config.update("sysml.defaultBuildOptions.ignoreMetamodelErrors", true, target);
    }

    /**
     * Find the path to an existing stdlib dir through VS Code file dialog
     */
    protected async findStdlibDir(): Promise<string | undefined> {
        const result = await vscode.window.showOpenDialog({
            // eslint-disable-next-line quotes
            openLabel: 'Select "sysml.library" directory',
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
        });

        if (!result || result.length === 0) return;
        const dir = result[0].fsPath;

        if (!(await fs.exists(dir))) return;
        await vscode.workspace.getConfiguration().update("sysml.standardLibraryPath", dir, true);
        return dir;
    }

    /**
     * Download the stdlib from web
     */
    protected async downloadStdlibDir(): Promise<string | undefined> {
        const tempDir = tmpdir();
        const zipFile = path.join(tempDir, `sysml-v2-release-${this.stdlibTag}.zip`);

        const info = await SysMLVSCodeClientExtender.downloadUrl(
            this.stdlibRepoZipUrl,
            zipFile,
            "Downloading SysML standard library"
        );

        if (!info) return;

        // store the extracted standard library in cache
        const cache = cacheDir();
        const libPath = path.join(cache, "sysml.library");

        // delete old directory if it exists to avoid any stale files
        await fs.remove(libPath);

        await unzipFile(zipFile, cache, (entry) => {
            // only unzip the library documents
            const suffix = /sysml\.library.*\.(?:kerml|sysml)/.exec(entry.fileName);
            if (!suffix) return;
            return suffix[0];
        }).then(async () => await fs.remove(zipFile));

        // and update the configuration
        await vscode.workspace
            .getConfiguration()
            .update("sysml.standardLibraryPath", libPath, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
            `The downloaded standard library can be found in ${libPath}`
        );
        return libPath;
    }

    /**
     * Download a file from a given {@link url} with progress shown in VS Code
     * @see {@link downloadFile}
     * @param url download URL
     * @param file download destination
     * @param title Notification title
     * @returns url if the file already exists, {@link DownloadInfo} if the file
     * was successfully downloaded and undefined otherwise
     */
    protected static async downloadUrl(
        url: string,
        file: string,
        title: string
    ): Promise<string | DownloadInfo | undefined> {
        // only download if the zip file doesn't exist
        if (await fs.exists(file)) return file;

        let downloadPromise: Promise<DownloadInfo> | undefined;
        vscode.window.withProgress(
            {
                title: title,
                location: vscode.ProgressLocation.Notification,
            },
            async (progress, _) => {
                let prevBytes = 0;
                downloadPromise = downloadFile(url, file, {
                    progress: (bytes, size) => {
                        if (Number.isNaN(size)) {
                            progress.report({
                                message: `Downloaded ${formatBytes(bytes)}`,
                            });
                        } else {
                            // increment is the change to the last call in percent
                            // so have to convert bytes to percent
                            const pct = ((bytes - prevBytes) / size) * 100;
                            prevBytes = bytes;
                            progress.report({ increment: pct });
                        }
                    },
                });
                await downloadPromise;
            }
        );

        return await downloadPromise;
    }
}
