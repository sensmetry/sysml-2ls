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

import {
    parseKerML,
    withQualifiedName,
    qualifiedTypeReference,
    anything,
} from "../../../../testing";
import { Feature } from "../../../generated/ast";

test("feature chains allow qualified feature names in between chain parts", async () => {
    const result = await parseKerML(`
    type A {
        feature a {
            type B {
                feature b;
            }
        }
    }
    feature c chains A::a.B::b;`);

    expect(result).toParseKerML({
        features: [
            {
                $type: Feature,
                ...withQualifiedName("c"),
                chains: [qualifiedTypeReference("A::a::B::b")],
            },
        ],
    });

    const indices = result.value.features[0].chains[0].$meta.featureIndices;
    expect(Array.from(indices)).toEqual([1, 3]);
});

test.failing("non-feature name in a chain fails to parse", async () => {
    return expect(`
    type A {
        type a {
            type B {
                feature b;
            }
        }
    }
    feature c chains A::a.B::b;`).toParseKerML({});
});

test("features chaining a chain of 1 feature produce a diagnostic", async () => {
    return expect(`
    feature a;
    feature b chains a;`).toParseKerML({}, { diagnostics: anything(1) });
});
