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
    constructor(...items: T["$meta"][]) {
        this.elements = items;
    }

    toJSON(): readonly T["$meta"][] {
        return this.all;
    }

    [Symbol.iterator](): Iterator<T["$meta"], undefined, undefined> {
        return this.elements.values()[Symbol.iterator]();
    }

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
        this.invalidateCaches();
    }

    /**
     * Add a new element
     * @param element
     */
    push(...element: T["$meta"][]): number {
        this.invalidateCaches();
        return this.elements.push(...element);
    }

    remove(value: T["$meta"]): boolean {
        return removeObserved(this.elements, () => this.invalidateCaches(), value);
    }

    removeIf(predicate: (value: T["$meta"], index: number) => boolean): number {
        if (this.elements.length !== this.elements.removeIf(predicate)) this.invalidateCaches();
        return this.elements.length;
    }

    get length(): number {
        return this.elements.length;
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

declare global {
    interface Array<T> {
        /**
         * Remove a specific value from an array
         * @param value value to remove
         * @returns true if `value` was removed
         */
        remove(value: T): boolean;

        /**
         * Remove all values matching `predicate`. For small number of values to
         * remove (up to about 10), {@link remove} on each will be faster.
         * @param predicate predicate that returns `true` for values that should
         * be removed
         * @returns the new length of the array
         */
        removeIf(predicate: (value: T, index: number) => boolean): number;
    }
}

Array.prototype.removeIf = function (this, predicate): number {
    const total = this.length;

    let from = 0,
        to = 0;
    while (from < total) {
        const value = this[from];
        if (!predicate(value, from)) {
            this[to] = value;
            to++;
        }
        from++;
    }
    this.length = to;

    return this.length;
};

Array.prototype.remove = function (this, value): boolean {
    const index = this.indexOf(value);
    if (index !== -1) {
        this.splice(index, 1);
        return true;
    }
    return false;
};

export function removeObserved<T>(
    array: Pick<T[], "remove">,
    observer: (value: T) => void,
    value: T
): boolean {
    if (array.remove(value)) {
        observer(value);
        return true;
    }
    return false;
}

export function removeIfObserved<T>(
    array: Pick<T[], "removeIf">,
    observer: (value: T, index: number) => void,
    predicate: (value: T, index: number) => boolean
): number {
    return array.removeIf((value, index) => {
        if (predicate(value, index)) {
            observer(value, index);
            return true;
        }
        return false;
    });
}
