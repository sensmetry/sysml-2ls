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

import { createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { createSysMLServices } from "../sysml-module";
import { createTransport, NodeLauncherOptions } from "./cli";
import { SysMLNodeFileSystem } from "./node-file-system-provider";
import { startServer as _startServer } from "../launch";

export function startServer(options: NodeLauncherOptions): ReturnType<typeof createSysMLServices> {
    const [input, output] = createTransport(options);

    // type inference breaks down for related tuple elements
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = createConnection(ProposedFeatures.all, input as any, output as any);

    return _startServer(connection, SysMLNodeFileSystem, options);
}
