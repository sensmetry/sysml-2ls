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
import { withQualifiedName, qualifiedTypeReference, anything } from "../../../../testing";
import { Disjoining, Documentation } from "../../../generated/ast";

const Common = `
type Person {
    feature parents: Person[2];
    feature children: Person[*];
}
type Mineral;
type Mammal;
type A;
type B;
`;

test("disjoining can be parsed", async () => {
    return expect(
        Common +
            `
    disjoining Disj disjoint A from B;
    disjoining disjoint Mammal from Mineral;
    disjoining disjoint Person::parents from Person::children {
        doc /* No Person can be their own parent. */
    }`
    ).toParseKerML({
        relationships: [
            {
                $type: Disjoining,
                ...withQualifiedName("Disj"),
                disjoined: qualifiedTypeReference("A"),
                disjoining: qualifiedTypeReference("B"),
            },
            {
                $type: Disjoining,
                disjoined: qualifiedTypeReference("Mammal"),
                disjoining: qualifiedTypeReference("Mineral"),
            },
            {
                $type: Disjoining,
                disjoined: qualifiedTypeReference("Person::parents"),
                disjoining: qualifiedTypeReference("Person::children"),
                docs: [
                    {
                        $type: Documentation,
                        body: "/* No Person can be their own parent. */",
                    },
                ],
            },
        ],
    });
});

test("disjoining may be omitted without identifiers", async () => {
    return expect(
        Common +
            `
    disjoint A from B;
    disjoint Mammal from Mineral;
    disjoint Person::parents from Person::children;`
    ).toParseKerML({
        relationships: [
            {
                $type: Disjoining,
                disjoined: qualifiedTypeReference("A"),
                disjoining: qualifiedTypeReference("B"),
            },
            {
                $type: Disjoining,
                disjoined: qualifiedTypeReference("Mammal"),
                disjoining: qualifiedTypeReference("Mineral"),
            },
            {
                $type: Disjoining,
                disjoined: qualifiedTypeReference("Person::parents"),
                disjoining: qualifiedTypeReference("Person::children"),
            },
        ],
    });
});

test("types can declare owned disjoinings", async () => {
    return expect(
        Common +
            `
    type Anything;
    type C specializes Anything disjoint from A, B;
    type Animal;
    type Mammal2 :> Animal disjoint from Mineral;
    `
    ).toParseKerML({
        elements: [
            ...anything(6),
            {
                $type: Type,
                ...withQualifiedName("C"),
                specializes: [qualifiedTypeReference("Anything")],
                disjoins: [qualifiedTypeReference("A"), qualifiedTypeReference("B")],
            },
            withQualifiedName("Animal"),
            {
                $type: Type,
                ...withQualifiedName("Mammal2"),
                specializes: [qualifiedTypeReference("Animal")],
                disjoins: [qualifiedTypeReference("Mineral")],
            },
        ],
    });
});
