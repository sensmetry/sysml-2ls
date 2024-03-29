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

import util from "util";
import child_process from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const exec = util.promisify(child_process.exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, "..", "..", "..");

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const checkout = () =>
    exec("git checkout tags/2024-02", { cwd: path.join(root, "SysML-v2-Release") });

exec(
    "git clone --depth 1 https://github.com/Systems-Modeling/SysML-v2-Release.git",
    { cwd: root }
).then(checkout, checkout);
