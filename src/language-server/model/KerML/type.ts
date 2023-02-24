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

import { Type } from "../../generated/ast";
import { Stream, stream, TreeStreamImpl } from "langium";
import { getTypeClassifierString, SpecializationKind, TypeClassifier } from "../enums";
import { NamespaceMeta } from "./namespace";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { SpecializationType, Specializations, SpecializationSource } from "../containers";
import { collectRedefinitions } from "../../utils/scope-util";
import { KeysMatching } from "../../utils/common";
import { SysMLTypeList } from "../../services/sysml-ast-reflection";
import {
    InlineExpressionMeta,
    ResultMeta,
    Related,
    FeatureMeta,
    MetadataFeatureMeta,
} from "./_internal";

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
    result: Related<InlineExpressionMeta, ResultMeta> | undefined;

    constructor(elementId: ElementID, parent: ModelContainer<Type>) {
        super(elementId, parent);
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

    override self(): Type | undefined {
        return super.deref() as Type;
    }

    override parent(): ModelContainer<Type> {
        return this._parent;
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
    types(kind = SpecializationKind.None): Stream<TypeMeta> {
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
        const visited = new Set<TypeMeta>();
        return new TreeStreamImpl<SpecializationType>(
            {
                type: this,
                kind: SpecializationKind.None,
                source: "explicit",
            },
            // avoid circular specializations, there probably should be a
            // warning
            (s) =>
                s.type.specializations(kind).filter((s) => {
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
    allTypes(kind = SpecializationKind.None, includeSelf = false): Stream<TypeMeta> {
        return stream(this.allSpecializations(kind, includeSelf)).map((s) => s.type);
    }

    /**
     * @param type qualified name or type AST node to check
     * @param kind specialization kind filter
     * @returns true if this type specializes directly or indirectly
     * {@link type}, false otherwise
     */
    conforms(type: string | TypeMeta, kind = SpecializationKind.None): boolean {
        if (typeof type === "string")
            return this.allTypes(kind, true).some((t) => t.qualifiedName === type);
        return this.allTypes(kind, true).some((t) => t === type);
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specializations that satisfy {@link is}
     */
    specializationsMatching<K extends KeysMatching<SysMLTypeList, Type>>(
        is: K | K[],
        kind = SpecializationKind.None
    ): Stream<SpecializationType<SysMLTypeList[K]["$meta"]>> {
        if (Array.isArray(is))
            return stream(this.specializations(kind)).filter((s) => s.type.isAny(is)) as Stream<
                SpecializationType<SysMLTypeList[K]["$meta"]>
            >;

        return stream(this.specializations(kind)).filter((s) => s.type.is(is)) as Stream<
            SpecializationType<SysMLTypeList[K]["$meta"]>
        >;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specialized types that satisfy {@link is}
     */
    typesMatching<K extends KeysMatching<SysMLTypeList, Type>>(
        is: K | K[],
        kind = SpecializationKind.None
    ): Stream<SysMLTypeList[K]["$meta"]> {
        return stream(this.specializationsMatching(is, kind)).map((s) => s.type);
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @param includeSelf if true, also include self
     * @returns Stream of all direct and indirect specializations that satisfy {@link is}
     */
    allSpecializationsMatching<K extends KeysMatching<SysMLTypeList, Type>>(
        is: K | K[],
        kind = SpecializationKind.None,
        includeSelf = false
    ): Stream<SpecializationType<SysMLTypeList[K]["$meta"]>> {
        if (Array.isArray(is))
            return this.allSpecializations(kind, includeSelf).filter((s) =>
                s.type.isAny(is)
            ) as Stream<SpecializationType<SysMLTypeList[K]["$meta"]>>;
        return this.allSpecializations(kind, includeSelf).filter((s) => s.type.is(is)) as Stream<
            SpecializationType<SysMLTypeList[K]["$meta"]>
        >;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @param includeSelf if true, also include self
     * @returns Stream of all direct and indirect specialized types that satisfy {@link conforms}
     */
    allTypesMatching<K extends KeysMatching<SysMLTypeList, Type>>(
        fn: K | K[],
        kind = SpecializationKind.None,
        includeSelf = false
    ): Stream<SysMLTypeList[K]["$meta"]> {
        return this.allSpecializationsMatching(fn, kind, includeSelf).map((s) => s.type);
    }

    override reset(_: Type): void {
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
        predicate: (f: Related<FeatureMeta>) => boolean,
        typePredicate?: (t: TypeMeta) => boolean
    ): Stream<Related<FeatureMeta>> {
        let count = 0;
        const counted = (f: Related<FeatureMeta>): Related<FeatureMeta> => {
            ++count;
            return f;
        };

        const allTypes = typePredicate
            ? this.allSpecializations().filter((s) => typePredicate(s.type))
            : this.allSpecializations();

        // TODO: filter by visibility?
        return allTypes.flatMap((s) =>
            stream(s.type.features).filter(predicate).tail(count).map(counted)
        );
    }

    /**
     * @returns owned or inherited result parameter if one exists, otherwise undefined
     */
    resultParameter(): Related<InlineExpressionMeta, ResultMeta> | undefined {
        if (this.result) return this.result;
        for (const specialization of this.allSpecializations()) {
            const result = specialization.type.result;
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
    addSpecialization(
        type: TypeMeta,
        kind: SpecializationKind,
        source: SpecializationSource = "explicit"
    ): void {
        if (type === this) return;
        this._specializations.add(type, kind, source);
    }

    override allMetadata(): Stream<Related<MetadataFeatureMeta>> {
        // TODO: filter by visibility?
        return this.allTypes(SpecializationKind.None, true).flatMap((t) => t.metadata);
    }

    override allFeatures(): Stream<Related<FeatureMeta>> {
        // TODO: filter by visibility?
        const visited = new Set<object>();
        return this.allTypes(SpecializationKind.None, true)
            .flatMap((t) => t.features)
            .filter((f) => {
                if (visited.has(f)) return false;
                visited.add(f);
                collectRedefinitions(f.element, visited);
                return true;
            });
    }
}

declare module "../../generated/ast" {
    interface Type {
        $meta: TypeMeta;
    }
}
