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

import { ClientConfig, SysMLClientExtender } from "syside-languageclient";
import * as vscode from "vscode";
import { TextEditor } from "syside-protocol";
import { TextDocumentIdentifier } from "vscode-languageserver";
import fs from "fs-extra";
import path from "path";
import type CONFIG from "../package.json";
import fetch from "node-fetch";

type Options = keyof typeof CONFIG.contributes.configuration.properties;

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
        await config.update(<Options>"sysml.standardLibrary", false, target);
        await config.update(
            <Options>"sysml.defaultBuildOptions.ignoreMetamodelErrors",
            true,
            target
        );
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
        await vscode.workspace
            .getConfiguration()
            .update(<Options>"sysml.standardLibraryPath", dir, true);
        return dir;
    }

    /**
     * Download the stdlib from web
     */
    protected async downloadStdlibDir(): Promise<string | undefined> {
        const libPath = this.stdlibDir;
        return SysMLVSCodeClientExtender.downloadFiles(
            this.stdlibURL,
            this.stdlibFiles,
            this.stdlibDir,
            "Downloading SysML standard library"
        ).then(
            async () => {
                // and update the configuration
                await vscode.workspace
                    .getConfiguration()
                    .update(
                        <Options>"sysml.standardLibraryPath",
                        libPath,
                        vscode.ConfigurationTarget.Global
                    );
                vscode.window.showInformationMessage(
                    `The downloaded standard library can be found in ${libPath}`
                );
                return libPath;
            },
            async (reason) => {
                vscode.window.showInformationMessage(
                    `Failed to download standard library: ${reason}`
                );
                return undefined;
            }
        );
    }

    /**
     * Download `files` from a given {@link url} with progress shown in VS Code
     * @param url download URL
     * @param files files to download from `url`
     * @param destination download destination
     * @param title Notification title
     * @returns url if the file already exists, {@link DownloadInfo} if the file
     * was successfully downloaded and undefined otherwise
     */
    protected static async downloadFiles(
        url: string,
        files: readonly string[],
        destination: string,
        title: string
    ): Promise<void> {
        return vscode.window.withProgress(
            {
                title: title,
                location: vscode.ProgressLocation.Notification,
            },
            async (progress, _) => {
                let downloaded = 0;
                await Promise.all(
                    files.map(async (name) => {
                        const response = await fetch(path.join(url, name));
                        const dst = path.join(destination, name);
                        await fs.mkdirp(path.dirname(dst));
                        await fs.writeFile(dst, await response.text());
                        downloaded += 1;

                        progress.report({
                            message: `Downloaded ${downloaded}/${files.length}`,
                            increment: (downloaded / files.length) * 100,
                        });
                    })
                );
            }
        );
    }

    protected async loadConfig(): Promise<ClientConfig | undefined> {
        if (!(await fs.exists(this.configPath))) return;
        const contents = await fs.readFile(this.configPath, "utf-8");
        return JSON.parse(contents);
    }

    protected async saveConfig(config: ClientConfig): Promise<void> {
        const contents = JSON.stringify(config, undefined, 2);
        const out = this.configPath;
        const dir = path.dirname(out);
        if (!(await fs.exists(dir))) await fs.mkdir(dir, { recursive: true });

        return fs.writeFile(this.configPath, contents, "utf-8");
    }

    protected async maybeUpdateDownloadedStdlib(): Promise<void> {
        if (!(await fs.exists(this.stdlibDir))) {
            // nothing downloaded so nothing to update
            return;
        }

        const usedDir = await vscode.workspace
            .getConfiguration()
            .get(<Options>"sysml.standardLibraryPath");
        if (usedDir !== this.stdlibDir) {
            // not using the downloaded library, skip update
            return;
        }

        const answer = await vscode.window.showInformationMessage(
            "The compatible SysML v2 standard library has been updated, would you like to download it?",
            "Yes",
            "No"
        );

        if (answer === "Yes") {
            await this.downloadStdlibDir();
        }
    }
}
