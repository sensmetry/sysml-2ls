#!/usr/bin/env node

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

/* eslint-disable @typescript-eslint/explicit-function-return-type */
import path from "path";
import fs from "fs";
import process from "process";

const Header = `
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

`.trimStart();

const IgnoredNames = new Set(["index.ts", "__tests__", "_internal.ts", "main.ts", ".DS_Store"]);

/**
 *
 * @param {string} p
 * @returns {Promise<void>}
 */
async function generateIndex(p) {
    /**
     * @type string[]
     */
    let modules = [];
    for (const dirent of fs.readdirSync(p, { withFileTypes: true })) {
        if (IgnoredNames.has(dirent.name)) continue;
        if (dirent.isDirectory()) {
            await generateIndex(path.join(p, dirent.name));
        }
        modules.push(dirent.name);
    }

    modules = modules.sort();

    fs.writeFileSync(
        path.join(p, "index.ts"),
        Header +
            modules.map((name) => `export * from "./${path.parse(name).name}";`).join("\n") +
            "\n",
        { flag: "w" }
    );
}

Promise.all(process.argv.slice(2).map((p) => generateIndex(path.resolve(p))));
