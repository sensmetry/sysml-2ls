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

import { Element, isElement, isFeature, isRelationship } from "../../generated/ast";
import { VisibilityMeta } from "./visibility-element";
import { metamodelOf, ElementID, ModelContainer, BasicMetamodel } from "../metamodel";
import { Stream, stream } from "langium";
import { Name, computeQualifiedName } from "../naming";
import { SysMLNodeDescription } from "../../services/shared/workspace/ast-descriptions";
import {
    CommentMeta,
    DocumentationMeta,
    FeatureMeta,
    MetadataFeatureMeta,
    RelationshipMeta,
} from "./_internal";

/**
 * Constrained relationship type with non-optional `element` member
 */
// TODO: change BasicMetamodel to ElementMeta and remove never
// TODO: infer T from R["element"]
export type Related<
    T extends BasicMetamodel = ElementMeta,
    R extends RelationshipMeta | object = object
> = R & {
    // concrete type element held by R
    element: T;
};

/**
 * Convenience function to cast `relationship` to `Related` type with non-optional `element`
 * @param relationship relationship to cast
 * @returns `Related` if `element` exists in `relationship` and `undefined` otherwise
 */
// TODO: ElementMeta and RelationshipMeta constraints
export function castToRelated<
    T extends BasicMetamodel,
    R extends BasicMetamodel & { element?: T | undefined | null }
>(relationship: R): Related<T, R> | undefined {
    if (relationship.element) return relationship as Related<T, R>;
    return;
}

export type Exported<
    T extends BasicMetamodel = ElementMeta,
    R extends RelationshipMeta | undefined = undefined
> = {
    /**
     * The exported element
     */
    element: T;

    /**
     * The name this element is exported with
     */
    name: string;

    /**
     * AST node description for parsed elements
     */
    description?: SysMLNodeDescription;
} & (R extends undefined
    ? object
    : {
          /**
           * The relationship {@link element} is related by to the exporting element
           */
          relationship: Related<T, NonNullable<R>>;
      });

@metamodelOf(Element)
export class ElementMeta extends VisibilityMeta {
    /**
     * Owned elements (not relationships and features), i.e. namespaces that are not features
     */
    // TODO: check if using NamespaceMeta works here
    elements: Related<ElementMeta>[] = [];

    /**
     * Owned relationships that don't fall into any other members
     */
    relationships: RelationshipMeta[] = [];

    /**
     * Owned features
     */
    features: Related<FeatureMeta>[] = [];

    /**
     * Comments about this element
     */
    comments: Related<CommentMeta>[] = [];

    /**
     * Metadata about this element
     */
    metadata: Related<MetadataFeatureMeta>[] = [];

    /**
     * Documentation about this element
     */
    docs: Related<DocumentationMeta>[] = [];

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
    private regularDescription: Exported;
    private shortDescription: Exported;
    get descriptions(): SysMLNodeDescription[] {
        return this.selfExports
            .filter((ex) => ex.description && ex.name.length > 0)
            .map((ex) => ex.description) as SysMLNodeDescription[];
    }
    readonly selfExports: Exported[] = [];

    /**
     * List of direct children
     */
    readonly children = new Map<string, Exported>();

    /**
     * Library metaclass of this element
     */
    metaclass: MetadataFeatureMeta | undefined;

    constructor(elementId: ElementID, parent: ModelContainer<Element>) {
        super(elementId, parent);

        this.regularDescription = {
            element: this,
            name: "",
        };
        this.shortDescription = {
            element: this,
            name: "",
        };
    }

    override initialize(node: Element): void {
        this._name.set(node.declaredName);
        this.regularDescription.name = this.name ?? "";
        this._shortName.set(node.declaredShortName);
        this.shortDescription.name = this.shortName ?? "";
        this.updateDescriptions();

        // namespaces can have no $container but the type system doesn't warn
        // against it, probably an issue in langium
        this.qualifiedName = computeQualifiedName(this, node.$container?.$meta);

        this.collectChildren(node);
    }

    /**
     * @returns Implicit generalization identifier
     */
    override defaultSupertype(): string {
        return "base";
    }

    override self(): Element | undefined {
        return super.deref() as Element;
    }

    override parent(): ModelContainer<Element> {
        return this._parent;
    }

    override reset(node: Element): void {
        this.collectChildren(node);
        delete this.metaclass;
    }

    protected collectChildren(node: Element): void {
        // features may be spread out over multiple member arrays so iterate
        // over all children
        this.relationships.length = 0;
        this.features.length = 0;
        this.elements.length = 0;

        // docs/reps cannot parse about so can be skipped
        this.comments = node.comments
            .filter((c) => c.about.length === 0)
            .map((c) => ({ element: c.$meta }));
        this.docs = node.docs.map((d) => ({ element: d.$meta }));
        this.metadata = [...node.prefixes, ...node.metadata]
            .filter((f) => f.about.length === 0)
            .map((f) => ({ element: f.$meta }));

        for (const child of node.$children) {
            if (!isElement(child)) continue;
            this.addChild({ element: child.$meta });

            if (isFeature(child)) this.features.push({ element: child.$meta });
            else if (isRelationship(child)) this.relationships.push(child.$meta);
            else this.elements.push({ element: child.$meta });
        }
    }

    /**
     * @returns stream of all owned and inherited metadata features
     */
    allMetadata(): Stream<Related<MetadataFeatureMeta>> {
        return stream(this.metadata);
    }

    /**
     * @returns stream of all owned and inherited features
     */
    allFeatures(): Stream<Related<FeatureMeta>> {
        return stream(this.features);
    }

    /**
     * Add a {@link child} to this element scope
     */
    addChild(child: Related<ElementMeta>): void {
        const meta = child.element;
        if (meta.name) this.children.set(meta.name, meta.regularDescription);
        if (meta.shortName) this.children.set(meta.shortName, meta.shortDescription);
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
        return this._shortName.declared;
    }

    /**
     * @param name new short name
     */
    setShortName(name: string): void {
        this.updateName(this._shortName, this.shortDescription, name);
    }

    private updateDescriptions(): void {
        this.selfExports.length = 0;

        if (this.name) this.selfExports.push(this.regularDescription);
        if (this.shortName) this.selfExports.push(this.shortDescription);
    }

    /**
     * @param name name to update
     * @param exported description corresponding to {@link name} (either full or short name)
     * @param value new name
     */
    private updateName(name: Name, exported: Exported, value: string): void {
        const parent = this.parent();
        const basicParent = parent.is(Element) ? parent : undefined;
        // remove this child
        if (name.sanitized && basicParent) basicParent.children.delete(name.sanitized);

        // update names
        name.set(value);
        this.qualifiedName = computeQualifiedName(this, parent);

        if (name.sanitized && name.sanitized.length > 0) {
            // add back this child if named
            exported.name = name.sanitized;
            if (exported.description) exported.description.name = name.sanitized;
            if (basicParent) basicParent.children.set(name.sanitized, exported);
        }
        this.updateDescriptions();
    }

    /**
     * Set descriptions that will be used to identify this element
     * @param regular Description for regular name
     * @param short Description for short name
     */
    addDescriptions(regular: SysMLNodeDescription, short: SysMLNodeDescription): void {
        this.regularDescription.description = regular;
        this.shortDescription.description = short;
    }
}

declare module "../../generated/ast" {
    interface Element {
        $meta: ElementMeta;
    }
}
