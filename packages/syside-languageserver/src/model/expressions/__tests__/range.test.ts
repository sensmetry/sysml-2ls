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

import { RangeGenerator } from "../range";

describe("Range generator tests", () => {
    test("length is calculated for valid ranges", async () => {
        expect(new RangeGenerator({ start: 0, stop: 5 }).length).toEqual(6);
    });

    test("length is 0 for invalid ranges", async () => {
        expect(new RangeGenerator({ start: 5, stop: 0 }).length).toEqual(0);
    });

    test("length is calculated for non-unit step sizes", async () => {
        expect(new RangeGenerator({ start: 0, stop: 5, step: 2 }).length).toEqual(3);
    });

    test("range can be converted to array", () => {
        expect(new RangeGenerator({ start: 0, stop: 3 }).toArray()).toStrictEqual([0, 1, 2, 3]);
    });

    test("range can be converted to array with non-unit step sizes", () => {
        expect(new RangeGenerator({ start: 0, stop: 6, step: 2 }).toArray()).toStrictEqual([
            0, 2, 4, 6,
        ]);
    });

    test("range can be indexed with `at`", () => {
        const r = new RangeGenerator({ start: 0, stop: 5, step: 2 });
        expect(r.at(2)).toEqual(4);
        expect(r.at(5)).toBeUndefined();
        expect(r.at(-1)).toEqual(4);
        expect(r.at(-5)).toBeUndefined();
    });

    test("some", () => {
        const r = new RangeGenerator({ start: 0, stop: 6, step: 2 });
        expect(r.some((v) => v === 2)).toBeTruthy();
        expect(r.some((v) => v === 3)).toBeFalsy();
    });

    test("every", () => {
        const r = new RangeGenerator({ start: 0, stop: 6, step: 2 });
        expect(r.every((v) => v === 2)).toBeFalsy();
        expect(r.every((v) => v !== 3)).toBeTruthy();
    });
});
