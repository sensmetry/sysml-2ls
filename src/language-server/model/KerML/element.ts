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

import { Stream, stream } from "langium";
import { Element, Membership, MetadataFeature } from "../../generated/ast";
import { SysMLNodeDescription } from "../../services/shared/workspace/ast-descriptions";
import { BasicMetamodel, ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { computeQualifiedName, Name } from "../naming";
import {
    CommentMeta,
    DocumentationMeta,
    FeatureMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    NamespaceMeta,
    RelationshipMeta,
} from "./_internal";

@metamodelOf(Element, "abstract")
export abstract class ElementMeta extends BasicMetamodel<Element> {
    /**
     * Namespace members
     */
    elements: MembershipMeta<NamespaceMeta>[] = [];

    /**
     * Relationship members
     */
    relationships: MembershipMeta<RelationshipMeta>[] = [];

    /**
     * Feature members
     */
    features: MembershipMeta<FeatureMeta>[] = [];

    /**
     * Comments about this element
     */
    comments: CommentMeta[] = [];

    /**
     * Metadata about this element
     */
    metadata: MetadataFeatureMeta[] = [];

    /**
     * Documentation about this element
     */
    docs: DocumentationMeta[] = [];

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
    description?: SysMLNodeDescription;

    /**
     * List of direct children
     */
    readonly children = new Map<string, MembershipMeta>();

    /**
     * Library metaclass of this element
     */
    metaclass: MetadataFeatureMeta | undefined;

    constructor(elementId: ElementID, parent: ModelContainer<Element>) {
        super(elementId, parent);
    }

    override initialize(node: Element): void {
        if (node.declaredName) this.setName(node.declaredName);
        if (node.declaredShortName) this.setShortName(node.declaredShortName);

        // namespaces can have no $container but the type system doesn't warn
        // against it, probably an issue in langium
        this.qualifiedName = computeQualifiedName(this, node.$container?.$meta);

        this.collectChildrenNodes(node);
    }

    /**
     * @returns Implicit generalization identifier
     */
    override defaultSupertype(): string {
        return "base";
    }

    override ast(): Element | undefined {
        return this._ast as Element;
    }

    override parent(): ModelContainer<Element> {
        return this._parent;
    }

    override owner(): ElementMeta | undefined {
        return this._owner as ElementMeta | undefined;
    }

    override reset(node: Element): void {
        this.relationships.length = 0;
        this.features.length = 0;
        this.elements.length = 0;
        this.comments.length = 0;
        this.docs.length = 0;
        this.collectChildrenNodes(node);
        delete this.metaclass;
    }

    private collectChildrenNodes(node: Element): void {
        this.metadata = node.prefixes.map((m) => (m.element as MetadataFeature).$meta);

        this.collectChildren(node);
    }

    protected abstract collectChildren(node: Element): void;

    /**
     * @returns stream of all owned and inherited metadata features
     */
    allMetadata(): Stream<MetadataFeatureMeta> {
        return stream(this.metadata);
    }

    /**
     * @returns stream of all owned and inherited features
     */
    allFeatures(): Stream<MembershipMeta<FeatureMeta>> {
        return stream(this.features);
    }

    /**
     * Add a {@link child} to this element scope
     */
    addChild(child: MembershipMeta<ElementMeta>): void {
        const meta = child.element();
        if (child.name || child.shortName) {
            if (child.name) this.children.set(child.name, child);
            if (child.shortName) this.children.set(child.shortName, child);
        } else {
            if (meta?.name) this.children.set(meta.name, child);
            if (meta?.shortName) this.children.set(meta.shortName, child);
        }
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
        return this._name.declared;
    }

    /**
     * @param name new name
     */
    setName(name: string): void {
        const old = this.name;
        this.updateName(this._name, name);
        const parent = this.parent();
        if (parent?.is(Membership) && parent.name === old && parent.shortName === this.shortName)
            parent.updateName(parent._name, name);
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
        return this._shortName.declared;
    }

    /**
     * @param name new short name
     */
    setShortName(name: string): void {
        const old = this.shortName;
        this.updateName(this._shortName, name);
        const parent = this.parent();
        if (parent?.is(Membership) && parent.shortName === old && parent.name === this.name)
            parent.updateName(parent._shortName, name);
    }

    /**
     * @param name name to update
     * @param exported description corresponding to {@link name} (either full or short name)
     * @param value new name
     */
    private updateName(name: Name, value: string): void {
        const parent = this.parent();
        const basicParent = parent?.is(Membership) ? parent : undefined;
        const owner = basicParent?.parent() as ElementMeta | undefined;
        // remove this child
        if (name.sanitized && owner) owner.children.delete(name.sanitized);

        // update names
        name.set(value);
        this.qualifiedName = computeQualifiedName(this, parent);

        if (name.sanitized && name.sanitized.length > 0) {
            if (owner && !owner.children.has(name.sanitized)) {
                owner.children.set(name.sanitized, basicParent as MembershipMeta);
            }
        }
    }
}

declare module "../../generated/ast" {
    interface Element {
        $meta: ElementMeta;
    }
}
