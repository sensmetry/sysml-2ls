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
    DiagnosticInfo,
    MaybePromise,
    MultiMap,
    Properties,
    ValidationAcceptor,
    ValidationCheck,
    ValidationRegistry,
    isOperationCancelled,
} from "langium";
import { CancellationToken, Disposable } from "vscode-languageserver";
import { BasicMetamodel, ElementMeta, typeIndex } from "../../model";
import {
    SubtypeKeys,
    SysMLAstReflection,
    SysMLInterface,
    SysMLType,
    SysMLTypeList,
} from "../sysml-ast-reflection";
import { Element } from "../../generated/ast";

type ModelAst<T extends BasicMetamodel = BasicMetamodel> = NonNullable<ReturnType<T["ast"]>>;

export type ModelDiagnosticInfo<M extends BasicMetamodel, P = Properties<ModelAst<M>>> = {
    /**
     * Model element this diagnostic applies to
     */
    element: M;
} & Omit<DiagnosticInfo<ModelAst<M>, P>, "node">;

export type Severity = "error" | "warning" | "info" | "hint";
export interface TypedModelDiagnostic<
    T extends ElementMeta = ElementMeta,
    P = Properties<ModelAst<T>>,
> {
    element: ElementMeta;
    severity: Severity;
    message: string;
    info: Omit<ModelDiagnosticInfo<T, P>, "element">;
}

export type ModelDiagnostic = TypedModelDiagnostic<ElementMeta, string>;

export type ModelValidationAcceptor = <N extends ElementMeta>(
    severity: "error" | "warning" | "info" | "hint",
    message: string,
    info: ModelDiagnosticInfo<N>
) => void;

export type ModelValidationCheck<T extends ElementMeta = ElementMeta> = (
    node: T,
    accept: ModelValidationAcceptor,
    cancelToken: CancellationToken
) => MaybePromise<void>;

export type ModelValidationChecks = {
    [K in SysMLType]?: SysMLInterface<K> extends Element
        ?
              | ModelValidationCheck<SysMLInterface<K>["$meta"]>
              | Array<ModelValidationCheck<SysMLInterface<K>["$meta"]>>
        : never;
};

type Elements = SubtypeKeys<Element>;

type Check<T extends ElementMeta = ElementMeta> = {
    rule: ModelValidationCheck<T>;
    bounds: Elements[];
};
type Rules = { [K in Elements]?: Check<SysMLTypeList[K]["$meta"]>[] };

export const ValidationRules = {
    kerml: {} as Rules,
    sysml: {} as Rules,
};

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function validate<K extends Elements>(
    type: K,
    kerml = true,
    sysml = true,
    bounds: Elements[] = []
) {
    const add = (
        checks: Rules,
        check: ModelValidationCheck<SysMLTypeList[K]["$meta"]>,
        bounds: Elements[]
    ): void => {
        (checks[type] ??= [] as Rules[K])?.push({ rule: check, bounds });
    };
    return function <T extends ModelValidationCheck<SysMLTypeList[K]["$meta"]>>(
        _: object,
        __: string | symbol,
        descriptor: TypedPropertyDescriptor<T>
    ): void {
        const value = descriptor.value;
        if (!value) return;
        if (kerml) add(ValidationRules.kerml, value, bounds);
        if (sysml) add(ValidationRules.sysml, value, bounds);
    };
}

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function validateKerML<K extends Elements>(
    type: K,
    options: { sysml?: boolean; bounds?: Elements[] } = {}
) {
    return validate(type, true, options.sysml ?? true, options.bounds ?? []);
}

// useless/long return type for decorator factory
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function validateSysML<K extends Elements>(type: K, bounds: Elements[] = []) {
    return validate(type, false, true, bounds);
}

export class BaseValidationRegistry extends ValidationRegistry {
    protected readonly checks = new MultiMap<string, ModelValidationCheck>();

    protected registerBoundRules(rules: Rules, thisObj: unknown): void {
        for (const [type, checks] of Object.entries(rules)) {
            for (const check of checks) {
                this.registerModelValidationRule(
                    type as Elements,
                    check.rule as ModelValidationCheck,
                    thisObj,
                    check.bounds
                );
            }
        }
    }

