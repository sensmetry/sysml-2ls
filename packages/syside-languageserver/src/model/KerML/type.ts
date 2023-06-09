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
import {
    FeatureMembership,
    FeatureRelationship,
    Inheritance,
    Membership,
    Type,
    TypeRelationship,
} from "../../generated/ast";
import { SubtypeKeys, SysMLTypeList } from "../../services/sysml-ast-reflection";
import { enumerable, KeysMatching } from "../../utils/common";
import { collectRedefinitions } from "../../utils/scope-util";
import { ElementContainer } from "../containers";
import { getTypeClassifierString, TypeClassifier } from "../enums";
import { metamodelOf } from "../metamodel";
import { InputParametersMixin } from "../mixins";
import {
    ElementParts,
    FeatureMembershipMeta,
    FeatureMeta,
    InheritanceMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityRangeMeta,
    NamespaceMeta,
    NonNullRelationship,
    OwningMembershipMeta,
    SpecializationMeta,
} from "./_internal";

export const ImplicitTypes = {
    base: "Base::Anything",
};

@metamodelOf(Type, ImplicitTypes)
export class TypeMeta extends Mixin(InputParametersMixin, NamespaceMeta) {
    protected readonly _heritage = new ElementContainer<Inheritance>();
    protected readonly _typeRelationships = new ElementContainer<FeatureRelationship>();
    protected _isAbstract = false;
    protected _classifier: TypeClassifier = TypeClassifier.None;

    protected _multiplicity: OwningMembershipMeta<MultiplicityRangeMeta> | undefined;

    /**
     * Whether this type is abstract
     */
    @enumerable
    get isAbstract(): boolean {
        return this._isAbstract;
    }
    set isAbstract(value) {
        this._isAbstract = value;
    }

    @enumerable
    get multiplicity(): OwningMembershipMeta<MultiplicityRangeMeta> | undefined {
        return this._multiplicity;
    }
    set multiplicity(value) {
        this._multiplicity = value;
    }

    @enumerable
    get heritage(): readonly InheritanceMeta[] {
        return this._heritage.all;
    }

    @enumerable
    get typeRelationships(): readonly FeatureRelationship["$meta"][] {
        return this._typeRelationships.all;
    }
    addTypeRelationship(...element: TypeRelationship["$meta"][]): this {
        this._typeRelationships.add(...element);
        element.forEach((e) => this.maybeTakeOwnership(e));
        return this;
    }

