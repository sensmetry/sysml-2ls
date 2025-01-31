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

import {
    Association,
    Behavior,
    Class,
    Conjugation,
    Connector,
    EndFeatureMembership,
    Feature,
    FeatureChaining,
    FeatureMembership,
    FeatureTyping,
    Inheritance,
    ParameterMembership,
    Redefinition,
    ReferenceSubsetting,
    ReturnParameterMembership,
    Step,
    Structure,
    Subsetting,
    Type,
    TypeFeaturing,
} from "../../generated/ast";
import { FeatureDirectionKind, TypeClassifier } from "../enums";
import {
    BasicMetamodel,
    ElementIDProvider,
    GeneralType,
    MetatypeProto,
    metamodelOf,
} from "../metamodel";
import {
    ConjugationMeta,
    Edge,
    EdgeContainer,
    ElementMeta,
    ElementParts,
    FeatureChainingMeta,
    FeatureRelationshipMeta,
    FeatureTypingMeta,
    FeatureValueMeta,
    InheritanceMeta,
    OwningMembershipMeta,
    RedefinitionMeta,
    RestEdges,
    SubsettingMeta,
    TypeFeaturingMeta,
    TypeMeta,
    TypeOptions,
    TypeRelationshipMeta,
} from "./_internal";
import { SubtypeKeys, SysMLType } from "../../services/sysml-ast-reflection";
import { AstNode, EMPTY_STREAM, LangiumDocument, stream, Stream, TreeStreamImpl } from "langium";
import { NonNullable, enumerable } from "../../utils";

export const ImplicitFeatures = {
    base: "Base::things",
    dataValue: "Base::dataValues",
    occurrence: "Occurrences::occurrences",
    suboccurrence: "Occurrences::Occurrence::suboccurrences",
    portion: "Occurrences::Occurrence::portions",
    object: "Objects::objects",
    subobject: "Objects::Object::subobjects",
    participant: "Links::Link::participant",
    // TODO
    startingAt:
        "FeatureReferencingPerformances::FeatureAccessPerformance::onOccurrence::startingAt",
    // TODO
    accessedFeature:
        "FeatureReferencingPerformances::FeatureAccessPerformance::onOccurrence::startingAt::accessedFeature",
};

// typing needs some help
type FeatureRelationshipContainer = EdgeContainer<FeatureRelationshipMeta> &
    EdgeContainer<TypeRelationshipMeta>;

export function featureRelationships<T extends FeatureRelationshipMeta[]>(
    ...children: RestEdges<T>
): FeatureRelationshipContainer {
    // disable type checking here since tsc chokes on it
    return EdgeContainer.make(...children) as unknown as FeatureRelationshipContainer;
}

export interface FeatureOptions extends TypeOptions {
    direction?: FeatureDirectionKind;
    isComposite?: boolean;
    isPortion?: boolean;
    isReadonly?: boolean;
    isDerived?: boolean;
    isEnd?: boolean;
    isOrdered?: boolean;
    isNonUnique?: boolean;

    heritage?: EdgeContainer<SubsettingMeta | FeatureTypingMeta | ConjugationMeta<FeatureMeta>>;
    typeRelationships?: FeatureRelationshipContainer;
    value?: Edge<FeatureValueMeta>;
}

// TODO: isOrdered, name, shortName, typings can become stale if heritage
// targets are mutated

@metamodelOf(Feature, ImplicitFeatures)
export class FeatureMeta extends TypeMeta {
    protected _direction: FeatureDirectionKind = "none";
    protected _impliedDirection?: "out" | "in";

    /**
     * Feature direction
     */
    @enumerable
    get direction(): FeatureDirectionKind {
        return this._impliedDirection ?? this._direction;
    }
    set direction(value) {
        this._direction = value;
        this.computedImpliedDirection();
    }
    get explicitDirection(): FeatureDirectionKind {
        return this._direction;
    }
    protected computedImpliedDirection(): void {
        const parent = this.parent();
        if (this._direction === "none" && parent?.is(ParameterMembership)) {
            this._impliedDirection = parent.is(ReturnParameterMembership) ? "out" : "in";
        } else {
            this._impliedDirection = undefined;
        }
    }

