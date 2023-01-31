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

import { Type } from "langium/lib/grammar/generated/ast";
import { qualifiedTypeReference } from "../../../../testing";
import { Class, DataType, Package, Feature } from "../../../generated/ast";

test("namespaces are parseable", async () => {
    return expect(`namespace <'1.1'> N1; // This is an empty namespace.
    namespace <'1.2'> N2 {
    doc /* This is an example of a namespace body. */
    class C;
    datatype D;
    feature f : C;
    namespace N3; // This is a nested namespace.
    }`).toParseKerML({
        elements: [
            { declaredName: "N1", declaredShortName: "'1.1'" },
            {
                declaredName: "N2",
                declaredShortName: "'1.2'",
                docs: [{ body: "/* This is an example of a namespace body. */" }],
                elements: [{ declaredName: "C" }, { declaredName: "D" }, { declaredName: "N3" }],
                features: [{ declaredName: "f", typedBy: [qualifiedTypeReference("N2::C")] }],
            },
        ],
    });
});

test("namespace elements can have visibility", async () => {
    return expect(`namespace N {
        public class C;
        private datatype D;
        protected feature f : C;
    }`).toParseKerML({
        elements: [
            {
                declaredName: "N",
                elements: [
                    { declaredName: "C", visibility: "public" },
                    { declaredName: "D", visibility: "private" },
                ],
                features: [
                    {
                        declaredName: "f",
                        visibility: "protected",
                        typedBy: [qualifiedTypeReference("N::C")],
                    },
                ],
            },
        ],
    });
});

test("aliases are parseable", async () => {
    return expect(`namespace N1 {
        class A;
        class B;
        alias <C> CCC for B {
            doc /* alias doc */
        }
        private alias D for B;
    }`).toParseKerML({
        elements: [
            {
                declaredName: "N1",
                elements: [{ declaredName: "A" }, { declaredName: "B" }],
                aliases: [
                    {
                        declaredName: "CCC",
                        declaredShortName: "C",
                        for: qualifiedTypeReference("N1::B"),
                        docs: [{ body: "/* alias doc */" }],
                    },
                    {
                        declaredName: "D",
                        for: qualifiedTypeReference("N1::B"),
                        visibility: "private",
                    },
                ],
            },
        ],
    });
});

test("namespaces can have comments", async () => {
    return expect(`namespace N9 {
    class A;
    comment Comment1 about A
        /* comment about A */
    comment Comment2
        /* comment about N9 */
    /* also comment about N9 */
    doc N9_Doc
        /* doc about N9 */
    }`).toParseKerML({
        elements: [
            {
                declaredName: "N9",
                elements: [{ declaredName: "A" }],
                comments: [
                    {
                        declaredName: "Comment1",
                        about: [qualifiedTypeReference("N9::A")],
                        body: "/* comment about A */",
                    },
                    { declaredName: "Comment2", body: "/* comment about N9 */" },
                    { body: "/* also comment about N9 */" },
                ],
                docs: [{ declaredName: "N9_Doc", body: "/* doc about N9 */" }],
            },
        ],
    });
});

test("all top-level elements are in the root namespace", async () => {
    return expect(`doc /* root doc */
    type A;
    class C;
    datatype D;
    feature f: C;
    package P;
    `).toParseKerML({
        docs: [{ $type: "Documentation", body: "/* root doc */" }],
        elements: [
            {
                $type: Type,
                declaredName: "A",
            },
            { declaredName: "C", $type: Class },
            { declaredName: "D", $type: DataType },
            { declaredName: "P", $type: Package },
        ],
        features: [{ declaredName: "f", $type: Feature }],
    });
});
