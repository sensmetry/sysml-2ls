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

import { URI, Utils } from "vscode-uri";
import { waitAllPromises } from "../../utils/common";
import { SysMLSharedServices } from "../services";
import { SysMLFileSystemProvider } from "./workspace/file-system-provider";

export class ExtensionManager {
    protected readonly services: SysMLSharedServices;
    protected readonly fileSystem: SysMLFileSystemProvider;

    constructor(services: SysMLSharedServices) {
        this.services = services;
        this.fileSystem = services.workspace.FileSystemProvider;
    }

    /**
     * Dynamically load additional JS plugins through `activate` function. All
     * JS scripts will be loaded from directory paths.
     * @param paths path or paths to plugins, either to directories or files
     */
    async loadScripts(paths: URI | URI[]): Promise<void> {
        if (!Array.isArray(paths)) paths = [paths];

        await waitAllPromises(
            paths.map((p) => this.loadFromPath(p)),
            (result, index) =>
                `Failed to load script path ${(paths as URI[])[index].fsPath}: ${result.reason}`
        );
    }

    /**
     * Load scripts from a single path (directory or file)
     * @see {@link loadScripts}
     * @param p path
     */
    protected async loadFromPath(p: URI): Promise<void> {
        const ext = Utils.extname(p);

        if (ext.length === 0) {
            // assume directory
            const scripts = await this.fileSystem
                .readDirectory(p)
                .then((nodes) =>
                    nodes.filter((node) => node.isFile && Utils.extname(node.uri) === ".js")
                );

            await waitAllPromises(scripts.map((node) => this.loadScript(node.uri)));
        } else if (ext === ".js") {
            await this.loadScript(p);
        }
    }

    /**
     * Load a script from a path, assuming it is a JS file
     * @param file path to the script
     */
    protected async loadScript(file: URI): Promise<void> {
        const module = await import(file.fsPath);

        let reason = "no 'activate' function found";
        if ("activate" in module) {
            if (module.activate instanceof Function) {
                await module.activate(this.services);
                console.log(`Plugin '${file.fsPath}' was activated.`);
                return;
            }

            reason = "'activate' is not a function";
        }

        console.log(`Could not load plugin at ${file.fsPath}: ${reason}`);
    }
}
