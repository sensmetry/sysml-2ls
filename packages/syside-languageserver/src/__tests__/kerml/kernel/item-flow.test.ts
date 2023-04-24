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

import { parseKerML, NO_ERRORS, sanitizeTree } from "../../../testing";
import { Feature, Namespace } from "../../../generated/ast";

test("named item flows are parsed", async () => {
    const result = await parseKerML(`
    class Fuel;
    struct Vehicle {
        composite feature fuelTank[1] {
            out feature fuelOut[1] : Fuel;
        }
        composite feature engine {
            in feature fuelIn[1] : Fuel;
        }
        flow fuelFlow from fuelTank::fuelOut to engine::fuelIn;
    }`);
    expect(result).toMatchObject(NO_ERRORS);
    const vehicle = result.value.namespaceMembers[1].element as Namespace;
    const flow = vehicle.members[2].element;
    expect(sanitizeTree(flow)).toMatchSnapshot();
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
    const result = await parseKerML(`
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
    }`);
    expect(result).toMatchObject(NO_ERRORS);
    const vehicle = result.value.members[0].element as Feature;
    const flow = vehicle.members[0].element;
    expect(sanitizeTree(flow)).toMatchSnapshot();
});
