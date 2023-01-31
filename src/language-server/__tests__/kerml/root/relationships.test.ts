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

test("relationships are parseable", async () => {
    return expect(`
    type <'1'> A;
    type <'2'> B;
    type <'3'> C;
    type <'4'> D;
    dependency <'5'> R from '1', D to B, C;
    `).toParseKerML({
        elements: [
            { declaredName: "A", declaredShortName: "'1'" },
            { declaredName: "B", declaredShortName: "'2'" },
            { declaredName: "C", declaredShortName: "'3'" },
            { declaredName: "D", declaredShortName: "'4'" },
        ],
        relationships: [
            {
                declaredName: "R",
                declaredShortName: "'5'",
                client: [qualifiedTypeReference("A"), qualifiedTypeReference("D")],
                supplier: [qualifiedTypeReference("B"), qualifiedTypeReference("C")],
            },
        ],
    });
});
