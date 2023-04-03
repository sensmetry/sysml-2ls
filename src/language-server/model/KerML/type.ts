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

import { Stream, stream, TreeStreamImpl } from "langium";
import { Mixin } from "ts-mixer";
import { FeatureMembership, Type } from "../../generated/ast";
import { SysMLTypeList } from "../../services/sysml-ast-reflection";
import { KeysMatching } from "../../utils/common";
import { collectRedefinitions } from "../../utils/scope-util";
import { SpecializationKeys, Specializations, SpecializationType } from "../containers";
import { getTypeClassifierString, TypeClassifier } from "../enums";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { InputParametersMixin } from "../mixins";
import {
    ElementMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityRangeMeta,
    NamespaceMeta,
    NonNullRelationship,
    OwningMembershipMeta,
    ResultExpressionMembershipMeta,
    ReturnParameterMembershipMeta,
    SpecializationMeta,
    TargetType,
} from "./_internal";

export const ImplicitTypes = {
    base: "Base::Anything",
};

@metamodelOf(Type, ImplicitTypes)
export class TypeMeta extends Mixin(InputParametersMixin, NamespaceMeta) {
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
    result: ResultExpressionMembershipMeta | undefined;
    returns: ReturnParameterMembershipMeta | undefined;

    multiplicity?: OwningMembershipMeta<MultiplicityRangeMeta>;

    constructor(elementId: ElementID, parent: ModelContainer<Type>) {
        super(elementId, parent);
    }

    override initialize(node: Type): void {
        this.isAbstract = !!node.isAbstract;
        if (node.multiplicity) {
            this.multiplicity = node.multiplicity
                .$meta as OwningMembershipMeta<MultiplicityRangeMeta>;
        }
    }

    /**
     * Human readable string of classifier flags
     */
    get classifierString(): string {
        return getTypeClassifierString(this.classifier);
    }

    override ast(): Type | undefined {
        return this._ast as Type;
    }

    override parent(): ModelContainer<Type> {
        return this._parent;
    }

    override owner(): ElementMeta {
        // only namespaces are entry types
        return this._owner as ElementMeta;
    }

    /**
     * Stream of direct specializations matching {@link kind}
     * @param kind specialization kind filter
     */
    specializations<K extends SpecializationKeys | undefined>(kind: K): SpecializationType<K>[];
    specializations(kind?: undefined): SpecializationType[];
    specializations<K extends SpecializationKeys>(kind?: K): SpecializationType<K | undefined>[] {
        return this._specializations.get(kind);
    }

    /**
     * Stream of direct specialized types matching {@link kind}
     * @param kind specialization kind filter
     */
    types<K extends SpecializationKeys | undefined>(
        kind: K
    ): Stream<NonNullable<TargetType<SpecializationType<K>>>>;
    types(kind?: undefined): Stream<NonNullable<TargetType<SpecializationType>>>;
    types<K extends SpecializationKeys>(
        kind?: K
    ): Stream<NonNullable<TargetType<SpecializationType<K | undefined>>>> {
        return stream(this.specializations(kind))
            .map((s) => s.finalElement())
            .nonNullable();
    }

    /**
     * Stream of all direct and indirect specializations
     * @param kind specialization kind filter
     */
    allSpecializations<K extends SpecializationKeys | undefined>(
        kind: K
    ): Stream<SpecializationType<K>>;
    allSpecializations(kind?: undefined): Stream<SpecializationType<undefined>>;
    allSpecializations<K extends SpecializationKeys | undefined>(
        kind?: K
    ): Stream<SpecializationType<K | undefined>> {
        const visited = new Set<unknown>();
        const self = new SpecializationMeta(-1, this);
        self.setElement(this);
        const tree = new TreeStreamImpl<SpecializationType<K | undefined>>(
            self as NonNullRelationship<typeof self>,
            // avoid circular specializations, there probably should be a
            // warning
            (s) =>
                s
                    .finalElement()
                    ?.specializations()
                    .filter((s) => {
                        const target = s.finalElement();
                        if (visited.has(target)) return false;
                        visited.add(target);
                        return true;
                    }) ?? [],
            {
                includeRoot: false,
            }
        );

        if (!kind) return tree;
        return tree.filter((s) => s.is(kind));
    }

