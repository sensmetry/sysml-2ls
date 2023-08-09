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

import { ItemFlow } from "../../../generated/ast";
import { parsedNode, anything } from "../../../testing";

test("named item flows are parsed", async () => {
    return expect(
        parsedNode(
            `
    class Fuel;
    struct Vehicle {
        composite feature fuelTank[1] {
            out feature fuelOut[1] : Fuel;
        }
        composite feature engine {
            in feature fuelIn[1] : Fuel;
        }
        flow fuelFlow from fuelTank::fuelOut to engine::fuelIn;
    }`,
            { node: ItemFlow, build: true }
        )
    ).resolves.toMatchObject({
        ends: anything(2),
    });
});

test.each([
    ["flow source and output targets can be specified using feature chains", "flow fuelFlow"],
    ["flow identification can be omitted", "flow"],
    [
        "flow declaration can also include an explicit declaration of the type",
        "flow of fuelFlow : Fuel",
    ],
    ["explicit declaration with name only is treated as typing", "flow of Fuel"],
    ["explicit declaration with qualified name only is treated as typing", "flow of Fuel::SubFuel"],
])("%s", async (_: string, declaration: string) => {
    return expect(
        parsedNode(
            `
    class Fuel {
        class SubFuel;
    }
    struct Vehicle {
        composite feature fuelTank[1] {
            out feature fuelOut[1] : Fuel;
        }
        composite feature engine[1] {
            in feature fuelIn[1] : Fuel;
        }
    }
    feature vehicle : Vehicle {
        ${declaration} from fuelTank.fuelOut to engine.fuelIn;
    }`,
            { node: ItemFlow, build: true }
        )
    ).resolves.toMatchObject({
        ends: anything(2),
    });
});
