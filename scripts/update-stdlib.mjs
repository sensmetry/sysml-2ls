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

import assert from "assert";
import fs from "fs-extra";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

/**
 * Tags of https://github.com/Systems-Modeling/SysML-v2-Release that we support
 * in chronological order. Last tag is the one we currently support. Update this
 * by appending a new tag to the array.
 */
const SUPPORTED_TAGS = ["2022-12", "2023-02", "2023-07.1", "2023-08", "2024-02", "2024-07", "2024-09", "2024-11"];

const CURRENT_TAG = SUPPORTED_TAGS.at(-1);
const PREVIOUS_TAG = SUPPORTED_TAGS.at(-2);

assert(PREVIOUS_TAG);

/**
 * Replaces `PREVIOUS_TAG` with `CURRENT_TAG` in file at `path`
 * @param {string} path
 */
async function updateFile(path) {
    let contents = await fs.readFile(path, "utf-8");

    // if the file has already been updated, ignore it
    if (new RegExp(CURRENT_TAG).test(contents)) {
        return;
    }
    contents = contents.replaceAll(new RegExp(PREVIOUS_TAG, "g"), CURRENT_TAG);
    const before_last = SUPPORTED_TAGS.at(-3);
    if (before_last) {
        // replacing one more previous tag, i.e. repo clone script which shallow
        // excludes a tag for faster checkouts
        contents = contents.replaceAll(new RegExp(before_last, "g"), PREVIOUS_TAG);
    }
    await fs.writeFile(path, contents, "utf-8");
}

async function collectStblibUrls() {
    const root = "SysML-v2-Release/sysml.library";
    let stack = ["."];
    /** @type { string[] } */
    let files = [];

    while (stack.length > 0) {
        const dir = stack.pop();
        /** @type { fs.Dirent[]} */
        const contents = await fs.readdir(path.join(root, dir), {
            withFileTypes: true,
        });
        contents.forEach((dirent) => {
            const filename = path.join(dir, dirent.name);
            if (dirent.isFile()) {
                if ([".kerml", ".sysml"].includes(path.extname(dirent.name))) files.push(filename);
            } else {
                stack.push(filename);
            }
        });
    }

    return files;
}

async function generateStdlibUrls() {
    const urls = await collectStblibUrls();
    const contents = `/********************************************************************************
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

export const STDLIB = {
    version: "${CURRENT_TAG}",
    tree: "https://github.com/Systems-Modeling/SysML-v2-Release/blob/${CURRENT_TAG}/sysml.library/",
    raw: "https://raw.githubusercontent.com/Systems-Modeling/SysML-v2-Release/${CURRENT_TAG}/sysml.library/",
    files: [
        ${urls.map((name) => `"${name}",`).join("\n" + " ".repeat(8))}
    ],
} as const;
`;

    await fs.writeFile("packages/syside-base/src/stdlib.ts", contents, "utf-8");
}

async function main() {
    await Promise.all([
        updateFile("README.md"),
        updateFile("packages/syside-languageserver/scripts/clone-sysml-release.mjs")
            .then(() => {
                // import the script to execute it, checking out the SysML v2
                // release repo in the process
                return import("../packages/syside-languageserver/scripts/clone-sysml-release.mjs");
            })
            .then(() => generateStdlibUrls()),
        updateFile("packages/syside-languageclient/src/sysml-language-client.ts"),
    ]);
}

if (fileURLToPath(import.meta.url) === (await fs.promises.realpath(process.argv[1]))) {
    main();
}
