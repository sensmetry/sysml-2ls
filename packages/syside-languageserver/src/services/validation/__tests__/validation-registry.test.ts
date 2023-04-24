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

import { Disposable } from "vscode-languageserver";
import { services } from "../../../testing";
import { LibraryPackage, Package } from "../../../generated/ast";
import { BaseValidationRegistry } from "../validation-registry";

describe("Validation registry", () => {
    let registry: BaseValidationRegistry;

    beforeEach(() => {
        registry = new BaseValidationRegistry(services.SysML);
    });

    describe("Custom validations", () => {
        let unregister: Disposable;
        beforeEach(() => {
            unregister = registry.registerValidationRule(Package, () => {
                /* empty */
            });
        });

        test("Custom checks are registered", () => {
            [Package, LibraryPackage].forEach((type) =>
                expect(registry.getChecks(type)).toHaveLength(1)
            );
        });

        test("Custom checks can be unregistered", () => {
            unregister.dispose();
            [Package, LibraryPackage].forEach((type) =>
                expect(registry.getChecks(type)).toHaveLength(0)
            );
        });
    });
});
