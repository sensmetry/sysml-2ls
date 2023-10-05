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

import {
    BrowserMessageReader,
    BrowserMessageWriter,
    createConnection,
} from "vscode-languageserver/browser";
import { createSysMLServices } from "../sysml-module";
import { VirtualFileSystem } from "./virtual-file-system-provider";
import { startServer as _startServer } from "../launch";

declare const self: DedicatedWorkerGlobalScope;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BrowserLaunchOptions {
    // empty
}

export function startServer(options: BrowserLaunchOptions): ReturnType<typeof createSysMLServices> {
    /* browser specific setup code */
    const input = new BrowserMessageReader(self);
    const output = new BrowserMessageWriter(self);

    const connection = createConnection(input, output);

    return _startServer(connection, VirtualFileSystem, options);
}
