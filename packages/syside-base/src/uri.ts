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
import { URI } from "vscode-uri";

export function isUriLike(path: string): boolean {
    // Using a + on the second group since one letter is most likely a windows
    // path, drives are A-Z but may be passed as lowercase since Windows FS is
    // case insensitive.
    return /^[a-zA-Z][a-zA-Z\d+.-]+:/.test(path);
}

export function pathToURI(path: string): URI {
    if (isUriLike(path)) return URI.parse(path);
    return URI.file(path);
}

export function resolvePathURI(p: string): URI {
    if (isUriLike(p)) return URI.parse(p);
    return URI.file(path.resolve(p));
}
