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
import { TypeFeaturing, Feature, FeatureTyping } from "../../../generated/ast";

test("type featuring can be parsed", async () => {
    return expect(`
        feature engine;
        feature Vehicle;
        featuring engine_by_Vehicle of engine by Vehicle {
            doc /* doc */
        }
    `).toParseKerML({
        children: [
            ...anything(2),
            {
                target: {
                    $type: TypeFeaturing,
                    ...withQualifiedName("engine_by_Vehicle"),
                    sourceRef: qualifiedTypeReference("engine"),
                    targetRef: qualifiedTypeReference("Vehicle"),
                    elements: [
                        {
                            source: {
                                body: "/* doc */",
                            },
                        },
                    ],
                },
            },
        ],
    });
});

test.each(["of", ""])(
    "type featuring without identification can be parsed with '%s'",
    async (token: string) => {
        return expect(`
        feature engine;
        feature Vehicle;
        featuring ${token} engine by Vehicle;
    `).toParseKerML({
            children: [
                ...anything(2),
                {
                    target: {
                        $type: TypeFeaturing,
                        sourceRef: qualifiedTypeReference("engine"),
                        targetRef: qualifiedTypeReference("Vehicle"),
                    },
                },
            ],
        });
    }
);

test("features can own type featurings", async () => {
    return expect(`
    feature Vehicle;
    classifier Engine;
    feature engine : Engine featured by Vehicle;
    `).toParseKerML({
        children: [
            ...anything(2),
            {
                target: {
                    $type: Feature,
                    ...withQualifiedName("engine"),
                    heritage: [
                        { $type: FeatureTyping, targetRef: qualifiedTypeReference("Engine") },
                    ],
                    typeRelationships: [
                        { $type: TypeFeaturing, targetRef: qualifiedTypeReference("Vehicle") },
                    ],
                },
            },
        ],
    });
});
