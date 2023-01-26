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

import { qualifiedTypeReference } from "../../../../testing";
import { Relationship, Class, DataType, Package, Feature } from "../../../generated/ast";
import { Element } from "../../../generated/ast";

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
            { name: "N1", shortName: "'1.1'" },
            {
                name: "N2",
                shortName: "'1.2'",
                docs: [{ body: "/* This is an example of a namespace body. */" }],
                elements: [{ name: "C" }, { name: "D" }, { name: "N3" }],
                features: [{ name: "f", typedBy: [qualifiedTypeReference("N2::C")] }],
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
                name: "N",
                elements: [
                    { name: "C", visibility: "public" },
                    { name: "D", visibility: "private" },
                ],
                features: [
                    {
                        name: "f",
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
                name: "N1",
                elements: [{ name: "A" }, { name: "B" }],
                aliases: [
                    {
                        name: "CCC",
                        shortName: "C",
                        for: qualifiedTypeReference("N1::B"),
                        docs: [{ body: "/* alias doc */" }],
                    },
                    { name: "D", for: qualifiedTypeReference("N1::B"), visibility: "private" },
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
                name: "N9",
                elements: [{ name: "A" }],
                comments: [
                    {
                        name: "Comment1",
                        about: [qualifiedTypeReference("N9::A")],
                        body: "/* comment about A */",
                    },
                    { name: "Comment2", body: "/* comment about N9 */" },
                    { body: "/* also comment about N9 */" },
                ],
                docs: [{ name: "N9_Doc", body: "/* doc about N9 */" }],
            },
        ],
    });
});

test("all top-level elements are in the root namespace", async () => {
    return expect(`doc /* root doc */
    element A {
        relationship B to C;
    }
    class C;
    datatype D;
    feature f: C;
    package P;
    `).toParseKerML({
        docs: [{ $type: "Documentation", body: "/* root doc */" }],
        elements: [
            {
                $type: Element,
                name: "A",
                relationships: [
                    {
                        $type: Relationship,
                        name: "B",
                        target: [qualifiedTypeReference("C")],
                    },
                ],
            },
            { name: "C", $type: Class },
            { name: "D", $type: DataType },
            { name: "P", $type: Package },
        ],
        features: [{ name: "f", $type: Feature }],
    });
});
