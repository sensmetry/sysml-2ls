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

import fs from "fs-extra";
import util from "util";
import child_process from "child_process";

const exec = util.promisify(child_process.exec);

exec("pnpm run esbuild")
    .then(() =>
        Promise.all(
            [
                ["../../LICENSE", "LICENSE"],
                ["../../CHANGELOG.md", "CHANGELOG.md"],
                ["README.md", ".README"],
            ].map(([src, dst]) => fs.copyFile(src, dst))
        )
    )
    .then(() => fs.copyFile("../../README.md", "README.md"))
    .then(() => fs.copy("../syside-languageserver/syntaxes", "syntaxes"));
