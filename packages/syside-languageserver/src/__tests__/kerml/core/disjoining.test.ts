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

import { withQualifiedName, qualifiedTypeReference, anything } from "../../../testing";
import { Class, Disjoining, Documentation, Subclassification } from "../../../generated/ast";

const Common = `
class Person {
    feature parents: Person[2];
    feature children: Person[*];
}
class Mineral;
class Mammal;
class A;
class B;
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
        children: [
            ...anything(5),
            {
                element: {
                    $type: Disjoining,
                    ...withQualifiedName("Disj"),
                    source: qualifiedTypeReference("A"),
                    reference: qualifiedTypeReference("B"),
                },
            },
            {
                element: {
                    $type: Disjoining,
                    source: qualifiedTypeReference("Mammal"),
                    reference: qualifiedTypeReference("Mineral"),
                },
            },
            {
                element: {
                    $type: Disjoining,
                    source: qualifiedTypeReference("Person::parents"),
                    reference: qualifiedTypeReference("Person::children"),
                    elements: [
                        {
                            element: {
                                $type: Documentation,
                                body: "/* No Person can be their own parent. */",
                            },
                        },
                    ],
                },
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
        children: [
            ...anything(5),
            {
                element: {
                    $type: Disjoining,
                    source: qualifiedTypeReference("A"),
                    reference: qualifiedTypeReference("B"),
                },
            },
            {
                element: {
                    $type: Disjoining,
                    source: qualifiedTypeReference("Mammal"),
                    reference: qualifiedTypeReference("Mineral"),
                },
            },
            {
                element: {
                    $type: Disjoining,
                    source: qualifiedTypeReference("Person::parents"),
                    reference: qualifiedTypeReference("Person::children"),
                },
            },
        ],
    });
});

test("types can declare owned disjoinings", async () => {
    return expect(
        Common +
            `
    class Anything;
    class C specializes Anything disjoint from A, B;
    class Animal;
    class Mammal2 :> Animal disjoint from Mineral;
    `
    ).toParseKerML({
        children: [
            ...anything(6),
            {
                element: {
                    $type: Class,
                    ...withQualifiedName("C"),
                    heritage: [
                        { $type: Subclassification, reference: qualifiedTypeReference("Anything") },
                    ],
                    typeRelationships: [
                        { $type: Disjoining, reference: qualifiedTypeReference("A") },
                        { $type: Disjoining, reference: qualifiedTypeReference("B") },
                    ],
                },
            },
            { element: withQualifiedName("Animal") },
            {
                element: {
                    $type: Class,
                    ...withQualifiedName("Mammal2"),
                    heritage: [
                        { $type: Subclassification, reference: qualifiedTypeReference("Animal") },
                    ],
                    typeRelationships: [
                        { $type: Disjoining, reference: qualifiedTypeReference("Mineral") },
                    ],
                },
            },
        ],
    });
});