    protected _isComposite = false;
    /**
     * Whether this feature is composite
     */
    @enumerable
    get isComposite(): boolean {
        return this._isComposite;
    }
    set isComposite(value) {
        this._isComposite = value;
    }

    /**
     * Whether this feature is portion
     */
    isPortion = false;

    /**
     * Whether this feature is readonly
     */
    isReadonly = false;

    /**
     * Whether this feature is derived
     */
    isDerived = false;

    protected _isEnd = false;
    protected _isImpliedEnd = false;

    /**
     * Whether this feature is end
     */
    @enumerable
    get isEnd(): boolean {
        return this._isImpliedEnd || this._isEnd;
    }
    set isEnd(value) {
        this._isEnd = value;
    }
    get isEndExplicitly(): boolean {
        return this._isEnd;
    }

    protected _isOrdered = false;
    protected _impliedIsOrdered = false;
    protected _isNonUnique = false;

    @enumerable
    get isOrdered(): boolean {
        return this._isOrdered || this._impliedIsOrdered;
    }
    set isOrdered(value) {
        this._isOrdered = value;
    }
    get isOrderedExplicitly(): boolean {
        return this._isOrdered;
    }

    @enumerable
    get isNonUnique(): boolean {
        return this._isNonUnique;
    }
    set isNonUnique(value) {
        this._isNonUnique = value;
    }

    /**
     * Adds potentially owned feature relationships and returns the new number of
     * feature relationships. Relationships with owned sources or non-type parents
     * are not taken ownership of.
     */
    addFeatureRelationship<T extends FeatureRelationshipMeta[]>(...element: RestEdges<T>): number {
        return this.addDeclaredRelationship(this._typeRelationships, element);
    }

    /**
     * Removes feature relationships by value and returns the new number of feature
     * relationships.
     */
    removeFeatureRelationship(...element: FeatureRelationshipMeta[]): number {
        return this.removeDeclaredRelationship(this._typeRelationships, element);
    }

    /**
     * Removes feature relationships by predicate and returns the new number of feature
     * relationships.
     */
    removeFeatureRelationshipIf(predicate: (value: FeatureRelationshipMeta) => boolean): number {
        return this.removeDeclaredRelationshipIf(this._typeRelationships, predicate);
    }

    get typeFeaturings(): readonly TypeFeaturingMeta[] {
        return this._typeRelationships.get(TypeFeaturing);
    }

    get featuredBy(): readonly TypeMeta[] {
        const featurings = this.typeFeaturings.map((f) => f.element()).filter(NonNullable);
        const chaining = this.chainings.at(0)?.element();
        if (chaining) featurings.push(...chaining.featuredBy);
        if (featurings.length === 0 && this._owningType) return [this._owningType];
        return featurings;
    }

    get chainings(): readonly FeatureChainingMeta[] {
        return this._typeRelationships.get(FeatureChaining);
    }

    get chainingFeatures(): readonly FeatureMeta[] {
        return this.chainings.map((chaining) => chaining.element()).filter(NonNullable);
    }

    get featureTarget(): FeatureMeta {
        return this.basicFeature();
    }

    protected _value?: FeatureValueMeta | undefined;
    get value(): FeatureValueMeta | undefined {
        return this._value;
    }
    set value(value: Edge<FeatureValueMeta> | undefined) {
        this._value = this.swapEdgeOwnership(this._value, value);
    }

    protected _write?: OwningMembershipMeta<FeatureMeta> | undefined;
    get featureWrite(): OwningMembershipMeta<FeatureMeta> | undefined {
        return this._value && !this._value.isDefault && this._value.isInitial
            ? this._write
            : undefined;
    }

    protected typings: undefined | TypeMeta[] = undefined;
    protected _owningType: TypeMeta | undefined;

