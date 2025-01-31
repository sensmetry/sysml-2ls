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

import { ClientConfig, MaybePromise } from "syside-languageclient";
import { BaseSysMLVSCodeClientExtender } from "../common/vscode";

/**
 * SysML language client for browser VS Code.
 */
export class SysMLVSCodeClientExtender extends BaseSysMLVSCodeClientExtender {
    protected override selectStdlibPath(): MaybePromise<string | undefined> {
        // language server uses virtual FS so there is nothing to select here
        return this.stdlibURL;
    }
    protected override loadConfig(): MaybePromise<ClientConfig | undefined> {
        return this.config;
    }
    protected override saveConfig(): MaybePromise<void> {
        return;
    }
    protected override maybeUpdateDownloadedStdlib(): MaybePromise<void> {
        return;
    }
}