    /**
     * Register a custom validation rule for all elements `type`
     * @deprecated use {@link registerModelValidationRule} instead
     * @param type element type this rule is for
     * @param check validation check for `type`
     * @param thisObj `this` parameter the `check` will be invoked with
     * @param bounds upper type bounds `check` applies to
     * @returns a `Disposable` object that removes `check` from this registry
     */
    registerValidationRule<K extends Elements>(
        type: K,
        check: ValidationCheck<SysMLTypeList[K]>,
        thisObj: ThisParameterType<unknown> = this,
        bounds: readonly Elements[] = []
    ): Disposable {
        return this.registerModelValidationRule(
            type,
            this.convertToModelCheck(check as ValidationCheck),
            thisObj,
            bounds
        );
    }

    /**
     * Register a custom validation rule for all elements `type`
     * @param type element type this rule is for
     * @param check validation check for `type`
     * @param thisObj `this` parameter the `check` will be invoked with
     * @param bounds upper type bounds `check` applies to
     * @returns a `Disposable` object that removes `check` from this registry
     */
    registerModelValidationRule<K extends Elements>(
        type: K,
        check: ModelValidationCheck<SysMLTypeList[K]["$meta"]>,
        thisObj: ThisParameterType<unknown> = this,
        bounds: readonly Elements[] = []
    ): Disposable {
        const types = [type as SysMLType].concat(
            Array.from(typeIndex.getSubtypes(type)).filter(
                (subtype) => !bounds.some((bound) => this.astReflection.isSubtype(subtype, bound))
            )
        );

        const wrapped = this.wrapModelValidationException(check as ModelValidationCheck, thisObj);
        types.forEach((type) => {
            this.checks.add(type, wrapped);
        });

        return Disposable.create(() => {
            types.forEach((type) => this.checks.delete(type, wrapped));
        });
    }

    protected override doRegister(type: string, check: ValidationCheck): void {
        const modelCheck = this.convertToModelCheck(check);

        this.checks.add(type, modelCheck);
        for (const subtype of this.astReflection.getSubtypes(type)) {
            this.checks.add(subtype, modelCheck);
        }
    }

    protected get astReflection(): SysMLAstReflection {
        return this["reflection"];
    }

    protected convertToModelCheck(check: ValidationCheck): ModelValidationCheck {
        return (element, accept, token) => {
            const node = element.ast();
            const acceptor: ValidationAcceptor = (severity, message, info) => {
                accept(severity, message, {
                    element: info.node.$meta as ElementMeta,
                    ...this.getSharedInfo(info as unknown as DiagnosticInfo<Element>),
                });
            };
            if (node) return check(node, acceptor, token);
        };
    }

    protected wrapModelValidationException(
        check: ModelValidationCheck,
        thisObj: unknown
    ): ModelValidationCheck {
        return async (element, accept, cancelToken) => {
            try {
                await check.call(thisObj, element, accept, cancelToken);
            } catch (err) {
                if (isOperationCancelled(err)) {
                    throw err;
                }
                console.error("An error occurred during validation:", err);
                const message = err instanceof Error ? err.message : String(err);
                if (err instanceof Error && err.stack) {
                    console.error(err.stack);
                }
                accept("error", "An error occurred during validation: " + message, { element });
            }
        };
    }

    override getChecks(type: string): readonly ValidationCheck[] {
        // only for compatibility with langium
        return this.getModelChecks(type).map(
            (check): ValidationCheck =>
                (node, accept, token) => {
                    return check(
                        node.$meta as ElementMeta,
                        (severity, message, info) => {
                            const node = info.element.ast();
                            if (!node) return;
                            accept(severity, message, {
                                node: node,
                                ...this.getSharedInfo(info as ModelDiagnosticInfo<ElementMeta>),
                            });
                        },
                        token
                    );
                }
        );
    }

    getModelChecks(type: string): readonly ModelValidationCheck[] {
        return this.checks.get(type);
    }

    protected getSharedInfo<T extends Element, P>(
        info: ModelDiagnosticInfo<T["$meta"], P> | DiagnosticInfo<T, P>
    ): Omit<DiagnosticInfo<T, P>, "node"> {
        return {
            code: info.code,
            codeDescription: info.codeDescription,
            data: info.data,
            index: info.index,
            keyword: info.keyword,
            property: info.property,
            range: info.range,
            relatedInformation: info.relatedInformation,
            tags: info.tags,
        };
    }
}
