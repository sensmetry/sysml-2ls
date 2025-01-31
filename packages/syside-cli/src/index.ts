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

import { Command, Option } from "commander";
import { Extensions, evalAction } from "./sysml-util";

export default function (): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require("../package.json").version);

    program
        .command("dump")
        .argument("<file>", `possible file extensions: ${Extensions.join(", ")}`)
        .option("-v, --validate", "Enable validation checks", false)
        .addOption(
            new Option("-l, --stdlib <standardLibrary>", "Set standard library type")
                .choices(["none", "standard", "local"])
                .default("standard")
        )
        .description("Dump AST as JSON to console")
        .action(evalAction);

    program.parse(process.argv);
}