    protected override onParentSet(
        previous: ElementMeta | undefined,
        current: ElementMeta | undefined
    ): void {
        super.onParentSet(previous, current);

        this._isImpliedEnd = Boolean(current?.is(EndFeatureMembership));
        this.computedImpliedDirection();
    }

    protected override onOwnerSet(
        previous: [ElementMeta, ElementMeta] | undefined,
        current: [ElementMeta, ElementMeta] | undefined
    ): void {
        if (current?.[0].is(FeatureMembership) && current?.[1].is(Type)) {
            this._owningType = current[1];
        } else {
            this._owningType = undefined;
        }
        super.onOwnerSet(previous, current);
    }

    get owningType(): TypeMeta | undefined {
        return this._owningType;
    }

    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isAssociationEnd()) supertypes.push("participant");

        return supertypes;
    }

    override defaultSupertype(): string {
        if (this.hasStructureType()) return this.isSubobject() ? "subobject" : "object";
        if (this.hasClassType())
            return this.isSuboccurrence()
                ? "suboccurrence"
                : this.isPortion
                  ? "portion"
                  : "occurrence";
        if (this.hasDataType()) return "dataValue";
        return "base";
    }

    protected isPortionImpl(): boolean {
        const owningType = this.owningType;
        if (!owningType) {
            return false;
        }
        return (
            this.isPortion &&
            (owningType.is(Class) || (owningType.is(Feature) && owningType.hasClassType()))
        );
    }

    override ast(): Feature | undefined {
        return this._ast as Feature;
    }
    /**
     * @returns true if this feature specializes any structure type, false
     * otherwise
     */
    hasStructureType(): boolean {
        return (this.classifier & TypeClassifier.Structure) === TypeClassifier.Structure;
    }

    /**
     * @returns true if this feature specializes any class type, false otherwise
     */
    hasClassType(): boolean {
        return (this.classifier & TypeClassifier.Class) === TypeClassifier.Class;
    }

    /**
     * @returns true if this feature specializes any data type, false otherwise
     */
    hasDataType(): boolean {
        return (this.classifier & TypeClassifier.DataType) === TypeClassifier.DataType;
    }

    /**
     * @returns true if this feature specializes any association type, false
     * otherwise
     */
    hasAssociation(): boolean {
        return (this.classifier & TypeClassifier.Association) === TypeClassifier.Association;
    }

    /**
     * @returns true if this feature is owned by a behavior or step, false
     * otherwise
     */
    protected isBehaviorOwned(): boolean {
        const owner = this.owner();
        return Boolean(owner?.isAny(Behavior, Step));
    }

    /**
     * @returns true if this feature is composite and is enclosed performance,
     * false otherwise
     */
    protected isBehaviorOwnedComposite(): boolean {
        return this.isComposite && this.isBehaviorOwned();
    }

    /**
     * @returns true if this feature is composite and is owned by a structure
     * type or a feature specializing a structure type, false otherwise
     */
    protected isSubobject(): boolean {
        if (!this.isComposite) return false;
        const owner = this.owner();
        return Boolean(owner?.is(Structure) || (owner?.is(Feature) && owner.hasStructureType()));
    }

    /**
     * @returns same as {@link FeatureMeta.isSubobject isSubobject}
     */
    protected isStructureOwnedComposite(): boolean {
        return this.isSubobject();
    }

    /**
     * @returns true if this feature is composite and is owned by a class type
     * or a feature specializing a class type, false otherwise
     */
    protected isSuboccurrence(): boolean {
        if (!this.isComposite) return false;
        const owner = this.owner();
        return Boolean(owner?.is(Class) || (owner?.is(Feature) && owner.hasClassType()));
    }

    /**
     * @returns true if this feature is end feature and is owned by an
     * association of a connector
     */
    isAssociationEnd(): boolean {
        if (!this.isEnd) return false;
        const owner = this.owner();
        return Boolean(owner?.isAny(Association, Connector));
    }

    /**
     * Feature that provides the name for this feature. Itself if it was named,
     * otherwise the naming feature of the first redefinition
     */
    namingFeature(): FeatureMeta | undefined {
        return this.types(Redefinition).head() as FeatureMeta | undefined;
    }

    isFeaturedWithin(type: TypeMeta | undefined): boolean {
        if (type === undefined) {
            return (
                this.featuredBy.length == 0 ||
                (this.featuredBy.length == 1 &&
                    this.featuredBy[0].qualifiedName == "Base::Anything")
            );
        }

        if (this.featuredBy.length == 0) {
            // implicitly featured by Base::Anything which every type is subtype of
            // we do not add implicit featuring yet
            return true;
        }

        return this.featuredBy.every((f) => type.specializes(f));
    }

    allRedefinitions(): Stream<RedefinitionMeta> {
        const visited = new Set<unknown>();
        const self = RedefinitionMeta.create(() => -1, this.document);
        self["setElement"](this);
        return new TreeStreamImpl<RedefinitionMeta>(
            self,
            (s) =>
                s
                    .element()
                    ?._heritage.get(Redefinition)
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
    }

    allRedefinedFeatures(): Stream<FeatureMeta> {
        return this.allRedefinitions()
            .map((r) => r.element())
            .filter(NonNullable);
    }

    referencedFeature<K extends SysMLType>(kind?: K): FeatureMeta | undefined {
        const feature = this.types(ReferenceSubsetting).head() as FeatureMeta | undefined;
        if (kind) return feature?.is(kind) ? feature : this;
        return feature;
    }

    basicFeature(): FeatureMeta {
        return this.chainings.at(-1)?.element() ?? this;
    }

    isIgnoredParameter(): boolean {
        return this.isResultParameter;
    }

    get isParameter(): boolean {
        // parameter if direction was specified explicitly
        return Boolean(this.direction !== "none" && this.owner()?.isAny(Behavior, Step));
    }

    get isResultParameter(): boolean {
        return Boolean(this.parent()?.is(ReturnParameterMembership));
    }

    recomputeEffectiveNames(): void {
        if (this.declaredName || this.declaredShortName) return;
        this.updateEffectiveNames();
    }

    protected updateEffectiveNames(): void {
        const namingFeature = this.namingFeature();
        if (namingFeature) {
            if (namingFeature.name) this.setName(namingFeature.name);
            if (namingFeature.shortName) this.setShortName(namingFeature.shortName);
        } else {
            if (this.name) this.setName(undefined);
            if (this.shortName) this.setShortName(undefined);
        }
    }

    protected override onHeritageAdded(heritage: InheritanceMeta, target: TypeMeta): void {
        super.onHeritageAdded(heritage, target);

        this.typings = undefined;

        if (!this._impliedIsOrdered && heritage.is(Subsetting)) {
            if (heritage.finalElement()?.isOrdered) this._impliedIsOrdered = true;
        }

        if (!this.name && !this.shortName) {
            this.updateEffectiveNames();
        }

        if (heritage.is(Redefinition)) {
            // add a tombstone to the owning type children to signify that the
            // redefined feature is no longer accessible through it
            const feature = heritage.finalElement();
            const owner = this.owningType;
            if (owner && feature) {
                const addShadow = (name: string): void => {
                    const existing = owner.findMember(name);
                    if (!existing) owner["_memberLookup"].set(name, "shadow");
                };

                if (feature.name) addShadow(feature.name);
                if (feature.shortName) addShadow(feature.shortName);
            }
        }
    }

    protected override onHeritageRemoved(heritage: InheritanceMeta[]): void {
        super.onHeritageRemoved(heritage);
        this.typings = undefined;

        if (
            this._impliedIsOrdered &&
            heritage.some((h) => h.is(Subsetting) && h.finalElement()?.isOrdered)
        ) {
            this._impliedIsOrdered = this.heritage.some(
                (h) => h.is(Subsetting) && h.finalElement()?.isOrdered
            );
        }

        this.recomputeEffectiveNames();

        const lookup = this.owningType?.["_memberLookup"];
        if (!lookup) return;
        heritage
            .filter(BasicMetamodel.is(Redefinition))
            .map((r) => r.finalElement())
            .filter(NonNullable)
            .forEach((feature) => {
                const removeShadow = (name: string): void => {
                    const existing = lookup.get(name);
                    if (existing === "shadow") lookup.delete(name);
                };

                if (feature.name) removeShadow(feature.name);
                if (feature.shortName) removeShadow(feature.shortName);
            });
    }

    override specializationKind(): SubtypeKeys<Inheritance> {
        return Subsetting;
    }

    allTypings(recompute = false): TypeMeta[] {
        if (!this.typings || recompute) return this.collectTypings();
        return this.typings;
    }

    private collectTypings(): TypeMeta[] {
        const types = this.collectInheritedTypes(new Set()).distinct().toArray();
        this.typings = types.filter((t) => types.every((type) => type === t || !type.conforms(t)));
        return this.typings;
    }

    private collectDirectTypes(visited: Set<FeatureMeta>): Stream<TypeMeta> {
        const types = this.types(FeatureTyping);

        const lastChaining = this.chainingFeatures.at(-1);
        if (lastChaining) {
            return types.concat(lastChaining.collectInheritedTypes(visited));
        }

        return types;
    }

    private collectInheritedTypes(visited: Set<FeatureMeta>): Stream<TypeMeta> {
        if (visited.has(this)) return EMPTY_STREAM;
        visited.add(this);

        return stream(
            this.collectDirectTypes(visited),
            ...([Conjugation, Subsetting] as const).map((kind) =>
                this.types(kind)
                    .filter(BasicMetamodel.is(Feature))
                    .flatMap((f) => (f as FeatureMeta).collectInheritedTypes(visited))
            )
        );
    }

    allFeaturingTypes(): TypeMeta[] {
        // no real queue in TS/JS...
        let queue: FeatureMeta[] = [this];
        const types = new Set<TypeMeta>();

        while (queue.length > 0) {
            const next: FeatureMeta[] = [];
            for (const feature of queue) {
                for (const type of feature.featuredBy) {
                    if (types.has(type)) continue;
                    types.add(type);
                    if (type.is(Feature)) next.push(type);
                }
            }

            queue = next;
        }

        return Array.from(types);
    }

    override ownedParameters(): Stream<FeatureMeta> {
        return TypeMeta.prototype.ownedParameters.call(this.basicFeature());
    }

    protected override collectDeclaration(parts: ElementParts): void {
        if (this.parent()?.is(EndFeatureMembership)) {
            parts.push(["heritage", this.heritage]);
            if (this._multiplicity) {
                parts.push(["multiplicity", [this._multiplicity]]);
            }
        } else {
            if (this._multiplicity) {
                parts.push(["multiplicity", [this._multiplicity]]);
            }
            parts.push(["heritage", this.heritage]);
        }

        parts.push(["typeRelationships", this.typeRelationships]);

        if (this.value) {
            parts.push(["value", [this.value]]);
            if (this.featureWrite) parts.push(["featureWrite", [this.featureWrite]]);
        }
    }

    protected static applyFeatureOptions(model: FeatureMeta, options: FeatureOptions): void {
        model._direction = options.direction ?? "none";
        model._isComposite = Boolean(options.isComposite);
        model.isPortion = Boolean(options.isPortion);
        model.isReadonly = Boolean(options.isReadonly);
        model.isDerived = Boolean(options.isDerived);
        model._isEnd = Boolean(options.isEnd);
        model.isOrdered = Boolean(options.isOrdered);
        model.isNonUnique = Boolean(options.isNonUnique);

        if (options.value) model.value = options.value;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: FeatureOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as FeatureMeta;
        if (options) FeatureMeta.applyFeatureOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Feature {
        $meta: FeatureMeta;
    }
}
