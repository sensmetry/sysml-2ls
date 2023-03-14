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

import { stream } from "langium";
import { Specialization, Conjugation } from "../generated/ast";
import { SysMLTypeList } from "../services/sysml-ast-reflection";
import { JSONConvertible, KeysMatching } from "../utils/common";
import { ConjugationMeta, SpecializationMeta } from "./KerML";

export type SpecializationKeys = KeysMatching<SysMLTypeList, Specialization | Conjugation>;
// eslint-disable-next-line unused-imports/no-unused-vars
export type SpecializationType<K extends SpecializationKeys | undefined = undefined> =
    | SpecializationMeta
    | ConjugationMeta;

/**
 * Container for specializations that also allows filtering with caching
 */
export class Specializations
    implements Iterable<SpecializationType>, JSONConvertible<SpecializationType[]>
{
    toJSON(): SpecializationType[] {
        return this.get();
    }

    [Symbol.iterator](): Iterator<SpecializationType, undefined, undefined> {
        return this.types.values()[Symbol.iterator]();
    }

    protected readonly types = new Set<SpecializationType>();
    protected caches: { [K in SpecializationKeys]?: SpecializationType<K>[] } & {
        all?: SpecializationType[];
    } = {};

    /**
     * Clear all registered specializations
     */
    clear(): void {
        this.types.clear();
        this.caches = {};
    }

    /**
     * Add a new specialization
     * @param type specialized type
     * @param kind specialization kind
     * @param source specialization source
     */
    add<T extends SpecializationType>(specialization: T): void {
        if (this.types.has(specialization)) return;

        this.types.add(specialization);
        this.caches = {};
    }

    get<K extends SpecializationKeys>(kind: K): SpecializationType<K>[];
    get<K extends SpecializationKeys = SpecializationKeys>(
        kind: K | undefined
    ): SpecializationType<K | undefined>[];
    get(kind?: undefined): SpecializationType[];

    /**
     * @param kind specialization kind
     * @returns all specializations matching {@link kind}
     */
    get<K extends SpecializationKeys = SpecializationKeys>(
        kind?: K
    ): SpecializationType<K | undefined>[] {
        if (!kind) {
            return (this.caches["all"] ??= Array.from(this.types));
        }

        return (this.caches[kind] ??= stream(this.types)
            .filter((s) => s.is(kind))
            .toArray() as NonNullable<typeof this.caches[K]>);
    }
}
