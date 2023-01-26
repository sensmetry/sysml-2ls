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
    element <'1'> A;
    element <'2'> B;
    element <'3'> C;
    element <'4'> D;
    relationship <'5'> R from '1', D to B, C;
    `).toParseKerML({
        elements: [
            { name: "A", shortName: "'1'" },
            { name: "B", shortName: "'2'" },
            { name: "C", shortName: "'3'" },
            { name: "D", shortName: "'4'" },
        ],
        relationships: [
            {
                name: "R",
                shortName: "'5'",
                source: [qualifiedTypeReference("A"), qualifiedTypeReference("D")],
                target: [qualifiedTypeReference("B"), qualifiedTypeReference("C")],
            },
        ],
    });
});
