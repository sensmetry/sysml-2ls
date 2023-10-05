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

/* eslint-disable unused-imports/no-unused-vars */

import { EmptyFileSystemProvider, FileSystemProvider } from "langium";
import { URI } from "vscode-uri";

/**
 * Extended {@link FileSystemProvider} that provides methods to check if path is valid
 */
export interface SysMLFileSystemProvider extends FileSystemProvider {
    get standardLibrary(): URI | undefined;
    updateStandardLibrary(value: string | undefined): void;
    get extensionDir(): URI | undefined;

    /**
     * Checks if the given path exists asynchronously
     * @return promise that resolves to true if path exists and false otherwise
     */
    exists(path: URI): Promise<boolean>;

    /**
     * Checks if the given path exists synchronously
     * @return true if path exists and false otherwise
     */
    existsSync(path: URI): boolean;

    loadScript(path: URI): Promise<object | undefined>;
    preloadFiles(paths: readonly URI[]): Promise<void>;
}

export class SysMLEmptyFileSystemProvider
    extends EmptyFileSystemProvider
    implements SysMLFileSystemProvider
{
    get standardLibrary(): URI | undefined {
        return;
    }
    updateStandardLibrary(value: string | undefined): void {
        return;
    }
    get extensionDir(): URI | undefined {
        return;
    }

    async exists(path: URI): Promise<boolean> {
        return false;
    }
    existsSync(path: URI): boolean {
        return false;
    }
    loadScript(path: URI): Promise<object | undefined> {
        throw new Error("Method not implemented.");
    }
    async preloadFiles(paths: readonly URI[]): Promise<void> {
        return;
    }
}

export const SysMLEmptyFileSystem = {
    fileSystemProvider: (): SysMLFileSystemProvider => new SysMLEmptyFileSystemProvider(),
};
