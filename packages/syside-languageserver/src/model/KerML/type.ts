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

import { AstNode, LangiumDocument, Stream, stream, TreeStreamImpl } from "langium";
import { Mixin } from "ts-mixer";
import {
    Feature,
    FeatureMembership,
    FeatureRelationship,
    Inheritance,
    Type,
    TypeRelationship,
    Conjugation,
} from "../../generated/ast";
import { SubtypeKeys, SysMLInterface, SysMLTypeList } from "../../services/sysml-ast-reflection";
import { enumerable, KeysMatching } from "../../utils/common";
import { collectRedefinitions } from "../../utils/scope-util";
import { ElementContainer } from "../containers";
import { FeatureDirectionKind, getTypeClassifierString, TypeClassifier } from "../enums";
import {
    BasicMetamodel,
    ElementID,
    ElementIDProvider,
    metamodelOf,
    MetatypeProto,
} from "../metamodel";
import { InputParametersMixin } from "../mixins";
import {
    Edge,
    EdgeContainer,
    Edges,
    ElementParts,
    FeatureMembershipMeta,
    FeatureMeta,
    InheritanceMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityRangeMeta,
    NamespaceMeta,
    NamespaceOptions,
    NonNullRelationship,
    OwningMembershipMeta,
    RestEdges,
    SpecializationMeta,
    TargetType,
} from "./_internal";
import { Class } from "ts-mixer/dist/types/types";

export const ImplicitTypes = {
    base: "Base::Anything",
};

export type HeritageEdge = Edges<InheritanceMeta>;
export type TypeRelationshipMeta = TypeRelationship["$meta"];
export type FeatureRelationshipMeta = FeatureRelationship["$meta"];
export type TypeRelationshipEdge = Edges<TypeRelationshipMeta>;
export type FeatureRelationshipEdge = Edges<FeatureRelationshipMeta>;

export function typeHeritage<T extends InheritanceMeta[]>(
    ...children: RestEdges<T>
): EdgeContainer<InheritanceMeta> {
    return EdgeContainer.make(...children);
}

export function typeRelationships<T extends TypeRelationshipMeta[]>(
    ...children: RestEdges<T>
): EdgeContainer<TypeRelationshipMeta> {
    return EdgeContainer.make(...children);
}

export interface TypeOptions extends NamespaceOptions {
    isAbstract?: boolean;
    isSufficient?: boolean;
    multiplicity?: Edge<OwningMembershipMeta, MultiplicityRangeMeta>;
    heritage?: EdgeContainer<InheritanceMeta>;
    typeRelationships?: EdgeContainer<TypeRelationshipMeta>;
}