    /**
     * Stream of all direct and indirect specialized types
     * @param kind specialization kind filter
     * @param includeSelf if true, also include itself
     */
    allTypes<T extends TypeMeta, K extends SpecializationKeys | undefined>(
        this: T,
        kind: K,
        includeSelf: true
    ): Stream<NonNullable<T | TargetType<SpecializationType<K>>>>;
    allTypes<T extends TypeMeta, K extends SpecializationKeys | undefined>(
        this: T,
        kind: K,
        includeSelf?: false
    ): Stream<NonNullable<TargetType<SpecializationType<K>>>>;
    allTypes<T extends TypeMeta, K extends SpecializationKeys | undefined>(
        this: T,
        kind: K,
        includeSelf?: boolean
    ): Stream<NonNullable<T | TargetType<SpecializationType<K>>>>;
    allTypes<T extends TypeMeta>(
        this: T,
        kind: undefined,
        includeSelf: true
    ): Stream<NonNullable<T | TargetType<SpecializationType>>>;
    allTypes<T extends TypeMeta>(
        this: T,
        kind: undefined,
        includeSelf?: false
    ): Stream<NonNullable<TargetType<SpecializationType>>>;
    allTypes<T extends TypeMeta>(
        this: T,
        kind?: undefined,
        includeSelf?: boolean
    ): Stream<NonNullable<T | TargetType<SpecializationType>>>;

    allTypes<K extends SpecializationKeys | undefined>(
        kind?: K,
        includeSelf = false
    ): Stream<NonNullable<TargetType<SpecializationType<K | undefined>> | TypeMeta>> {
        const tree = this.allSpecializations(kind)
            .map((s) => s.finalElement())
            .nonNullable();
        if (includeSelf) return stream([this]).concat(tree);
        return tree;
    }

