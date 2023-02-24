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

import { typeIndex } from "../../../../model/types";
import { SysMLMetamodelBuilder } from "../metamodel-builder";
import { services } from "../../../../../testing";

class TestingBuilder extends SysMLMetamodelBuilder {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    get factory() {
        return this.metaFactories;
    }
}

const builder = new TestingBuilder(services.shared);

test("all AST nodes have a factory function", async () => {
    const missing = typeIndex
        .getAllTypes()
        .map((t) => [t, builder.factory[t]])
        .filter(([_, v]) => v === undefined)
        .map(([k, _]) => k);
    expect(missing).toMatchInlineSnapshot("[]");
});
