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

/* eslint-disable @typescript-eslint/no-var-requires */
// Using a separate script so that we can pass command line arguments to `vsce`
// and still be able to run other commands after it

import util from "util";
import child_process from "child_process";
import process from "process";
import manifest from "../package.json" assert { type: "json"};

const exec = util.promisify(child_process.exec);

const args = process.argv.slice(2);
const packageIndex = args.findIndex((arg) => /-i|--packagePath/.test(arg));

if (packageIndex === -1) {
    const out = `${manifest.name}-${manifest.version}.vsix`;
    await exec(`pnpm run vscode:package -o ${out}`);
    args.push("--packagePath", out);
}

exec("pnpm vsce publish " + args.join(" "), { stdio: "inherit" });
