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

import { sanitizeName, unsanitizeName } from "../naming";

const EscapeChars = [
    ["\\b", "\b"],
    ["\\t", "\t"],
    ["\\n", "\n"],
    ["\\f", "\f"],
    ["\\r", "\r"],
    ["\\'", "'"],
    ["\\\\", "\\"],
    // eslint-disable-next-line quotes
    ['\\"', '"'],
] as const;

describe("names", () => {
    it.each(EscapeChars)("should unescape %s", (literal, unescaped) => {
        expect(sanitizeName(`'unrestricted ${literal} name'`)).toEqual(
            `unrestricted ${unescaped} name`
        );
    });

    // ignore double quotes since they can are valid even without escaping
    it.each(EscapeChars.slice(0, -1))("should escape %s", (literal, unescaped) => {
        expect(unsanitizeName(`unrestricted${unescaped} name`)).toEqual(
            `'unrestricted${literal} name'`
        );
    });
});
