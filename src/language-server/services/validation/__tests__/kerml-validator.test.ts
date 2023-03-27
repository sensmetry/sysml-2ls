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

import { Diagnostic } from "vscode-languageserver";
import { parseKerML, TEST_BUILD_OPTIONS } from "../../../../testing";
import { SysMLBuildOptions } from "../../shared/workspace/document-builder";

const BUILD_OPTIONS: SysMLBuildOptions = { ...TEST_BUILD_OPTIONS, validationChecks: "all" };

export async function expectValidations(
    text: string,
    messages: unknown[],
    ignore?: (d: Diagnostic) => boolean
): Promise<void> {
    const result = await parseKerML(text, BUILD_OPTIONS);

    const diagnostics = result.diagnostics.filter(
        (d) =>
            !/metamodel|linking/.test(String(d.code ?? "")) && (ignore?.call(undefined, d) ?? true)
    );
    if (messages.length === 0) expect(diagnostics).toHaveLength(0);
    else expect(diagnostics).toMatchObject(messages.map((m) => ({ message: m })));
}

test.each(["subsets a;", "; subset b :> a;"])(
    "nonunique feature subsetting unique feature issues a diagnostic",
    async (suffix: string) => {
        return expectValidations(
            `
    feature a[*];
    feature b[*] nonunique ${suffix}`,
            [expect.stringMatching("must be unique")]
        );
    }
);

test("redefining features must have greater or equal lower multiplicity bound", async () => {
    return expectValidations(
        `class A {feature a[5..10]; }
    class B :> A {
        :>> a[0..2];
    }`,
        [expect.stringMatching("should be at least as large")]
    );
});

test("subsetting features must have lower or equal upper multiplicity bound", async () => {
    return expectValidations(
        `class A {feature a[5..10]; }
    class B :> A {
        feature c :> a[0..100];
    }`,
        [expect.stringMatching("should not be larger")]
    );
});

test("infinity bounds don't trigger upper bound validation", async () => {
    return expectValidations(
        `class A {feature a[*]; }
    class B :> A {
        feature c :> a[0..100];
    }`,
        []
    );
});

test("0..1 bounds don't trigger upper bound validation", async () => {
    return expectValidations(
        `class A {feature a[0..1]; }
    class B :> A {
        feature c :> a[1];
    }`,
        []
    );
});

describe("Duplicate member names", () => {
    test("duplicate names in the same scope issue a diagnostic", async () => {
        return expectValidations("class A; struct A;", [
            expect.stringMatching("Duplicate member"),
            expect.stringMatching("Duplicate member"),
        ]);
    });

    test("duplicate short names in the same scope issue a diagnostic", async () => {
        return expectValidations("class <A>; struct <A>;", [
            expect.stringMatching("Duplicate member"),
            expect.stringMatching("Duplicate member"),
        ]);
    });

    test("duplicate mixed names in the same scope issue a diagnostic", async () => {
        return expectValidations("class <A>; struct A;", [
            expect.stringMatching("Duplicate member"),
            expect.stringMatching("Duplicate member"),
        ]);
    });

    test.failing("duplicate inherited names issue a diagnostic", async () => {
        return expectValidations("class A { class B; } struct B :> A { struct B; }", [
            expect.stringMatching("must be unique"),
        ]);
    });
});

test("features chaining a chain of 1 feature produce a diagnostic", async () => {
    return expectValidations(
        `
    feature a;
    feature b chains a;`,
        [expect.stringMatching("2 or more features")]
    );
});

test.each(["unions", "intersects", "differences"])(
    "it is not allowable for a type to have just one of '%s' relationship",
    async (token: string) => {
        return expectValidations(`class A; class B ${token} A;`, [
            expect.stringMatching(/A single \w+ relationship is not allowed/),
        ]);
    }
);

test("multiple return parameters trigger a diagnostic", async () => {
    expectValidations("function F { return a : F; return b : F; }", [
        expect.stringMatching(/At most one \w+ is allowed/i),
        expect.stringMatching(/At most one \w+ is allowed/i),
    ]);
});

describe("Index expressions", () => {
    test("square brackets trigger validation", async () => {
        return expectValidations("feature a = 1 [0];", [
            expect.stringMatching("Invalid index expression"),
        ]);
    });
});
