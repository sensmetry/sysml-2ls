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
import os from "os";

const PREFIXES = ["", "k", "M", "G", "T"];

/**
 * Format number of bytes to a string with units appended
 * @param bytes number of bytes, assuming integer
 * @param fractionDigits number of digits after the decimal point
 * @returns formatted string with units
 */
export function formatBytes(bytes: number, fractionDigits = 2): string {
    let prefix = 0;
    while (bytes >= 1024) {
        bytes /= 1024;
        prefix++;
    }

    if (prefix === 0) {
        // assume an integer number of bytes
        return `${bytes.toString()} B`;
    }

    return `${bytes.toFixed(fractionDigits)} ${PREFIXES[prefix]}B`;
}

/**
 * @returns temporary directory that can be used for downloads
 */
export function tmpdir(): string {
    return path.join(os.tmpdir(), "Sensmetry");
}

/**
 * @see {@link cacheDir}
 * @returns directory that can be used to for persistent caching
 */
export function cacheDir(): string {
    return path.join(os.homedir(), ".sysml-2ls");
}
