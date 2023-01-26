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

import { formatBytes } from "../download";

test.concurrent.each([
    [123, 2, "123 B"],
    [1_024, 2, "1.00 kB"],
    [1_024_100, 2, "1000.10 kB"],
    [1_024_100, 4, "1000.0977 kB"],
    [2_024_100, 3, "1.930 MB"],
    [2_542_024_100, 2, "2.37 GB"],
])("bytes are formatted correctly: %i", (bytes, digits, expected) => {
    expect(formatBytes(bytes, digits)).toEqual(expected);
});
