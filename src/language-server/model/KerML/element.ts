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
    Comment,
    Documentation,
    Element,
    Feature,
    MetadataFeature,
    Relationship,
    isElement,
    isFeature,
    isRelationship,
} from "../../generated/ast";
import { VisibilityMeta } from "./visibility-element";
import { metamodelOf, ElementID } from "../metamodel";
import { Stream, stream } from "langium";
import { Name, computeQualifiedName } from "../naming";
import { SysMLNodeDescription } from "../../services/shared/workspace/ast-descriptions";

@metamodelOf(Element)
export class ElementMeta extends VisibilityMeta {
    /**
     * Owned elements (not relationships and features)
     */
    elements: Element[] = [];

    /**
     * Owned relationships
     */
    relationships: Relationship[] = [];

    /**
     * Owned features
     */
    features: Feature[] = [];

    /**
     * Comments about this element
     */
    comments: Comment[] = [];

    /**
     * Metadata about this element
     */
    metadata: MetadataFeature[] = [];

    /**
     * Documentation about this element
     */
    docs: Documentation[] = [];

    /**
     * Regular name of this element
     */
    private readonly _name = new Name();
    private readonly _shortName = new Name();

    /**
     * Fully qualified name based on preferably name
     */
    qualifiedName = "";

    /**
     * Cached descriptions for this element based on names only
     */
    private regularDescription?: SysMLNodeDescription;
    private shortDescription?: SysMLNodeDescription;
    readonly descriptions: SysMLNodeDescription[] = [];

    /**
     * List of direct children
     */
    readonly children = new Map<string, SysMLNodeDescription>();

    /**
     * Library metaclass of this element
     */
    metaclass: MetadataFeature | undefined;

    constructor(node: Element, elementId: ElementID) {
        super(node, elementId);
    }

    override initialize(node: Element): void {
        this._name.set(node.name);
        this._shortName.set(node.shortName);

        // using raw names for easier disambiguation between
        this.qualifiedName = computeQualifiedName(this, node.$container);

        this.comments.push(...node.comments);
        this.docs.push(...node.docs);
        this.metadata.push(...node.prefixes, ...node.metadata);

        this.collectChildren();
    }

    /**
     * @returns Implicit generalization identifier
     */
    override defaultSupertype(): string {
        return "base";
    }

    override self(): Element {
        return super.deref() as Element;
    }

    override reset(): void {
        super.reset();
        this.collectChildren();
        delete this.metaclass;
    }

    protected collectChildren(): void {
        // features may be spread out over multiple member arrays so iterate
        // over all children
        const node = this.self();
        this.relationships.length = 0;
        this.features.length = 0;
        this.elements.length = 0;
        this.comments = [...node.comments];
        this.docs = [...node.docs];
        this.metadata = [...node.prefixes, ...node.metadata];
        this.filterAbout();

        for (const child of node.$children) {
            if (!isElement(child)) continue;
            this.addChild(child);

            if (isFeature(child)) this.features.push(child);
            else if (isRelationship(child)) this.relationships.push(child);
            else this.elements.push(child);
        }
    }

    private filterAbout(): void {
        this.comments.filter((c) => c.about.length === 0);
        this.metadata.filter((m) => m.about.length === 0);
        // docs/reps cannot parse about so can be skipped
    }

    /**
     * @returns stream of all owned and inherited metadata features
     */
    allMetadata(): Stream<MetadataFeature> {
        return stream(this.metadata);
    }

    /**
     * @returns stream of all owned and inherited features
     */
    allFeatures(): Stream<Feature> {
        return stream(this.features);
    }

    /**
     * Add a {@link child} to this element scope
     */
    addChild(child: Element): void {
        const meta = child.$meta;
        if (meta.name && meta.regularDescription)
            this.children.set(meta.name, meta.regularDescription);
        if (meta.shortName && meta.shortDescription)
            this.children.set(meta.shortName, meta.shortDescription);
    }

    /**
     * Name to be used in reference resolution
     */
    get name(): string | undefined {
        return this._name.sanitized;
    }

    /**
     * Name as parsed
     */
    get rawName(): string | undefined {
        return this._name.raw;
    }

    /**
     * @param name new name
     */
    setName(name: string): void {
        this.updateName(this._name, this.regularDescription, name);
    }

    /**
     * Alternative name to be used in reference resolution
     * @see {@link name}
     */
    get shortName(): string | undefined {
        return this._shortName.sanitized;
    }

    /**
     * Short name as parsed
     */
    get rawShortName(): string | undefined {
        return this._shortName.raw;
    }

    /**
     * @param name new short name
     */
    setShortName(name: string): void {
        this.updateName(this._shortName, this.shortDescription, name);
    }

    private updateDescriptions(): void {
        this.descriptions.length = 0;

        if (this.name && this.regularDescription) this.descriptions.push(this.regularDescription);
        if (this.shortName && this.shortDescription) this.descriptions.push(this.shortDescription);
    }

    /**
     * @param name name to update
     * @param description description corresponding to {@link name} (either full or short name)
     * @param value new name
     */
    private updateName(
        name: Name,
        description: SysMLNodeDescription | undefined,
        value: string
    ): void {
        const parent = this.parent();
        const basicParent = isElement(parent) ? parent.$meta : undefined;
        // remove this child
        if (name.sanitized && basicParent) basicParent.children.delete(name.sanitized);

        // update names
        name.set(value);
        this.qualifiedName = computeQualifiedName(this, parent);

        if (!description || !name.sanitized) return;
        // add back this child if named
        description.name = name.sanitized;
        if (basicParent) basicParent.children.set(name.sanitized, description);
        this.updateDescriptions();
    }

    /**
     * Set descriptions that will be used to identify this element
     * @param regular Description for regular name
     * @param short Description for short name
     */
    addDescriptions(regular: SysMLNodeDescription, short: SysMLNodeDescription): void {
        this.regularDescription = regular;
        this.shortDescription = short;
        this.updateDescriptions();
    }
}

declare module "../../generated/ast" {
    interface Element {
        $meta: ElementMeta;
    }
}
