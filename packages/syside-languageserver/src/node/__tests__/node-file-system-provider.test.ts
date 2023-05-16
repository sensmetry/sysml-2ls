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

import { URI, Utils } from "vscode-uri";
import { SysMLNodeFileSystem } from "../node-file-system-provider";

const fs = SysMLNodeFileSystem.fileSystemProvider();

describe.each([URI.file(__dirname), URI.file(__filename)])(
    "Node file system provider tests",
    (path) => {
        it(`${path} exists sync`, () => {
            expect(fs.existsSync(path)).toBeTruthy();
        });

        it(`${path} exists async`, async () => {
            expect(fs.exists(path)).resolves.toBeTruthy();
        });

        const bad = Utils.joinPath(path, ".Hello, world!");
        it(`${bad} does not exist sync`, () => {
            expect(fs.existsSync(bad)).toBeFalsy();
        });

        it(`${bad} does not exist async`, () => {
            expect(fs.exists(bad)).resolves.toBeFalsy();
        });
    }
);
