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

import { startLanguageServer } from "langium";
import type { Connection } from "vscode-languageserver";
import { createSysMLServices, SharedModuleContext } from "../sysml-module";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LauncherOptions {
    // TODO: options for some fields in SysMLConfig
}

export function startServer(
    connection: Connection,
    context: Omit<SharedModuleContext, "connection">,
    options: LauncherOptions
): ReturnType<typeof createSysMLServices> {
    // Inject the shared services and language-specific services
    const services = createSysMLServices({ connection, ...context }, options);

    // Start the language server with the shared services
    startLanguageServer(services.shared);

    return services;
}
