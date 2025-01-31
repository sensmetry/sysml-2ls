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

// Using a separate script so that we can pass command line arguments to `vsce`
// and still be able to run other commands after it

import util from "util";
import child_process from "child_process";
import fs from "fs-extra";
import process from "process";
import path from "path";
import { SYSMLRELEASE } from "../../syside-languageserver/scripts/clone-sysml-release.mjs";

const exec = util.promisify(child_process.exec);

fs.removeSync("sysml.library")
fs.mkdirp("sysml.library");

fs.copy(
    path.join(SYSMLRELEASE, "LICENSE"),
    path.join("sysml.library", "LICENSE.LGPLv3"),
);

fs.copy(
    path.join(SYSMLRELEASE, "LICENSE-GPL"),
    path.join("sysml.library", "LICENSE.GPLv3"),
);

fs.copy(
    path.join(SYSMLRELEASE, "sysml.library"),
    "sysml.library",
    {filter: (src, _) => {
        return !src.split("/").pop().startsWith(".");
    }}
);

exec("pnpm vsce package " + process.argv.slice(2).join(" "))
    .then(() => fs.copyFile(".README", "README.md"))
    .finally(() => fs.unlink(".README"));
