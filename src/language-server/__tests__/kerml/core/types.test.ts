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
import { withQualifiedName, qualifiedTypeReference } from "../../../../testing";
import { MultiplicityRange, LiteralNumber, Namespace, Feature } from "../../../generated/ast";

const Common = `
abstract datatype Anything;
`;

test("types can be disjoint", async () => {
    return expect(
        Common +
            `
    type B;
    type A specializes Anything disjoint from B;`
    ).toParseKerML({
        elements: [
            withQualifiedName("Anything"),
            withQualifiedName("B"),
            {
                ...withQualifiedName("A"),
                specializes: [qualifiedTypeReference("Anything")],
                disjoins: [qualifiedTypeReference("B")],
            },
        ],
    });
});

test("types can conjugate", async () => {
    return expect(`
    type A;
    type C conjugates A;`).toParseKerML({
        elements: [
            withQualifiedName("A"),
            {
                ...withQualifiedName("C"),
                conjugates: [qualifiedTypeReference("A")],
            },
        ],
    });
});

test("types can be abstract", async () => {
    return expect(
        Common +
            `
    abstract type A specializes Anything;`
    ).toParseKerML({
        elements: [
            withQualifiedName("Anything"),
            {
                ...withQualifiedName("A"),
                specializes: [qualifiedTypeReference("Anything")],
                isAbstract: "abstract",
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
        elements: [
            withQualifiedName("Anything"),
            {
                ...withQualifiedName("Singleton"),
                specializes: [qualifiedTypeReference("Anything")],
                multiplicity: {
                    $type: MultiplicityRange,
                    range: {
                        $type: LiteralNumber,
                        value: 1,
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
    type Super specializes Anything {
        private namespace N {
            type Sub specializes Super;
        }
        protected feature f : N::Sub;
        member feature f1 : Super featured by N::Sub;
        member feature f2 : Super featured by N::Sub;
    }`
    ).toParseKerML({
        elements: [
            withQualifiedName("Anything"),
            {
                ...withQualifiedName("Super"),
                specializes: [qualifiedTypeReference("Anything")],
                elements: [
                    {
                        $type: Namespace,
                        ...withQualifiedName("Super::N"),
                        visibility: "private",
                        elements: [
                            {
                                ...withQualifiedName("Super::N::Sub"),
                                specializes: [qualifiedTypeReference("Super")],
                            },
                        ],
                    },
                ],
                features: [
                    {
                        $type: Feature,
                        ...withQualifiedName("Super::f"),
                        visibility: "protected",
                        typedBy: [qualifiedTypeReference("Super::N::Sub")],
                    },
                ],
                members: [
                    {
                        $type: Feature,
                        ...withQualifiedName("Super::f1"),
                        featuredBy: [qualifiedTypeReference("Super::N::Sub")],
                    },
                    {
                        $type: Feature,
                        ...withQualifiedName("Super::f2"),
                        featuredBy: [qualifiedTypeReference("Super::N::Sub")],
                    },
                ],
            },
        ],
    });
});

test("types can be sufficient", async () => {
    return expect(`
    abstract type MaterialThing;
    type Wheel;
    type all Car specializes MaterialThing {
        feature wheels[4] : Wheel;
    }`).toParseKerML({
        elements: [
            {
                $type: Type,
                ...withQualifiedName("MaterialThing"),
                isAbstract: "abstract",
            },
            {
                $type: Type,
                ...withQualifiedName("Wheel"),
            },
            {
                $type: Type,
                ...withQualifiedName("Car"),
                isSufficient: true,
                specializes: [qualifiedTypeReference("MaterialThing")],
                features: [
                    {
                        $type: Feature,
                        ...withQualifiedName("Car::wheels"),
                        multiplicity: {
                            $type: MultiplicityRange,
                            range: {
                                $type: LiteralNumber,
                                value: 4,
                            },
                        },
                        typedBy: [qualifiedTypeReference("Wheel")],
                    },
                ],
            },
        ],
    });
});