    /**
     * @param type qualified name or type AST node to check
     * @returns true if this type specializes directly or indirectly
     * {@link type}, false otherwise
     */
    conforms(type: string | TypeMeta): boolean {
        if (typeof type === "string")
            return this.allTypes(undefined, true).some((t) => t?.qualifiedName === type);
        return this.allTypes(undefined, true).some((t) => t === type);
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specializations that satisfy {@link is}
     */
    specializationsMatching<
        K extends KeysMatching<SysMLTypeList, Type>,
        SK extends SpecializationKeys
    >(
        is: K | K[],
        kind?: SK
    ): Stream<NonNullRelationship<SpecializationType<SK | undefined>, SysMLTypeList[K]["$meta"]>> {
        return (
            Array.isArray(is)
                ? stream(this.specializations(kind)).filter((s) => s.finalElement()?.isAny(is))
                : stream(this.specializations(kind)).filter((s) => s.finalElement()?.is(is))
        ) as Stream<
            NonNullRelationship<SpecializationType<SK | undefined>, SysMLTypeList[K]["$meta"]>
        >;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specialized types that satisfy {@link is}
     */
    typesMatching<K extends KeysMatching<SysMLTypeList, Type>, SK extends SpecializationKeys>(
        is: K | K[],
        kind?: SK
    ): Stream<SysMLTypeList[K]["$meta"]> {
        return stream(this.specializationsMatching(is, kind))
            .map((s) => s.finalElement())
            .nonNullable();
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @param includeSelf if true, also include self
     * @returns Stream of all direct and indirect specializations that satisfy {@link is}
     */
    allSpecializationsMatching<
        K extends KeysMatching<SysMLTypeList, Type>,
        SK extends SpecializationKeys
    >(
        is: K | K[],
        kind?: SK
    ): Stream<NonNullRelationship<SpecializationType<SK | undefined>, SysMLTypeList[K]["$meta"]>> {
        return (
            Array.isArray(is)
                ? stream(this.allSpecializations(kind)).filter((s) => s.finalElement()?.isAny(is))
                : stream(this.allSpecializations(kind)).filter((s) => s.finalElement()?.is(is))
        ) as Stream<
            NonNullRelationship<SpecializationType<SK | undefined>, SysMLTypeList[K]["$meta"]>
        >;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @param includeSelf if true, also include self
     * @returns Stream of all direct and indirect specialized types that satisfy {@link conforms}
     */
    allTypesMatching<K extends KeysMatching<SysMLTypeList, Type>, SK extends SpecializationKeys>(
        is: K | K[],
        kind?: SK,
        includeSelf = false
    ): Stream<SysMLTypeList[K]["$meta"]> {
        return (
            Array.isArray(is)
                ? stream(this.allTypes(kind, includeSelf)).filter((s) => s.isAny(is))
                : stream(this.allTypes(kind, includeSelf)).filter((s) => s.is(is))
        ) as Stream<SysMLTypeList[K]["$meta"]>;
    }

    override reset(_: Type): void {
        this._specializations.clear();
        this.resetInputParameters();
    }

    /**
     * Get a stream of inherited positional features
     * @param predicate feature filter predicate
     * @param typePredicate type constraint
     * @param includeSelf if true, include owned features
     * @returns stream of features from direct and indirect specializations that
     * satisfy both {@link predicate} and {@link typePredicate}
     */
    basePositionalFeatures(
        predicate: (f: MembershipMeta<FeatureMeta>) => boolean,
        typePredicate?: (t: TypeMeta) => boolean,
        includeSelf = false
    ): Stream<MembershipMeta<FeatureMeta>> {
        let count = 0;
        const counted = (f: MembershipMeta<FeatureMeta>): MembershipMeta<FeatureMeta> => {
            ++count;
            return f;
        };

        let allTypes = typePredicate
            ? this.allTypes().filter((s) => typePredicate(s))
            : this.allTypes();
        if (includeSelf) allTypes = stream([this]).concat(allTypes);

        // TODO: filter by visibility?
        return allTypes.flatMap((s) =>
            stream(s.features).filter(predicate).tail(count).map(counted)
        );
    }

    /**
     * @returns owned or inherited result parameter if one exists, otherwise undefined
     */
    resultParameter(): ResultExpressionMembershipMeta | undefined {
        return (this.result ??= this.allTypes()
            .map((t) => t.result)
            .find((r) => r));
    }

    returnParameter(): ReturnParameterMembershipMeta | undefined {
        return (this.returns ??= this.allTypes()
            .map((t) => t.returns)
            .find((r) => r));
    }

    /**
     * @see {@link Specializations.add}
     */
    addSpecialization<T extends SpecializationType>(specialization: T): void {
        if (specialization.finalElement() === this) return;
        this._specializations.add(specialization);
    }

    override allMetadata(): Stream<MetadataFeatureMeta> {
        // TODO: filter by visibility?
        return this.allTypes(undefined, true).flatMap((t) => t.metadata);
    }

    override allFeatures(): Stream<MembershipMeta<FeatureMeta>> {
        // TODO: filter by visibility?
        const visited = new Set<object>();
        return this.allTypes(undefined, true)
            .flatMap((t) => t.features)
            .filter((member) => {
                const f = member.element();
                if (!f || visited.has(f)) return false;
                visited.add(f);
                collectRedefinitions(f, visited);
                return true;
            });
    }

    ownedFeatureMemberships(): Stream<FeatureMembershipMeta> {
        return stream(this.features).filter((m) =>
            m.is(FeatureMembership)
        ) as Stream<FeatureMembershipMeta>;
    }

    ownedFeatures(): Stream<FeatureMeta> {
        return this.featuresByMembership(FeatureMembership);
    }

    ownedParameters(): Stream<FeatureMeta> {
        return this.ownedFeatures().filter((f) => f.isParameter);
    }
}

declare module "../../generated/ast" {
    interface Type {
        $meta: TypeMeta;
    }
}
