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

import { LanguageClientExtension } from "../api";

describe("Language client extension", () => {
    const keys = ["onBeforeStart", "onStarted", "onDeactivate"];

    it("should assert true for objects with all keys implemented", () => {
        expect(
            LanguageClientExtension.is(Object.fromEntries(keys.map((k) => [k, jest.fn()])))
        ).toBeTruthy();
    });

    it.each(keys)("should assert false for objects with '%s' missing", (key) => {
        expect(
            LanguageClientExtension.is(
                Object.fromEntries(keys.filter((k) => k !== key).map((k) => [k, jest.fn()]))
            )
        ).toBeFalsy();
    });
});
