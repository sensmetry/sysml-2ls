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

import { anything } from "../../../../testing";

test.each(["subsets a;", "; subset b :> a;"])(
    "nonunique feature subsetting unique feature issues a diagnostic",
    async (suffix: string) => {
        return expect(`
    feature a[*];
    feature b[*] nonunique ${suffix}`).toParseKerML({}, { diagnostics: anything(1) });
    }
);

test("redefining features must have greater or equal lower multiplicity bound", async () => {
    return expect(`class A {feature a[5..10]; }
    class B :> A {
        :>> a[0..2];
    }`).toParseKerML({}, { diagnostics: anything(1) });
});

test("subsetting features must have lower or equal upper multiplicity bound", async () => {
    return expect(`class A {feature a[5..10]; }
    class B :> A {
        feature c :> a[0..100];
    }`).toParseKerML({}, { diagnostics: anything(1) });
});

test("infinity bounds don't trigger upper bound validation", async () => {
    return expect(`class A {feature a[*]; }
    class B :> A {
        feature c :> a[0..100];
    }`).toParseKerML({});
});

test("0..1 bounds don't trigger upper bound validation", async () => {
    return expect(`class A {feature a[0..1]; }
    class B :> A {
        feature c :> a[1];
    }`).toParseKerML({});
});

describe("Duplicate member names", () => {
    test("duplicate names in the same scope issue a diagnostic", async () => {
        return expect("class A; struct A;").toParseKerML({}, { diagnostics: anything(2) });
    });

    test("duplicate short names in the same scope issue a diagnostic", async () => {
        return expect("class <A>; struct <A>;").toParseKerML({}, { diagnostics: anything(2) });
    });

    test("duplicate mixed names in the same scope issue a diagnostic", async () => {
        return expect("class <A>; struct A;").toParseKerML({}, { diagnostics: anything(2) });
    });

    test.failing("duplicate inherited names issue a diagnostic", async () => {
        return expect("class A { class B; } struct B :> A { struct B; }").toParseKerML(
            {},
            { diagnostics: anything(2) }
        );
    });
});
