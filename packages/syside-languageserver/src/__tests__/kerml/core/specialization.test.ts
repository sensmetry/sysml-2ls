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

import { qualifiedTypeReference, anything, withQualifiedName } from "../../../testing";
import { Specialization, Documentation, Class } from "../../../generated/ast";

const Common = `
class A;
class B;
`;

test("specialization can be parsed", async () => {
    return expect(
        Common +
            `
    class x;
    classifier things;
    specialization Gen subtype A specializes B;
    specialization subtype x :> things {
        doc /* unnamed */
    }`
    ).toParseKerML({
        children: [
            ...anything(4),
            {
                target: {
                    $type: Specialization,
                    sourceRef: qualifiedTypeReference("A"),
                    targetRef: qualifiedTypeReference("B"),
                },
            },
            {
                target: {
                    $type: Specialization,
                    sourceRef: qualifiedTypeReference("x"),
                    targetRef: qualifiedTypeReference("things"),
                    elements: [
                        {
                            source: {
                                $type: Documentation,
                                body: "/* unnamed */",
                            },
                        },
                    ],
                },
            },
        ],
    });
});

test("types can specialize multiple types", async () => {
    return expect(
        Common +
            `
    class C specializes A, B;`
    ).toParseKerML({
        children: [
            ...anything(2),
            {
                target: {
                    $type: Class,
                    ...withQualifiedName("C"),
                    heritage: [
                        { targetRef: qualifiedTypeReference("A") },
                        { targetRef: qualifiedTypeReference("B") },
                    ],
                },
            },
        ],
    });
});
