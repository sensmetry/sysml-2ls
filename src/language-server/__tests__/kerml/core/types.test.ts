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

import { withQualifiedName, qualifiedTypeReference } from "../../../../testing";
import {
    MultiplicityRange,
    LiteralNumber,
    Feature,
    Disjoining,
    Subclassification,
    Conjugation,
    Namespace,
    Class,
} from "../../../generated/ast";

const Common = `
abstract datatype Anything;
`;

test("types can be disjoint", async () => {
    return expect(
        Common +
            `
    class B;
    class A specializes Anything disjoint from B;`
    ).toParseKerML({
        namespaceMembers: [
            { element: withQualifiedName("Anything") },
            { element: withQualifiedName("B") },
            {
                element: {
                    ...withQualifiedName("A"),
                    typeRelationships: [
                        { $type: Subclassification, reference: qualifiedTypeReference("Anything") },
                        { $type: Disjoining, reference: qualifiedTypeReference("B") },
                    ],
                },
            },
        ],
    });
});

test("types can conjugate", async () => {
    return expect(`
    class A;
    class C conjugates A;`).toParseKerML({
        namespaceMembers: [
            { element: withQualifiedName("A") },
            {
                element: {
                    ...withQualifiedName("C"),
                    typeRelationships: [
                        { $type: Conjugation, reference: qualifiedTypeReference("A") },
                    ],
                },
            },
        ],
    });
});

test("types can be abstract", async () => {
    return expect(
        Common +
            `
    abstract class A specializes Anything;`
    ).toParseKerML({
        namespaceMembers: [
            { element: withQualifiedName("Anything") },
            {
                element: {
                    ...withQualifiedName("A"),
                    typeRelationships: [{ reference: qualifiedTypeReference("Anything") }],
                    isAbstract: "abstract",
                },
            },
        ],
    });
});

test("types can have multiplicity", async () => {
    return expect(
        Common +
            `
    type Singleton[1] specializes Anything;`
    ).toParseKerML({
        namespaceMembers: [
            { element: withQualifiedName("Anything") },
            {
                element: {
                    ...withQualifiedName("Singleton"),
                    typeRelationships: [{ reference: qualifiedTypeReference("Anything") }],
                    multiplicity: {
                        element: {
                            $type: MultiplicityRange,
                            range: {
                                element: {
                                    $type: LiteralNumber,
                                    literal: 1,
                                },
                            },
                        },
                    },
                },
            },
        ],
    });
});

test("type children can reference private child members", async () => {
    return expect(
        Common +
            `
    class Super specializes Anything {
        private namespace N {
            class Sub specializes Super;
        }
        protected feature f : N::Sub;
        member feature f1 : Super featured by N::Sub;
        member feature f2 : Super featured by N::Sub;
    }`
    ).toParseKerML({
        namespaceMembers: [
            { element: withQualifiedName("Anything") },
            {
                element: {
                    ...withQualifiedName("Super"),
                    typeRelationships: [{ reference: qualifiedTypeReference("Anything") }],
                    namespaceMembers: [
                        {
                            visibility: "private",
                            element: {
                                $type: Namespace,
                                ...withQualifiedName("Super::N"),
                                namespaceMembers: [
                                    {
                                        element: {
                                            ...withQualifiedName("Super::N::Sub"),
                                            typeRelationships: [
                                                { reference: qualifiedTypeReference("Super") },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                    members: [
                        {
                            visibility: "protected",
                            element: {
                                $type: Feature,
                                ...withQualifiedName("Super::f"),
                                typeRelationships: [
                                    { reference: qualifiedTypeReference("Super::N::Sub") },
                                ],
                            },
                        },
                        {
                            element: {
                                $type: Feature,
                                ...withQualifiedName("Super::f1"),
                                typeRelationships: [
                                    { reference: qualifiedTypeReference("Super") },
                                    { reference: qualifiedTypeReference("Super::N::Sub") },
                                ],
                            },
                        },
                        {
                            element: {
                                $type: Feature,
                                ...withQualifiedName("Super::f2"),
                                typeRelationships: [
                                    { reference: qualifiedTypeReference("Super") },
                                    { reference: qualifiedTypeReference("Super::N::Sub") },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
    });
});

test("types can be sufficient", async () => {
    return expect(`
    abstract class MaterialThing;
    class Wheel;
    class all Car specializes MaterialThing {
        feature wheels[4] : Wheel;
    }`).toParseKerML({
        namespaceMembers: [
            {
                element: {
                    $type: Class,
                    ...withQualifiedName("MaterialThing"),
                    isAbstract: "abstract",
                },
            },
            {
                element: {
                    $type: Class,
                    ...withQualifiedName("Wheel"),
                },
            },
            {
                element: {
                    $type: Class,
                    ...withQualifiedName("Car"),
                    isSufficient: true,
                    typeRelationships: [{ reference: qualifiedTypeReference("MaterialThing") }],
                    members: [
                        {
                            element: {
                                $type: Feature,
                                ...withQualifiedName("Car::wheels"),
                                multiplicity: {
                                    element: {
                                        $type: MultiplicityRange,
                                        range: {
                                            element: {
                                                $type: LiteralNumber,
                                                literal: 4,
                                            },
                                        },
                                    },
                                },
                                typeRelationships: [{ reference: qualifiedTypeReference("Wheel") }],
                            },
                        },
                    ],
                },
            },
        ],
    });
});
