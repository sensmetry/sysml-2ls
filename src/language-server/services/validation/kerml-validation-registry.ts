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

import { ValidationCheck, ValidationChecks, ValidationRegistry } from "langium";
import { KeysMatching } from "../../utils/common";
import { KerMLServices } from "../services";
import { SysMLType, SysMLTypeList } from "../sysml-ast-reflection";

export const ValidationRules = {
    kerml: {} as ValidationChecks<SysMLTypeList>,
    sysml: {} as ValidationChecks<SysMLTypeList>,
};

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function validate<K extends SysMLType>(type: K, kerml = true, sysml = true) {
    const add = (
        checks: ValidationChecks<SysMLTypeList>,
        check: ValidationCheck<SysMLTypeList[K]>
    ): void => {
        let array = checks[type] as ValidationCheck<SysMLTypeList[K]>[] | undefined;
        if (!array) {
            array = [];
            (checks as Record<string, unknown[]>)[type] = array;
        }
        array.push(check);
    };
    return function <T, TK extends KeysMatching<T, ValidationCheck<SysMLTypeList[K]>>>(
        _: T,
        __: TK,
        descriptor: PropertyDescriptor
    ): void {
        if (kerml) add(ValidationRules.kerml, descriptor.value);
        if (sysml) add(ValidationRules.sysml, descriptor.value);
    };
}

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function validateKerML<K extends SysMLType>(type: K, sysml = true) {
    return validate(type, true, sysml);
}

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function validateSysML<K extends SysMLType>(type: K) {
    return validate(type, false, true);
}

/**
 * Registry for validation checks.
 */
export class KerMLValidationRegistry extends ValidationRegistry {
    constructor(services: KerMLServices) {
        super(services);
        const validator = services.validation.KerMLValidator;
        this.register(ValidationRules.kerml, validator);
    }
}
