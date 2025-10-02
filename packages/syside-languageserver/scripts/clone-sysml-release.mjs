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

import util from "util";
import child_process from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const exec = util.promisify(child_process.exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, "..", "..", "..");
const dir = path.join(root, "SysML-v2-Release");

const branch = "release/2024-12";
const commit = "95c7f8349bb8b00d3530129f8b44e52539abde54";
// const tag = "2024-12";

if (existsSync(dir)) {
    await exec(`git config remote.origin.fetch "+${branch}:${commit}"`, { cwd: dir })
        .then(() => exec(`git fetch --depth=1 --update-head-ok`, { cwd: dir }))
        .then(() => exec(`git checkout ${commit}`, { cwd: dir }));
    // await exec(`git config remote.origin.fetch "+refs/tags/${tag}:refs/tags/${tag}"`, { cwd: dir })
    // .then(() => exec(`git fetch --depth=1`, { cwd: dir }))
    // .then(() => exec(`git checkout tags/${tag}`, { cwd: dir }));
} else {
    await exec(
        `git clone --depth 1 --branch ${branch} https://github.com/daumantas-kavolis-sensmetry/SysML-v2-Release.git`,
        // `git clone --depth 1 --branch ${tag} https://github.com/Systems-Modeling/SysML-v2-Release.git`,
        { cwd: root }
    ).then(() => exec(`git checkout ${commit}`, { cwd: dir }));
}

export const SYSMLRELEASE = dir;
