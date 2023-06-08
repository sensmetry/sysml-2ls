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
    FeatureRelationship,
    FeatureTyping,
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
import { metamodelOf } from "../metamodel";
import {
    ElementMeta,
    ElementParts,
    FeatureChainingMeta,
    FeatureValueMeta,
    InheritanceMeta,
    OwningMembershipMeta,
    TypeFeaturingMeta,
    TypeMeta,
} from "./_internal";
import { SysMLType } from "../../services/sysml-ast-reflection";
import { EMPTY_STREAM, stream, Stream } from "langium";
import { NonNullable, enumerable } from "../../utils";

export const ImplicitFeatures = {
    base: "Base::things",
    dataValue: "Base::dataValues",
    occurrence: "Occurrences::occurrences",
    suboccurrence: "Occurrences::Occurrence::suboccurrences",
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

    isOrdered = false;
    isNonUnique = false;

    addFeatureRelationship(...element: FeatureRelationship["$meta"][]): this {
        this._typeRelationships.add(...element);
        element.forEach((e) => this.maybeTakeOwnership(e));
        return this;
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

    get chainingFeatures(): FeatureMeta[] {
        return this.chainings.map((chaining) => chaining.element()).filter(NonNullable);
    }

    protected _value?: FeatureValueMeta | undefined;
    get value(): FeatureValueMeta | undefined {
        return this._value;
    }
    set value(value: FeatureValueMeta | undefined) {
        this._value = value;
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

        const owner = current?.parent();
        if (current?.is(FeatureMembership) && owner?.is(Type)) {
            this._owningType = owner;
        }

        this._isImpliedEnd = Boolean(current?.is(EndFeatureMembership));
        this.computedImpliedDirection();
    }

    get owningType(): TypeMeta | undefined {
        return this._owningType;
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isAssociationEnd()) supertypes.push("participant");

        return supertypes;
    }

    override defaultSupertype(): string {
        if (this.hasStructureType()) return this.isSubobject() ? "subobject" : "object";
        if (this.hasClassType()) return this.isSuboccurrence() ? "suboccurrence" : "occurrence";
        if (this.hasDataType()) return "dataValue";
        return "base";
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

    protected override onSpecializationAdded(specialization: InheritanceMeta): void {
        super.onSpecializationAdded(specialization);

        this.typings = undefined;

        if (!this.isOrdered && specialization.is(Subsetting)) {
            if (specialization.element()?.isOrdered) this.isOrdered = true;
        }

        if (!this.name && !this.shortName) {
            const namingFeature = this.namingFeature();
            if (namingFeature) {
                if (namingFeature.name) this.setName(namingFeature.name);
                if (namingFeature.shortName) this.setShortName(namingFeature.shortName);
            }
        }

        if (specialization.is(Redefinition)) {
            // add a tombstone to the owning type children to signify that the
            // redefined feature is no longer accessible through it
            const feature = specialization.finalElement();
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

    override specializationKind(): SysMLType {
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
                    .filter((t) => t.is(Feature))
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

    isFeaturedBy(type: TypeMeta): boolean {
        return this.featuredBy.some(
            (t) => t.conforms(type) || (t.is(Feature) && t.isFeaturedBy(type))
        );
    }

    override ownedParameters(): Stream<FeatureMeta> {
        return TypeMeta.prototype.ownedParameters.call(this.basicFeature());
    }

    override textualParts(): ElementParts {
        const parts: ElementParts = {
            prefixes: this.prefixes,
        };

        if (this.parent()?.is(EndFeatureMembership)) {
            parts.heritage = this.heritage;
            if (this._multiplicity) {
                parts.multiplicity = [this._multiplicity];
            }
        } else {
            if (this._multiplicity) {
                parts.multiplicity = [this._multiplicity];
            }
            parts.heritage = this.heritage;
        }

        parts.typeRelationships = this.typeRelationships;

        if (this.value) {
            parts.value = [this.value];
        }

        parts.children = this.children;

        return parts;
    }
}

declare module "../../generated/ast" {
    interface Feature {
        $meta: FeatureMeta;
    }
}
