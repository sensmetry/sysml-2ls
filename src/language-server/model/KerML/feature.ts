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
    Connector,
    Feature,
    Result,
    Step,
    Structure,
} from "../../generated/ast";
import {
    FeatureDirectionKind,
    getFeatureDirectionKind,
    SpecializationKind,
    TypeClassifier,
} from "../enums";
import { TypeMeta } from "./type";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { castToRelated, FeatureValueMeta, InlineExpressionMeta, Related } from "./_internal";
import { SpecializationSource } from "../containers";

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
    readonly featuredBy = new Set<TypeMeta>();

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

    value?: Related<InlineExpressionMeta, FeatureValueMeta>;

    constructor(elementId: ElementID, parent: ModelContainer<Feature>) {
        super(elementId, parent);
    }

    override initialize(node: Feature): void {
        this.value = undefined;
        this.reset(node);
        if (!node.declaredName && node.redefines.length > 0) {
            const newName = node.redefines[0].chain.at(-1)?.$refText;
            if (newName) this.setName(newName);
        }

        this.direction = getFeatureDirectionKind(node.direction);
        this.isComposite = !!node.isComposite;
        this.isPortion = !!node.isPortion;
        this.isReadonly = !!node.isReadOnly;
        this.isDerived = !!node.isDerived;
        this.isEnd =
            !!node.isEnd ||
            (node.$container.$meta.is(Connector) && node.$containerProperty === "ends");
    }

    override reset(node: Feature): void {
        this.featuredBy.clear();
        if (node.value) this.value = castToRelated(node.value.$meta);
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

    override self(): Feature | undefined {
        return super.deref() as Feature;
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
    protected isEnclosedPerformance(): boolean {
        const owner = this.parent();
        return owner.isAny([Behavior, Step]);
    }

    /**
     * @returns true if this feature is composite and is enclosed performance,
     * false otherwise
     */
    protected isSubperformance(): boolean {
        return this.isComposite && this.isEnclosedPerformance();
    }

    /**
     * @returns true if this feature is composite and is owned by a structure
     * type or a feature specializing a structure type, false otherwise
     */
    protected isSubobject(): boolean {
        if (!this.isComposite) return false;
        const owner = this.parent();
        return owner.is(Structure) || (owner.is(Feature) && owner.hasStructureType());
    }

    /**
     * @returns same as {@link FeatureMeta.isSubobject isSubobject}
     */
    protected isOwnedPerformance(): boolean {
        return this.isSubobject();
    }

    /**
     * @returns true if this feature is composite and is owned by a class type
     * or a feature specializing a class type, false otherwise
     */
    protected isSuboccurrence(): boolean {
        if (!this.isComposite) return false;
        const owner = this.parent();
        return owner.is(Class) || (owner.is(Feature) && owner.hasClassType());
    }

    /**
     * @returns true if this feature is end feature and is owned by an
     * association of a connector
     */
    isAssociationEnd(): boolean {
        if (!this.isEnd) return false;
        const owner = this.parent();
        return owner.isAny([Association, Connector]);
    }

    /**
     * Feature that provides the name for this feature. Itself if it was named,
     * otherwise the naming feature of the first redefinition
     */
    get namingFeature(): (Feature & { declaredName: string }) | undefined {
        const feature = this.self();
        if (!feature) return;
        if (feature.declaredName) return feature as Feature & { declaredName: string };
        const redefinitions = this.specializations(SpecializationKind.Redefinition);
        if (redefinitions.length === 0) return undefined;
        // redefinitions are always features
        return (redefinitions[0].type as FeatureMeta).namingFeature;
    }

    isIgnoredParameter(): boolean {
        return this.isResultParameter;
    }

    get isParameter(): boolean {
        // parameter if direction was specified explicitly
        const parent = this.parent();
        return parent.isAny([Behavior, Step]) && this.direction !== "none";
    }

    get isResultParameter(): boolean {
        return this.parent().is(Result);
    }

    override addSpecialization(
        type: TypeMeta,
        kind: SpecializationKind,
        source?: SpecializationSource
    ): void {
        super.addSpecialization(type, kind, source);

        if (kind !== SpecializationKind.Redefinition || this.name) return;
        const namingFeature = this.namingFeature;
        if (namingFeature) this.setName(namingFeature.declaredName);
    }

    override specializationKind(): SpecializationKind {
        return SpecializationKind.Subsetting;
    }
}

declare module "../../generated/ast" {
    interface Feature {
        $meta: FeatureMeta;
    }
}
