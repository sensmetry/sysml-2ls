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

import { FileSystemNode } from "langium";
import { SysMLFileSystemProvider } from "../services/shared/workspace/file-system-provider";
import { URI } from "vscode-uri";
import { STDLIB } from "syside-base";
import fetch from "node-fetch";

export class VirtualFileSystemProvider implements SysMLFileSystemProvider {
    readonly standardLibrary = URI.parse(STDLIB.raw);
    readonly files = new Set(STDLIB.files.map((file) => URI.parse(STDLIB.raw + file).toString()));
    protected readonly cachedContents = new Map<string, string>();

    updateStandardLibrary(): void {
        return;
    }
    get extensionDir(): undefined {
        return;
    }

    async exists(path: URI): Promise<boolean> {
        return this.existsSync(path);
    }

    existsSync(path: URI): boolean {
        const uri = path.toString();
        return uri === this.standardLibrary.toString() || this.files.has(uri);
    }

    async readFile(path: URI): Promise<string> {
        const uri = path.toString();
        let file = this.cachedContents.get(uri);
        if (!file) {
            if (!this.existsSync(path)) {
                throw new Error(`No such file: ${uri}`);
            }
            const text = await fetch(uri).then((response) => response.text());
            this.cachedContents.set(uri, text);
            file = text;
        }
        return file;
    }

    readFileSync(uri: URI): string {
        const file = this.cachedContents.get(uri.toString());
        if (!file) throw new Error(`No such file: ${uri.toString()}`);
        return file;
    }

    async readDirectory(uri: URI): Promise<FileSystemNode[]> {
        if (uri.toString() === this.standardLibrary.toString()) {
            return [...this.files].map(
                (file) =>
                    <FileSystemNode>{
                        isDirectory: false,
                        isFile: true,
                        uri: URI.parse(file),
                    }
            );
        } else {
            return [];
        }
    }

    async loadScript(): Promise<undefined> {
        console.warn("Dynamic scripts are not supported on the Web");
    }

    async preloadFiles(paths: readonly URI[]): Promise<void> {
        await Promise.all(paths.map((p) => this.readFile(p)));
    }
}

export const VirtualFileSystem = {
    fileSystemProvider: (): SysMLFileSystemProvider => new VirtualFileSystemProvider(),
};
