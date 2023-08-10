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

import { Feature, Membership, OwningMembership } from "../../../generated/ast";
import { parsedNode, qualifiedTarget } from "../../../testing";

test("features can be parsed and aliased", async () => {
    return expect(
        parsedNode(
            `
    datatype Integer;
    feature person[*] : Person;
    classifier Person {
        feature age[1]: Integer;
        alias personAlias for person;
    }`,
            { node: Membership, build: true }
        )
    ).resolves.toMatchObject({ isAlias: true, targetRef: qualifiedTarget("person") });
});

test("member features can be parsed", async () => {
    return expect(
        parsedNode(
            `
    classifier A;
    classifier B {
        feature f;
        member feature g featured by A;
    }`,
            { node: OwningMembership, index: 2 }
        )
    ).resolves.toMatchObject({
        target: { $type: Feature },
    });
});
