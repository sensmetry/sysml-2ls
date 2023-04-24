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

import { AstNode, MultiMap, ValidationCheck, ValidationRegistry } from "langium";
import { Disposable } from "vscode-languageserver";
import { typeIndex } from "../../model";
import { KeysMatching } from "../../utils/common";
import { SysMLAstReflection, SysMLType, SysMLTypeList } from "../sysml-ast-reflection";

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
        for (const [type, checks] of Object.entries(rules)) {
            for (const check of checks) {
                this.registerValidationRule(
                    type as SysMLType,
                    check.rule as ValidationCheck,
                    thisObj,
                    check.bounds
                );
            }
        }
    }

    /**
     * Register a custom validation rule for all elements `type`
     * @param type element type this rule is for
     * @param check validation check for `type`
     * @param thisObj `this` parameter the `check` will be invoked with
     * @param bounds upper type bounds `check` applies to
     * @returns a `Disposable` object that removes `check` from this registry
     */
    registerValidationRule<K extends SysMLType>(
        type: K,
        check: ValidationCheck<SysMLTypeList[K]>,
        thisObj: ThisParameterType<unknown> = this,
        bounds: readonly SysMLType[] = []
    ): Disposable {
        const types = [type as SysMLType].concat(
            Array.from(typeIndex.getSubtypes(type)).filter(
                (subtype) => !bounds.some((bound) => this.astReflection.isSubtype(subtype, bound))
            )
        );

        const wrapped = this.wrapValidationException(check as ValidationCheck, thisObj);
        types.forEach((type) => {
            this.checks.add(type, wrapped);
        });

        return Disposable.create(() => {
            types.forEach((type) => this.checks.delete(type, wrapped));
        });
    }

    protected override doRegister(type: string, check: ValidationCheck): void {
        this.checks.add(type, check);
        for (const subtype of this.astReflection.getSubtypes(type)) {
            this.checks.add(subtype, check);
        }
    }

    // this only exists for typings since accessing private member through key
    // returns `any` type
    protected get checks(): MultiMap<string, ValidationCheck> {
        return this["validationChecks"];
    }

    protected get astReflection(): SysMLAstReflection {
        return this["reflection"];
    }
}