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

import { NO_ERRORS, parseKerML } from "../../../testing";
import { TypeMeta } from "../type";

describe("Conformance", () => {
    test("types conform to supertype qualified names", async () => {
        const tree = await parseKerML("class A; class B :> A; class C :> B;");

        expect(tree).toMatchObject(NO_ERRORS);
        expect(
            (tree.value.namespaceMembers.at(-1)?.$meta.element() as TypeMeta).conforms("A")
        ).toBeTruthy();
    });

    test("types conform to supertype types", async () => {
        const tree = await parseKerML("class A; class B :> A; class C :> B;");

        expect(tree).toMatchObject(NO_ERRORS);
        const typeMembers = tree.value.namespaceMembers;
        expect(
            (typeMembers.at(-1)?.$meta.element() as TypeMeta).conforms(
                typeMembers.at(0)?.$meta.element() as TypeMeta
            )
        ).toBeTruthy();
    });

    test("types do not conform to arbitrary types", async () => {
        const tree = await parseKerML("class A; class B :> A; class C;");

        expect(tree).toMatchObject(NO_ERRORS);
        expect(
            (tree.value.namespaceMembers.at(-1)?.$meta.element() as TypeMeta).conforms("A")
        ).toBeFalsy();
    });

    test("firstConforming finds the first conforming type", async () => {
        const tree = await parseKerML("class A; class B :> A; class D; class C :> B;");

        expect(tree).toMatchObject(NO_ERRORS);
        expect(
            (tree.value.namespaceMembers.at(-1)?.$meta.element() as TypeMeta)
                .firstConforming(["D", "A"])
                ?.at(0)
        ).toEqual("A");
    });

    test("firstConforming returns undefined if no conforming types were found", async () => {
        const tree = await parseKerML("class A; class B :> A; class D; class E; class C :> B;");

        expect(tree).toMatchObject(NO_ERRORS);
        expect(
            (tree.value.namespaceMembers.at(-1)?.$meta.element() as TypeMeta).firstConforming([
                "D",
                "E",
            ])
        ).toBeUndefined();
    });
});
