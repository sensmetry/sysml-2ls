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
                target: {
                    $type: Disjoining,
                    ...withQualifiedName("Disj"),
                    sourceRef: qualifiedTypeReference("A"),
                    targetRef: qualifiedTypeReference("B"),
                },
            },
            {
                target: {
                    $type: Disjoining,
                    sourceRef: qualifiedTypeReference("Mammal"),
                    targetRef: qualifiedTypeReference("Mineral"),
                },
            },
            {
                target: {
                    $type: Disjoining,
                    sourceRef: qualifiedTypeReference("Person::parents"),
                    targetRef: qualifiedTypeReference("Person::children"),
                    elements: [
                        {
                            source: {
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
                target: {
                    $type: Disjoining,
                    sourceRef: qualifiedTypeReference("A"),
                    targetRef: qualifiedTypeReference("B"),
                },
            },
            {
                target: {
                    $type: Disjoining,
                    sourceRef: qualifiedTypeReference("Mammal"),
                    targetRef: qualifiedTypeReference("Mineral"),
                },
            },
            {
                target: {
                    $type: Disjoining,
                    sourceRef: qualifiedTypeReference("Person::parents"),
                    targetRef: qualifiedTypeReference("Person::children"),
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
                target: {
                    $type: Class,
                    ...withQualifiedName("C"),
                    heritage: [
                        { $type: Subclassification, targetRef: qualifiedTypeReference("Anything") },
                    ],
                    typeRelationships: [
                        { $type: Disjoining, targetRef: qualifiedTypeReference("A") },
                        { $type: Disjoining, targetRef: qualifiedTypeReference("B") },
                    ],
                },
            },
            { target: withQualifiedName("Animal") },
            {
                target: {
                    $type: Class,
                    ...withQualifiedName("Mammal2"),
                    heritage: [
                        { $type: Subclassification, targetRef: qualifiedTypeReference("Animal") },
                    ],
                    typeRelationships: [
                        { $type: Disjoining, targetRef: qualifiedTypeReference("Mineral") },
                    ],
                },
            },
        ],
    });
});
