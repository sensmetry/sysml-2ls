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

import { JSONConvertible } from "../utils/common";
import { SubtypeKeys, SysMLInterface, SysMLType } from "../services";
import { Element } from "../generated/ast";
import { BasicMetamodel } from "./metamodel";

/**
 * Container for elements that also allows filtering by type with caching
 */
export class ElementContainer<T extends Element = Element>
    implements Iterable<T["$meta"]>, JSONConvertible<readonly T["$meta"][]>
{
    toJSON(): readonly T["$meta"][] {
        return this.all;
    }

    [Symbol.iterator](): Iterator<T["$meta"], undefined, undefined> {
        return this.elements.values()[Symbol.iterator]();
    }

    // we don't (allow to) remove stored elements at the moment so use array
    // here
    protected readonly elements: T["$meta"][] = [];
    protected caches = new Map<string | object, T["$meta"][]>();

    invalidateCaches(): void {
        this.caches.clear();
    }

    /**
     * Clear all elements and caches
     */
    clear(): void {
        this.elements.length = 0;
        this.caches.clear();
    }

    /**
     * Add a new element
     * @param element
     */
    add(...element: T["$meta"][]): void {
        this.elements.push(...element);
        this.caches.clear();
    }

    /**
     * Get elements filtered by type
     * @param kind type of elements to return
     */
    get<K extends SubtypeKeys<T>>(kind: K): readonly SysMLInterface<K>["$meta"][];
    /**
     * Get elements filtered by type
     * @param kind type of elements to return
     */
    get<K extends SubtypeKeys<T>>(kind?: K): readonly T["$meta"][];
    /**
     * Get elements filtered by type guard
     * @param filter type guard, to enable caching use `const` filters
     */
    get<V extends T["$meta"]>(filter: (element: T["$meta"]) => element is V): readonly V[];
    /**
     * Get elements filtered by predicate
     * @param filter predicate, to enable caching use `const` filters
     */
    get(filter: (element: T["$meta"]) => boolean): readonly T["$meta"][];
    get(kind?: undefined): readonly T["$meta"][];

    get(kindOrFilter?: SysMLType | ((element: T["$meta"]) => boolean)): readonly T["$meta"][] {
        const all = this.all;
        if (!kindOrFilter) {
            return all;
        }

        let filtered = this.caches.get(kindOrFilter);
        if (filtered) return filtered;

        filtered = all.filter(
            typeof kindOrFilter === "string" ? BasicMetamodel.is(kindOrFilter) : kindOrFilter
        );

        this.caches.set(kindOrFilter, filtered);
        return filtered;
    }

    get all(): readonly T["$meta"][] {
        return this.elements;
    }
}
