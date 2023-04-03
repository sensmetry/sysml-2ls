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

import { AstNode, ValidationCheck, ValidationRegistry } from "langium";
import { typeIndex, TypeMap } from "../../model";
import { KeysMatching } from "../../utils/common";
import { SysMLType, SysMLTypeList } from "../sysml-ast-reflection";

type Check<T extends AstNode = AstNode> = { rule: ValidationCheck<T>; bounds: SysMLType[] };
type Rules = { [K in SysMLType]?: Check<SysMLTypeList[K]>[] };

export const ValidationRules = {
    kerml: {} as Rules,
    sysml: {} as Rules,
};

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function validate<K extends SysMLType>(
    type: K,
    kerml = true,
    sysml = true,
    bounds: SysMLType[] = []
) {
    const add = (
        checks: Rules,
        check: ValidationCheck<SysMLTypeList[K]>,
        bounds: SysMLType[]
    ): void => {
        (checks[type] ??= [] as Rules[K])?.push({ rule: check, bounds });
    };
    return function <T, TK extends KeysMatching<T, ValidationCheck<SysMLTypeList[K]>>>(
        _: T,
        __: TK,
        descriptor: PropertyDescriptor
    ): void {
        if (kerml) add(ValidationRules.kerml, descriptor.value, bounds);
        if (sysml) add(ValidationRules.sysml, descriptor.value, bounds);
    };
}

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function validateKerML<K extends SysMLType>(
    type: K,
    options: { sysml?: boolean; bounds?: SysMLType[] } = {}
) {
    return validate(type, true, options.sysml ?? true, options.bounds ?? []);
}

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function validateSysML<K extends SysMLType>(type: K, bounds: SysMLType[] = []) {
    return validate(type, false, true, bounds);
}

export class BaseValidationRegistry extends ValidationRegistry {
    protected registerBoundRules(rules: Rules, thisObj: unknown): void {
        const expanded = typeIndex.expandAndMerge(rules as TypeMap<SysMLType, Check[]>);

        for (const [type, checks] of expanded.entries()) {
            for (const check of checks) {
                if (check.bounds.some((t) => this["reflection"].isSubtype(type, t))) continue;
                this["validationChecks"].add(
                    type,
                    this.wrapValidationException(check.rule, thisObj)
                );
            }
        }
    }
}
