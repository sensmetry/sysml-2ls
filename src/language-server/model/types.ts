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

import { AstReflection } from "langium";
import { reflection, SysMlAstReflection, SysMlAstType } from "../generated/ast";

export type TypeMap<TKey, T> = {
    [type in keyof TKey]?: T;
} & {
    default?: T;
};

type Keys<T> = keyof T;

/**
 * Utilities for constructing generic maps of type names to specific values
 */
class TypesIndex<S = SysMlAstType> {
    protected readonly base: AstReflection;
    protected readonly supertypes = new Map<string, Set<string>>();

    constructor() {
        this.base = new SysMlAstReflection();
        for (const type of this.base.getAllTypes()) {
            const supertypes: string[] = [];
            for (const subtype of this.base.getAllTypes()) {
                if (subtype === type) continue;
                if (this.base.isSubtype(type, subtype)) supertypes.push(subtype);
            }
            supertypes.sort((a, b) =>
                this.base.isSubtype(a, b) ? -1 : this.base.isSubtype(b, a) ? 1 : 0
            );
            this.supertypes.set(type, new Set(supertypes));
        }
    }

    /**
     * @returns names of all registered types in the grammar
     */
    getAllTypes(): Keys<S>[] {
        return this.base.getAllTypes() as Keys<S>[];
    }

    /**
     * @returns true if {@link subtype} extends {@link supertype} interface
     */
    isSubtype(subtype: string, supertype: string): boolean {
        return subtype === supertype || (this.supertypes.get(subtype)?.has(supertype) ?? false);
    }

    /**
     * Get supertypes of {@link type} in the order of inheritance
     * @param type Type name
     * @returns set of supertypes ordered from the most specialized supertype to
     * the most general
     */
    getInheritanceChain(type: string): Set<Keys<S>> {
        return (this.supertypes.get(type) ?? new Set<string>()) as Set<Keys<S>>;
    }

    /**
     * Expand {@link registry} mapping `typeName => value` to all AST types
     * using the most derived type values, i.e. `registry.Element` would map to
     * all types extending `Element` unless {@link registry} contained other
     * entries for types extending `Element`. For example `registry = {Element:
     * ..., Type: ...}` would expand `registry.Type` value to all types
     * extending element while `registry.Element` only to those types that
     * extend `Element` but not `Type`. If {@link registry} has `default`
     * member, it is used in cases where there were no other valid alternatives.
     * @param registry type specific values.
     * @returns map of type names to expanded {@link registry} values
     */
    expandToDerivedTypes<T>(registry: Readonly<TypeMap<S, T>>): Map<string, T> {
        const result = new Map<string, T>();
        const def = registry.default;

        for (const type of this.base.getAllTypes()) {
            let value: T | undefined = registry[type as Keys<S>];

            if (!value) {
                // no direct value, check in the inheritance order
                const chain = this.getInheritanceChain(type);
                for (const subtype of chain) {
                    value = registry[subtype as Keys<S>];
                    if (value) break;
                }
            }

            if (!value) value = def;
            if (value) result.set(type, value);
        }

        return result;
    }

    /**
     * Expand {@link registry} mapping `typeName => [...value]` and merge with
     * values from the inherited types
     * @see {@link expandToDerivedTypes}
     * @param registry type specific values
     * @returns map of type names to expanded and merged {@link registry} values
     */
    expandAndMerge<T>(registry: Readonly<TypeMap<S, T[]>>, reverse = false): Map<Keys<S>, T[]> {
        const result = new Map<string, T[]>(this.base.getAllTypes().map((t) => [t, []]));
        const push = reverse
            ? (array: T[], values: T[]): void => {
                  array.unshift(...values);
              }
            : (array: T[], values: T[]): void => {
                  array.push(...values);
              };

        for (const type of this.base.getAllTypes()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const array = result.get(type)!;
            let value: T[] | undefined = registry[type as Keys<S>];
            if (value) push(array, value);

            const chain = this.getInheritanceChain(type);
            for (const subtype of chain) {
                value = registry[subtype as Keys<S>];
                if (value) push(array, value);
            }
        }

        return result as Map<Keys<S>, T[]>;
    }

    isUnion(type: string): boolean {
        return type.startsWith("Named") || type.indexOf("Or") !== -1;
    }
}

export const typeIndex = new TypesIndex();

// replace the recursive function with precomputed lookup tables
reflection.isSubtype = function (subtype, supertype): boolean {
    return typeIndex.isSubtype(subtype, supertype);
};
