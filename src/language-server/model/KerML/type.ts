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

import { Feature, MetadataFeature, Result, Type } from "../../generated/ast";
import { Stream, stream, TreeStreamImpl } from "langium";
import { getTypeClassifierString, SpecializationKind, TypeClassifier } from "../enums";
import { NamespaceMeta } from "./namespace";
import { metamodelOf, ElementID } from "../metamodel";
import { SpecializationType, Specializations } from "../containers";
import { collectRedefinitions } from "../../utils/ast-util";

export const ImplicitTypes = {
    base: "Base::Anything",
};

@metamodelOf(Type, ImplicitTypes)
export class TypeMeta extends NamespaceMeta {
    /**
     * Specializations
     */
    protected readonly _specializations = new Specializations();

    /**
     * Whether this type is abstract
     */
    isAbstract = false;

    /**
     * Cached type classifiers
     */
    classifier: TypeClassifier = TypeClassifier.None;

    /**
     * Result member
     */
    result: Result | undefined;

    constructor(node: Type, elementId: ElementID) {
        super(node, elementId);
    }

    override initialize(node: Type): void {
        this.isAbstract = !!node.isAbstract;
    }

    /**
     * Human readable string of classifier flags
     */
    get classifierString(): string {
        return getTypeClassifierString(this.classifier);
    }

    override self(): Type {
        return super.deref() as Type;
    }

    /**
     * Stream of direct specializations matching {@link kind}
     * @param kind specialization kind filter
     */
    specializations(kind = SpecializationKind.None): SpecializationType[] {
        return this._specializations.get(kind);
    }

    /**
     * Stream of direct specialized types matching {@link kind}
     * @param kind specialization kind filter
     */
    types(kind = SpecializationKind.None): Stream<Type> {
        return stream(this.specializations(kind)).map((s) => s.type);
    }

    /**
     * Stream of all direct and indirect specializations
     * @param kind specialization kind filter
     * @param includeSelf if true, also include itself
     */
    allSpecializations(
        kind = SpecializationKind.None,
        includeSelf = false
    ): Stream<SpecializationType> {
        const visited = new Set<Type>();
        return new TreeStreamImpl<SpecializationType>(
            {
                type: this.self(),
                kind: SpecializationKind.None,
                isImplicit: false,
            },
            // avoid circular specializations, there probably should be a
            // warning
            (s) =>
                s.type.$meta.specializations(kind).filter((s) => {
                    if (visited.has(s.type)) return false;
                    visited.add(s.type);
                    return true;
                }),
            {
                includeRoot: includeSelf,
            }
        );
    }

    /**
     * Stream of all direct and indirect specialized types
     * @param kind specialization kind filter
     * @param includeSelf if true, also include itself
     */
    allTypes(kind = SpecializationKind.None, includeSelf = false): Stream<Type> {
        return stream(this.allSpecializations(kind, includeSelf)).map((s) => s.type);
    }

    /**
     * @param type qualified name or type AST node to check
     * @param kind specialization kind filter
     * @returns true if this type specializes directly or indirectly
     * {@link type}, false otherwise
     */
    is(type: string | Type, kind = SpecializationKind.None): boolean {
        if (typeof type === "string")
            return this.allTypes(kind, true).some((t) => t.$meta.qualifiedName === type);
        return this.allTypes(kind, true).some((t) => t === type);
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specializations that satisfy {@link is}
     */
    specializationsMatching<T extends Type>(
        is: (item: unknown) => item is T,
        kind = SpecializationKind.None
    ): Stream<SpecializationType<T>> {
        return stream(this.specializations(kind)).filter((s) => is(s.type)) as Stream<
            SpecializationType<T>
        >;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specialized types that satisfy {@link is}
     */
    typesMatching<T extends Type>(
        is: (item: unknown) => item is T,
        kind = SpecializationKind.None
    ): Stream<T> {
        return stream(this.specializationsMatching(is, kind)).map((s) => s.type);
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @param includeSelf if true, also include self
     * @returns Stream of all direct and indirect specializations that satisfy {@link is}
     */
    allSpecializationsMatching<T extends Type>(
        is: (item: unknown) => item is T,
        kind = SpecializationKind.None,
        includeSelf = false
    ): Stream<SpecializationType<T>> {
        return this.allSpecializations(kind, includeSelf).filter((s) => is(s.type)) as Stream<
            SpecializationType<T>
        >;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @param includeSelf if true, also include self
     * @returns Stream of all direct and indirect specialized types that satisfy {@link is}
     */
    allTypesMatching<T extends Type>(
        fn: (item: unknown) => item is T,
        kind = SpecializationKind.None,
        includeSelf = false
    ): Stream<T> {
        return this.allSpecializationsMatching(fn, kind, includeSelf).map((s) => s.type);
    }

    override reset(): void {
        super.reset();

        this._specializations.clear();
    }

    /**
     * Get a stream of inherited positional features
     * @param predicate feature filter predicate
     * @param typePredicate type constraint
     * @returns stream of features from direct and indirect specializations that
     * satisfy both {@link predicate} and {@link typePredicate}
     */
    basePositionalFeatures(
        predicate: (f: Feature) => boolean,
        typePredicate?: (t: Type) => boolean
    ): Stream<Feature> {
        let count = 0;
        const counted = (f: Feature): Feature => {
            ++count;
            return f;
        };

        const allTypes = typePredicate
            ? this.allSpecializations().filter((s) => typePredicate(s.type))
            : this.allSpecializations();

        // TODO: filter by visibility?
        return allTypes.flatMap((s) =>
            stream(s.type.$meta.features).filter(predicate).tail(count).map(counted)
        );
    }

    /**
     * @returns owned or inherited result parameter if one exists, otherwise undefined
     */
    resultParameter(): Result | undefined {
        if (this.result) return this.result;
        for (const specialization of this.allSpecializations()) {
            const result = specialization.type.$meta.result;
            if (result) {
                this.result = result;
                return result;
            }
        }

        return;
    }

    /**
     * @see {@link Specializations.add}
     */
    addSpecialization(type: Type, kind: SpecializationKind, isImplicit = false): void {
        if (type === this.self()) return;
        this._specializations.add(type, kind, isImplicit);
    }

    override allMetadata(): Stream<MetadataFeature> {
        // TODO: filter by visibility?
        return this.allTypes(SpecializationKind.None, true).flatMap((t) => t.$meta.metadata);
    }

    override allFeatures(): Stream<Feature> {
        // TODO: filter by visibility?
        const visited = new Set<Feature>();
        return this.allTypes(SpecializationKind.None, true)
            .flatMap((t) => t.$meta.features)
            .filter((f) => {
                if (visited.has(f)) return false;
                visited.add(f);
                collectRedefinitions(f, visited);
                return true;
            });
    }
}

declare module "../../generated/ast" {
    interface Type {
        $meta: TypeMeta;
    }
}