    /**
     * Cached type classifiers
     */
    get classifier(): TypeClassifier {
        return this._classifier;
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

    /**
     * Stream of direct specializations matching {@link kind}
     * @param kind specialization kind filter
     */
    specializations<K extends SubtypeKeys<Inheritance>>(kind: K): readonly InheritanceMeta[];
    specializations<K extends SubtypeKeys<Inheritance> | undefined>(
        kind?: K
    ): readonly InheritanceMeta[];
    specializations(kind?: undefined): readonly InheritanceMeta[];
    specializations<K extends SubtypeKeys<Inheritance>>(kind?: K): readonly InheritanceMeta[] {
        return this._heritage.get(kind);
    }

    /**
     * Stream of direct specialized types matching {@link kind}
     * @param kind specialization kind filter
     */
    types<K extends SubtypeKeys<Inheritance>>(kind: K): Stream<TypeMeta>;
    types<K extends SubtypeKeys<Inheritance> | undefined>(kind: K): Stream<TypeMeta>;
    types(kind?: undefined): Stream<TypeMeta>;
    types<K extends SubtypeKeys<Inheritance>>(kind?: K): Stream<TypeMeta> {
        return stream(this.specializations(kind))
            .map((s) => s.finalElement())
            .nonNullable();
    }

    /**
     * Stream of all direct and indirect specializations
     * @param kind specialization kind filter
     */
    allSpecializations<K extends SubtypeKeys<Inheritance>>(kind: K): Stream<InheritanceMeta>;
    // prettier-ignore
    allSpecializations<K extends SubtypeKeys<Inheritance> | undefined>(kind: K): Stream<InheritanceMeta>;
    allSpecializations(kind?: undefined): Stream<InheritanceMeta>;
    allSpecializations<K extends SubtypeKeys<Inheritance>>(kind?: K): Stream<InheritanceMeta> {
        const visited = new Set<unknown>();
        const self = new SpecializationMeta(-1);
        self.setElement(this);
        const tree = new TreeStreamImpl<InheritanceMeta>(
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
    // prettier-ignore
    allTypes<K extends SubtypeKeys<Inheritance> | undefined>(kind: K, includeSelf?: boolean): Stream<TypeMeta>;
    allTypes(kind?: undefined, includeSelf?: boolean): Stream<TypeMeta>;
    allTypes<K extends SubtypeKeys<Inheritance> | undefined>(
        kind?: K,
        includeSelf = false
    ): Stream<TypeMeta> {
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
     * @param types types or their fully qualified names to check for
     * conformance
     * @returns the first value in `types` that `this` conforms to and the
     * corresponding type or `undefined` if `this` does not conform to any
     * `types`
     */
    firstConforming<T extends string | TypeMeta>(types: T[]): [T, TypeMeta] | undefined {
        for (const type of this.allTypes(undefined, true)) {
            const result = types.find((t) =>
                typeof t === "string" ? type.qualifiedName === t : type === t
            );
            if (result) return [result, type];
        }

        return;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specializations that satisfy {@link is}
     */
    specializationsMatching<
        K extends KeysMatching<SysMLTypeList, Type>,
        SK extends SubtypeKeys<Inheritance>
    >(is: K | K[], kind?: SK): Stream<NonNullRelationship<InheritanceMeta>> {
        return (
            Array.isArray(is)
                ? stream(this.specializations(kind)).filter((s) => s.finalElement()?.isAny(...is))
                : stream(this.specializations(kind)).filter((s) => s.finalElement()?.is(is))
        ) as Stream<NonNullRelationship<InheritanceMeta>>;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @returns Stream of direct specialized types that satisfy {@link is}
     */
    typesMatching<K extends SubtypeKeys<Type>, SK extends SubtypeKeys<Inheritance>>(
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
    allSpecializationsMatching<K extends SubtypeKeys<Type>, SK extends SubtypeKeys<Inheritance>>(
        is: K | K[],
        kind?: SK
    ): Stream<NonNullRelationship<InheritanceMeta>> {
        return (
            Array.isArray(is)
                ? stream(this.allSpecializations(kind)).filter((s) =>
                      s.finalElement()?.isAny(...is)
                  )
                : stream(this.allSpecializations(kind)).filter((s) => s.finalElement()?.is(is))
        ) as Stream<NonNullRelationship<InheritanceMeta>>;
    }

    /**
     * @param is type assertion predicate
     * @param kind specialization kind filter
     * @param includeSelf if true, also include self
     * @returns Stream of all direct and indirect specialized types that satisfy {@link conforms}
     */
    allTypesMatching<K extends SubtypeKeys<Type>, SK extends SubtypeKeys<Inheritance>>(
        is: K | K[],
        kind?: SK,
        includeSelf = false
    ): Stream<SysMLTypeList[K]["$meta"]> {
        return (
            Array.isArray(is)
                ? stream(this.allTypes(kind, includeSelf)).filter((s) => s.isAny(...is))
                : stream(this.allTypes(kind, includeSelf)).filter((s) => s.is(is))
        ) as Stream<SysMLTypeList[K]["$meta"]>;
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
            stream(s.featureMembers()).filter(predicate).tail(count).map(counted)
        );
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onSpecializationAdded(spec: InheritanceMeta): void {
        // empty
    }

    protected maybeTakeOwnership(element: FeatureRelationship["$meta"] | InheritanceMeta): void {
        if (!element.parent()?.is(Membership)) this.takeOwnership(element);
    }

    addSpecialization(specialization: InheritanceMeta): void {
        if (specialization.finalElement() === this) return;
        this._heritage.add(specialization);
        this.maybeTakeOwnership(specialization);

        this.onSpecializationAdded(specialization);
    }

    override allMetadata(): Stream<MetadataFeatureMeta> {
        // TODO: filter by visibility?
        return this.allTypes(undefined, true).flatMap((t) => t.metadata);
    }

    override allFeatures(): Stream<MembershipMeta<FeatureMeta>> {
        // TODO: filter by visibility?
        const visited = new Set<object>();
        return this.allTypes(undefined, true)
            .flatMap((t) => t.featureMembers())
            .filter((member) => {
                const f = member.element();
                if (!f || visited.has(f)) return false;
                visited.add(f);
                collectRedefinitions(f, visited);
                return true;
            });
    }

    ownedFeatureMemberships(): Stream<FeatureMembershipMeta> {
        return stream(this.featureMembers()).filter((m) =>
            m.is(FeatureMembership)
        ) as Stream<FeatureMembershipMeta>;
    }

    ownedFeatures(): Stream<FeatureMeta> {
        return this.featuresByMembership(FeatureMembership);
    }

    ownedParameters(): Stream<FeatureMeta> {
        return this.ownedFeatures().filter((f) => f.isParameter);
    }

    protected collectDeclaration(parts: ElementParts): void {
        // multiplicity always appears before heritage in non-feature types
        if (this._multiplicity) {
            parts.push(["multiplicity", [this._multiplicity]]);
        }

        parts.push(["heritage", this.heritage]);
        parts.push(["typeRelationships", this.typeRelationships]);
    }

    protected override collectParts(): ElementParts {
        const parts: ElementParts = [["prefixes", this.prefixes]];

        this.collectDeclaration(parts);
        parts.push(["children", this.children]);

        return parts;
    }
}

declare module "../../generated/ast" {
    interface Type {
        $meta: TypeMeta;
    }
}
