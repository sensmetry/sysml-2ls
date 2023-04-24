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

import { Command, ParseOptions } from "commander";
import { Version } from "../version";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LauncherOptions {
    // TODO: options for some fields in SysMLConfig
}

export const DefaultLauncherOptions: Required<LauncherOptions> = {};

export interface ArgParser<O extends LauncherOptions = LauncherOptions> {
    command: Command;
    parse(argv?: readonly string[], options?: ParseOptions): O;
}

export function createArgParser<O extends LauncherOptions = LauncherOptions>(
    options: LauncherOptions = DefaultLauncherOptions
): ArgParser<O> {
    const command = new Command()
        .version(Version)
        .description("SysIDE")
        .showHelpAfterError(true)
        .name("Launch SysIDE");

    return {
        command,
        parse: (argv, opts): O => {
            command.parse(argv, opts);
            return { ...options, ...command.opts<O>() };
        },
    };
}
