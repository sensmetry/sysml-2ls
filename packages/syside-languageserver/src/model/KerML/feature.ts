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
    FeatureMembership,
    FeatureTyping,
    ParameterMembership,
    Redefinition,
    ReferenceSubsetting,
    ReturnParameterMembership,
    Step,
    Structure,
    Subsetting,
    Type,
} from "../../generated/ast";
import { FeatureDirectionKind, getFeatureDirectionKind, TypeClassifier } from "../enums";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { FeatureChainingMeta, FeatureValueMeta, TypeMeta } from "./_internal";
import { SpecializationType } from "../containers";
import { SysMLType } from "../../services/sysml-ast-reflection";
import { EMPTY_STREAM, stream, Stream } from "langium";

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
    /**
     * Featuring types
     */
    readonly featuredBy: TypeMeta[] = [];

    /**
     * Feature direction
     */
    direction: FeatureDirectionKind = "none";

    /**
     * Whether this feature is composite
     */
    isComposite = false;

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

    /**
     * Whether this feature is end
     */
    isEnd = false;

    chainings: FeatureChainingMeta[] = [];

    isOrdered = false;
    isNonUnique = false;

    get chainingFeatures(): FeatureMeta[] {
        return this.chainings
            .map((chaining) => chaining.element())
            .filter((e) => e) as FeatureMeta[];
    }

    value?: FeatureValueMeta;

    protected typings: undefined | TypeMeta[] = undefined;
    protected _owningType: TypeMeta | undefined;

    constructor(elementId: ElementID, parent: ModelContainer<Feature>) {
        super(elementId, parent);

        const owner = parent.parent();
        if (parent.is(FeatureMembership) && owner?.is(Type)) {
            this._owningType = owner;
            this.featuredBy.push(owner);
        }
    }

    get owningType(): TypeMeta | undefined {
        return this._owningType;
    }

    override initialize(node: Feature): void {
        this.value = undefined;
        FeatureMeta.prototype.reset.call(this, node);

        this.direction = getFeatureDirectionKind(node.direction);
        this.isPortion = !!node.isPortion;
        this.isComposite = !!node.isComposite || this.isPortion;
        this.isReadonly = !!node.isReadOnly;
        this.isDerived = !!node.isDerived;
        this.isEnd = !!node.isEnd || this.parent().is(EndFeatureMembership);

        this.isOrdered = node.isOrdered;
        this.isNonUnique = node.isNonunique;

        if (this.direction === "none" && this.parent().is(ParameterMembership)) {
            this.direction = this.parent().is(ReturnParameterMembership) ? "out" : "in";
        }
    }

    override reset(node: Feature): void {
        this.featuredBy.length = 0;
        if (this._owningType) this.featuredBy.push(this._owningType);
        if (node.value) this.value = node.value.$meta;
        this.isOrdered = node.isOrdered;
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

    override parent(): ModelContainer<Feature> {
        return this._parent;
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
        return owner.isAny([Behavior, Step]);
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
        return owner.is(Structure) || (owner.is(Feature) && owner.hasStructureType());
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
        return owner.is(Class) || (owner.is(Feature) && owner.hasClassType());
    }

    /**
     * @returns true if this feature is end feature and is owned by an
     * association of a connector
     */
    isAssociationEnd(): boolean {
        if (!this.isEnd) return false;
        const owner = this.owner();
        return owner.isAny([Association, Connector]);
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
        return this.direction !== "none" && this.owner().isAny([Behavior, Step]);
    }

    get isResultParameter(): boolean {
        return this.parent().is(ReturnParameterMembership);
    }

    override addSpecialization<T extends SpecializationType>(specialization: T): void {
        super.addSpecialization(specialization);

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
                    const existing = owner.children.get(name);
                    if (!existing) owner.children.set(name, "shadow");
                };

                if (feature.name) addShadow(feature.name);
                if (feature.shortName) addShadow(feature.shortName);
            }
        }
    }

    override specializationKind(): SysMLType {
        return Subsetting;
    }

    allTypings(): TypeMeta[] {
        if (!this.typings) return this.collectTypings();
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
}

declare module "../../generated/ast" {
    interface Feature {
        $meta: FeatureMeta;
    }
}