@metamodelOf(Type, ImplicitTypes)
export class TypeMeta extends Mixin(
    InputParametersMixin,
    NamespaceMeta as Class<[ElementID], NamespaceMeta, typeof NamespaceMeta>
) {
    protected readonly _heritage = new ElementContainer<Inheritance>();
    protected readonly _typeRelationships = new ElementContainer<FeatureRelationship>();
    protected _isAbstract = false;
    protected _classifier: TypeClassifier = TypeClassifier.None;

    protected _multiplicity: OwningMembershipMeta<MultiplicityRangeMeta> | undefined;
    protected _isSufficient = false;
    get isSufficient(): boolean {
        return this._isSufficient;
    }
    set isSufficient(value) {
        this._isSufficient = value;
    }

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
    set multiplicity(value: Edge<OwningMembershipMeta, MultiplicityRangeMeta> | undefined) {
        this._multiplicity = this.swapEdgeOwnership(this._multiplicity, value);
    }

    @enumerable
    get heritage(): readonly InheritanceMeta[] {
        return this._heritage.all;
    }

    /**
     * Adds potentially owned heritage and returns the new number of heritage
     * relationships. Heritage with owned sources or non-type parents are not
     * taken ownership of.
     */
    addHeritage<T extends InheritanceMeta[]>(...value: RestEdges<T>): number {
        return this.addDeclaredRelationship(
            this._heritage,
            value.filter(
                ([_, target]) => !target.is(Feature) || target.basicFeature() !== (this as TypeMeta)
            ),
            this.onHeritageAdded,
            this
        );
    }

    /**
     * Removes heritage by value and returns the new number of heritage
     * relationships.
     */
    removeHeritage(...value: readonly InheritanceMeta[]): number {
        const removed: InheritanceMeta[] = [];
        const count = this.removeDeclaredRelationship(this._heritage, value, (v) =>
            removed.push(v)
        );

        if (removed.length > 0) this.onHeritageRemoved(removed);
        return count;
    }

    /**
     * Removes heritage by predicate and returns the new number of heritage
     * relationships.
     */
    removeHeritageIf(predicate: (value: InheritanceMeta) => boolean): number {
        const removed: InheritanceMeta[] = [];
        const count = this.removeDeclaredRelationshipIf(this._heritage, predicate, (v) =>
            removed.push(v)
        );
        if (removed.length > 0) this.onHeritageRemoved(removed);
        return count;
    }

    @enumerable
    get typeRelationships(): readonly FeatureRelationshipMeta[] {
        return this._typeRelationships.all;
    }

    typeRelationshipsOf<K extends SubtypeKeys<TypeRelationship>>(
        kind: K
    ): readonly SysMLInterface<K>["$meta"][] {
        return this._typeRelationships.get(kind);
    }

    /**
     * Adds potentially owned type relationships and returns the new number of
     * type relationships. Relationships with owned sources or non-type parents
     * are not taken ownership of.
     */
    addTypeRelationship<T extends TypeRelationshipMeta[]>(...element: RestEdges<T>): number {
        return this.addDeclaredRelationship(this._typeRelationships, element);
    }

    /**
     * Removes type relationships by value and returns the new number of type
     * relationships.
     */
    removeTypeRelationship(...element: TypeRelationshipMeta[]): number {
        return this.removeDeclaredRelationship(this._typeRelationships, element);
    }

    /**
     * Removes type relationships by predicate and returns the new number of type
     * relationships.
     */
    removeTypeRelationshipIf(predicate: (value: FeatureRelationshipMeta) => boolean): number {
        return this.removeDeclaredRelationshipIf(this._typeRelationships, predicate);
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
     * Stream of direct supertypes types matching {@link kind}
     * @param kind specialization kind filter
     */
    supertypes<K extends SubtypeKeys<Inheritance>>(kind: K): Stream<TypeMeta>;
    supertypes<K extends SubtypeKeys<Inheritance> | undefined>(kind: K): Stream<TypeMeta>;
    supertypes(kind?: undefined): Stream<TypeMeta>;
    supertypes<K extends SubtypeKeys<Inheritance>>(kind?: K): Stream<TypeMeta> {
        return stream(this.specializations(kind))
            .map((s) => s.element())
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
        const self = SpecializationMeta.create(() => -1, this.document);
        self["setElement"](this);
        const tree = new TreeStreamImpl<InheritanceMeta>(
            self,
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
        return tree.filter(BasicMetamodel.is(kind));
    }

    /**
     * Stream of all direct and indirect supertype specializations
     * @param kind specialization kind filter
     */
    allSupertypeSpecializations<K extends SubtypeKeys<Inheritance>>(
        kind: K
    ): Stream<InheritanceMeta>;
    // prettier-ignore
    allSupertypeSpecializations<K extends SubtypeKeys<Inheritance> | undefined>(kind: K): Stream<InheritanceMeta>;
    allSupertypeSpecializations(kind?: undefined): Stream<InheritanceMeta>;
    allSupertypeSpecializations<K extends SubtypeKeys<Inheritance>>(
        kind?: K
    ): Stream<InheritanceMeta> {
        const visited = new Set<unknown>();
        const self = SpecializationMeta.create(() => -1, this.document);
        self["setElement"](this);
        const tree = new TreeStreamImpl<InheritanceMeta>(
            self,
            // avoid circular specializations, there probably should be a
            // warning
            (s) =>
                s
                    .element()
                    ?.specializations()
                    .filter((s) => {
                        const target = s.element();
                        if (visited.has(target)) return false;
                        visited.add(target);
                        return true;
                    }) ?? [],
            {
                includeRoot: false,
            }
        );

        if (!kind) return tree;
        return tree.filter(BasicMetamodel.is(kind));
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
     * Stream of all direct and indirect supertypes
     * @param kind specialization kind filter
     * @param includeSelf if true, also include itself
     */
    // prettier-ignore
    allSupertypes<K extends SubtypeKeys<Inheritance> | undefined>(kind: K, includeSelf?: boolean): Stream<TypeMeta>;
    allSupertypes(kind?: undefined, includeSelf?: boolean): Stream<TypeMeta>;
    allSupertypes<K extends SubtypeKeys<Inheritance> | undefined>(
        kind?: K,
        includeSelf = false
    ): Stream<TypeMeta> {
        const tree = this.allSupertypeSpecializations(kind)
            .map((s) => s.element())
            .nonNullable();
        if (includeSelf) return stream([this]).concat(tree);
        return tree;
    }

    /**
     * @param type qualified name or type AST node to check
     * @returns true if this type conforms directly or indirectly to
     * {@link type}, false otherwise
     */
    conforms(type: string | TypeMeta): boolean {
        if (typeof type === "string")
            return this.allTypes(undefined, true).some((t) => t?.qualifiedName === type);
        return this.allTypes(undefined, true).some((t) => t === type);
    }

    /**
     * @param type qualified name or type AST node to check
     * @returns true if this type specializes directly or indirectly
     * {@link type}, false otherwise
     */
    specializes(type: string | TypeMeta): boolean {
        const conjugator = this._heritage.get(Conjugation).at(0);
        if (conjugator) {
            return Boolean(conjugator.element()?.specializes(type));
        }

        if (typeof type === "string")
            return this.allSupertypes(undefined, true).some((t) => t?.qualifiedName === type);
        return this.allSupertypes(undefined, true).some((t) => t === type);
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
        SK extends SubtypeKeys<Inheritance>,
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
    protected onHeritageAdded(heritage: InheritanceMeta, target: TypeMeta): void {
        // empty
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onHeritageRemoved(heritage: InheritanceMeta[]): void {
        // empty
    }

    protected isDeclaredRelationship(element: FeatureRelationshipMeta | InheritanceMeta): boolean {
        const source = element.source();
        if (source && source.parent() === element) return false;
        const parent = element.parent();
        return Boolean(!parent || parent.is(Type));
    }

    protected maybeTakeOwnership(element: FeatureRelationshipMeta | InheritanceMeta): void {
        if (this.isDeclaredRelationship(element)) this.takeOwnership(element);
    }

    protected maybeUnsetOwnership(element: FeatureRelationshipMeta | InheritanceMeta): void {
        if (this.isDeclaredRelationship(element)) this.unsetOwnership(element);
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

    directionOf(feature: FeatureMeta, visited: Set<TypeMeta> = new Set()): FeatureDirectionKind {
        if (feature.owningType == this) {
            return feature.direction;
        }

        visited.add(this);

        const conjugator = this._heritage.get(Conjugation).at(0);
        if (conjugator) {
            const original = conjugator.element();
            if (!original || visited.has(original)) {
                return "none";
            }

            const direction = original.directionOf(feature, visited);
            return direction == "in" ? "out" : direction == "out" ? "in" : direction;
        }

        for (const spec of this.specializations()) {
            const general = spec.element();
            if (general && !visited.has(general)) {
                const direction = general.directionOf(feature, visited);
                if (direction != "none") {
                    return direction;
                }
            }
        }

        return "none";
    }

    ownedFeatureMemberships(): Stream<FeatureMembershipMeta> {
        return stream(this.featureMembers()).filter(BasicMetamodel.is(FeatureMembership));
    }

    ownedFeatures(): Stream<FeatureMeta> {
        return this.featuresByMembership(FeatureMembership);
    }

    ownedParameters(): Stream<FeatureMeta> {
        return this.ownedFeatures().filter((f) => f.isParameter);
    }

    protected addDeclaredRelationship<T extends InheritanceMeta | FeatureRelationshipMeta>(
        container: Pick<T[], "push" | "length">,
        value: Edge<T, TargetType<T>>[],
        callback?: (relationship: T, target: TargetType<T>) => void,
        thisObj?: unknown
    ): number {
        value.forEach(([relationship, target]) => {
            this.maybeTakeOwnership(relationship);
            relationship["setElement"](target as FeatureMeta);
            container.push(relationship);
            callback?.call(thisObj, relationship, target);
        });

        return container.length;
    }

    protected removeDeclaredRelationship<T extends InheritanceMeta | FeatureRelationshipMeta>(
        container: Pick<T[], "remove" | "length">,
        value: readonly T[],
        callback?: (value: T) => void
    ): number {
        value.forEach((item) => {
            if (container.remove(item)) {
                this.maybeUnsetOwnership(item);
                callback?.(item);
            }
        });

        return container.length;
    }

    protected removeDeclaredRelationshipIf<T extends InheritanceMeta | FeatureRelationshipMeta>(
        container: Pick<T[], "removeIf" | "length">,
        predicate: (value: T) => boolean,
        callback?: (value: T) => void
    ): number {
        return container.removeIf((value) => {
            if (predicate(value)) {
                this.maybeUnsetOwnership(value);
                callback?.(value);
                return true;
            }
            return false;
        });
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

    protected static applyTypeOptions(model: TypeMeta, options: TypeOptions): void {
        model._isAbstract = Boolean(options.isAbstract);
        if (options.multiplicity) model.multiplicity = options.multiplicity;
        if (options.heritage) model.addHeritage(...options.heritage["values"]);
        if (options.typeRelationships)
            model.addTypeRelationship(...options.typeRelationships["values"]);
        model.isSufficient = Boolean(options.isSufficient);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: TypeOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as TypeMeta;
        if (options) TypeMeta.applyTypeOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Type {
        $meta: TypeMeta;
    }
}
