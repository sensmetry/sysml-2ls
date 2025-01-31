/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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
import * as ast from "../generated/ast";
import { SysMLTypeList } from "../services/sysml-ast-reflection";

export type TypeMap<TKey, T> = {
    [type in keyof TKey]?: T;
} & {
    default?: T;
};

type Keys<T> = keyof T;

// non-AST types, i.e. operators and enums
const NON_TYPES = new Set<string>([
    ast.TransparentElement,
    ast.FeatureRelationship,
    ast.InlineExpression,
    ast.NonOwnerType,
    ast.TypeRelationship,
]);

/**
 * Utilities for constructing generic maps of type names to specific values
 */
class TypesIndex<S = SysMLTypeList> {
    protected readonly base: AstReflection;
    protected readonly supertypes = new Map<string, Set<string>>();
    protected readonly subtypes = new Map<string, Set<string>>();
    protected readonly types: Keys<S>[];

    constructor() {
        this.base = new ast.SysMlAstReflection();
        for (const type of this.base.getAllTypes()) {
            // have to split to real interfaces and unions to have a proper
            // supertype chain
            const unions: string[] = [];
            const types: string[] = [];
            const relationships: string[] = [];
            for (const subtype of this.base.getAllTypes()) {
                if (subtype === type) continue;
                if (this.base.isSubtype(type, subtype)) {
                    (NON_TYPES.has(subtype)
                        ? unions
                        : this.base.isSubtype(subtype, ast.Namespace)
                          ? types
                          : relationships
                    ).push(subtype);
                }
            }

            this.sortTypes(types);

            // need to merge relationships afterwards to handle mixed types and
            // relationships, simple sorting doesn't work on such mixed types
            this.mergeTypes(types, this.sortTypes(relationships));
            // insert union types immediately after the last matching subtype
            this.mergeTypes(types, this.sortTypes(unions));

            const supertypes = new Set(types);
            this.supertypes.set(type, supertypes);

            supertypes.forEach((supertype) => {
                this.getSubtypes(supertype).add(type as Keys<S>);
            });
        }

        this.types = this.base.getAllTypes().filter((s) => !NON_TYPES.has(s)) as Keys<S>[];
    }

    private sortTypes(types: string[]): string[] {
        return types.sort((a, b) =>
            this.base.isSubtype(a, b) ? -1 : this.base.isSubtype(b, a) ? 1 : 0
        );
    }

    private mergeTypes(types: string[], other: string[]): string[] {
        const pos = other
            .map((u) => {
                let index = types.findIndex((i) => !this.base.isSubtype(i, u));
                if (index === -1) index = types.length;
                return [index, u] as [number, string];
            })
            .sort(([a, _], [b, __]) => a - b);
        pos.forEach(([pos, union], i) => types.splice(pos + i, 0, union));
        return types;
    }

    /**
     * @returns names of all registered types in the grammar
     */
    getAllTypes(): readonly Keys<S>[] {
        return this.types;
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

    getSubtypes(type: string): Set<Keys<S>> {
        let subtypes = this.subtypes.get(type);
        if (!subtypes) {
            subtypes = new Set();
            this.subtypes.set(type, subtypes);
        }
        return subtypes as Set<Keys<S>>;
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

    chain<T>(
        registry: Readonly<TypeMap<S, T>>,
        order: "subtype-first" | "supertype-first"
    ): Map<Keys<S>, T[]> {
        const result = new Map<Keys<S>, T[]>();
        const reversed = order === "supertype-first";

        for (const type of this.base.getAllTypes()) {
            const chain: T[] = [];

            const value = registry[type as Keys<S>];
            if (value) chain.push(value);

            this.getInheritanceChain(type).forEach((supertype) => {
                const value = registry[supertype];
                if (value) chain.push(value);
            });

            if (registry.default) chain.push(registry.default);

            result.set(type as Keys<S>, reversed ? chain.reverse() : chain);
        }

        return result;
    }

    isUnion(type: string): boolean {
        return type.startsWith("Named") || type.indexOf("Or") !== -1;
    }
}

export const typeIndex = new TypesIndex();

// replace the recursive function with precomputed lookup tables
ast.reflection.isSubtype = function (subtype, supertype): boolean {
    return typeIndex.isSubtype(subtype, supertype);
};
