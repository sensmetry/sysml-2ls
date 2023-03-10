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

import path from "path";
import fs from "fs";

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

const IgnoredNames = new Set(["index.ts", "__tests__", "_internal.ts"]);

async function generateIndex(p: string): Promise<void> {
    let modules: string[] = [];
    for (const dirent of fs.readdirSync(p, { withFileTypes: true })) {
        if (IgnoredNames.has(dirent.name)) continue;
        if (dirent.isDirectory()) {
            generateIndex(path.join(p, dirent.name));
        }
        modules.push(dirent.name);
    }

    modules = modules.sort();

    fs.writeFileSync(
        path.join(p, "index.ts"),
        Header +
            modules.map((name) => `export * from "./${path.basename(name, ".ts")}";`).join("\n"),
        { flag: "w" }
    );
}

let root = __dirname;
while (root && !fs.existsSync(path.join(root, "src"))) {
    root = path.join(root, "..");
}

generateIndex(path.join(root, "src", "language-server", "model"));
generateIndex(path.join(root, "src", "testing"));
