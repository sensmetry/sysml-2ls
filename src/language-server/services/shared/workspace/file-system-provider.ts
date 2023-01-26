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

/**
 * Extended {@link FileSystemProvider} that provides methods to check if path is valid
 */
export interface SysMLFileSystemProvider extends FileSystemProvider {
    /**
     * Checks if the given path exists asynchronously
     * @return promise that resolves to true if path exists and false otherwise
     */
    exists(path: string): Promise<boolean>;

    /**
     * Checks if the given path exists synchronously
     * @return true if path exists and false otherwise
     */
    existsSync(path: string): boolean;
}

export class SysMLEmptyFileSystemProvider
    extends EmptyFileSystemProvider
    implements SysMLFileSystemProvider
{
    async exists(path: string): Promise<boolean> {
        return false;
    }
    existsSync(path: string): boolean {
        return false;
    }
}

export const SysMLEmptyFileSystem = {
    fileSystemProvider: (): SysMLFileSystemProvider => new SysMLEmptyFileSystemProvider(),
};
