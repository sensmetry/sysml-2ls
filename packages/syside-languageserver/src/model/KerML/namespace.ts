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

import { AstNode, LangiumDocument, Stream, stream } from "langium";
import {
    Comment,
    Documentation,
    Element,
    ElementFilterMembership,
    Feature,
    Import,
    Membership,
    MetadataFeature,
    Namespace,
    TextualRepresentation,
} from "../../generated/ast";
import { SubtypeKeys, SysMLInterface, SysMLTypeList } from "../../services";
import { KeysMatching, NonNullable, enumerable } from "../../utils";
import { BuildState } from "../enums";
import { BasicMetamodel, ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import {
    CommentMeta,
    DocumentationMeta,
    Edge,
    Edges,
    ElementFilterMembershipMeta,
    ElementMeta,
    ElementOptions,
    ElementParts,
    FeatureMeta,
    ImportMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    OwningMembershipMeta,
    RelationshipMeta,
    RestEdges,
    TextualRepresentationMeta,
} from "./_internal";
import { ElementContainer } from "../containers";

const FeatureMembers = (e: ElementMeta): e is MembershipMeta<FeatureMeta> =>
    Boolean(
        // filters are feature members but not what we want, they serve a different purpose
        e.nodeType() !== ElementFilterMembership && e.is(Membership) && e.element()?.is(Feature)
    );
const Filters = ElementFilterMembership;
const Imports = Import;

const makeMemberFilter =
    <K extends SubtypeKeys<Element>>(type: K) =>
    (e: ElementMeta): e is MembershipMeta<SysMLInterface<K>["$meta"]> =>
        Boolean(e.is(Membership) && e.element()?.is(type));

const DocMembers = makeMemberFilter(Documentation);
const CommentMembers = makeMemberFilter(Comment);
const MetaMembers = makeMemberFilter(MetadataFeature);
const RepMembers = makeMemberFilter(TextualRepresentation);

export type NamespaceRelationship = MembershipMeta | ImportMeta;

/**
 * A wrapper for array with hidden constructor and a fully type-checked factory
 * method to ensure valid edge targets
 */
export class EdgeContainer<E extends RelationshipMeta> {
    protected values: Edges<E>[];
    private constructor(edges: Edges<E>[]) {
        this.values = edges;
    }

    static make<E extends RelationshipMeta, T extends E[]>(
        ...edges: RestEdges<T>
    ): EdgeContainer<E> {
        return new EdgeContainer(edges as Edges<E>[]);
    }
}

export function namespaceChildren<T extends NamespaceRelationship[]>(
    ...children: RestEdges<T>
): EdgeContainer<NamespaceRelationship> {
    return EdgeContainer.make(...children);
}

export interface NamespaceOptions extends ElementOptions<RelationshipMeta> {
    prefixes?: readonly [OwningMembershipMeta, MetadataFeatureMeta][];

    children?: EdgeContainer<NamespaceRelationship>;
}

@metamodelOf(Namespace)
export class NamespaceMeta extends ElementMeta {
    protected _prefixes: OwningMembershipMeta<MetadataFeatureMeta>[] = [];
    protected _children = new ElementContainer<Membership | Import>();
    private _importResolutionState: BuildState = "none";

    override get comments(): readonly CommentMeta[] {
        return this._children
            .get(CommentMembers)
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._comments);
    }

    override get documentation(): readonly DocumentationMeta[] {
        return this._children
            .get(DocMembers)
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._docs);
    }

    override get metadata(): Stream<MetadataFeatureMeta> {
        return stream(this._prefixes, this._children.get(MetaMembers))
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._metadata);
    }

    override get textualRepresentation(): readonly TextualRepresentationMeta[] {
        return this._children
            .get(RepMembers)
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._reps);
    }

    @enumerable
    get children(): readonly NamespaceRelationship[] {
        return this._children.all;
    }

    /**
     * Adds owned members or imports and returns the new number of children.
     */
    addChild<T extends NamespaceRelationship[]>(...children: RestEdges<T>): number {
        return this.addOwnedEdges(this._children, children);
    }

    /**
     * Removes owned members or imports by value and returns the new number of
     * children.
     */
    removeChild(...children: readonly NamespaceRelationship[]): number {
        return this.removeOwnedElements(this._children, children);
    }

    /**
     * Removes owned members or imports by predicate and returns the new number of
     * children.
     */
    removeChildIf(predicate: (child: NamespaceRelationship) => boolean): number {
        return this.removeOwnedElementsIf(this._children, predicate);
    }

    /**
     * Metadata prefixes of this elements
     */
    @enumerable
    get prefixes(): readonly OwningMembershipMeta<MetadataFeatureMeta>[] {
        return this._prefixes;
    }

    /**
     * Adds owned metadata prefixes and returns the new number of prefixes.
     */
    addPrefix(...children: readonly Edge<OwningMembershipMeta, MetadataFeatureMeta>[]): number {
        return this.addOwnedEdges(this._prefixes, children);
    }

    /**
     * Removes owned metadata prefixes by value and returns the new number of
     * prefixes.
     */
    removePrefix(...children: readonly OwningMembershipMeta[]): number {
        return this.removeOwnedElements(this._prefixes, children);
    }

    /**
     * Removes owned metadata prefixes by predicate and returns the new number of
     * prefixes.
     */
    removePrefixIf(predicate: (child: OwningMembershipMeta) => boolean): number {
        return this.removeOwnedElementsIf(this._prefixes, predicate);
    }

    /**
     * Import statements
     */
    get imports(): readonly ImportMeta[] {
        return this._children.get(Imports);
    }

    get filters(): readonly ElementFilterMembershipMeta[] {
        return this._children.get(Filters);
    }

    featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        return this._children.get(FeatureMembers);
    }

    /**
     * Imports resolution state
     */
    get importResolutionState(): BuildState {
        return this._importResolutionState;
    }
    set importResolutionState(value: BuildState) {
        this._importResolutionState = value;
    }

    override ast(): Namespace | undefined {
        return this._ast as Namespace;
    }

    /**
     * @returns stream of all owned and inherited features
     */
    allFeatures(): Stream<MembershipMeta<FeatureMeta>> {
        return stream(this.featureMembers());
    }

    featuresByMembership<K extends KeysMatching<SysMLTypeList, Membership>>(
        kind: K
    ): Stream<FeatureMeta> {
        return stream(this.featureMembers())
            .filter(BasicMetamodel.is(kind))
            .map((m) => m.element())
            .nonNullable();
    }

    featuresMatching<K extends KeysMatching<SysMLTypeList, Feature>>(
        kind: K
    ): Stream<SysMLTypeList[K]["$meta"]> {
        return stream(this.featureMembers())
            .map((m) => m.element())
            .nonNullable()
            .filter(BasicMetamodel.is(kind));
    }

    protected collectParts(): ElementParts {
        return [
            ["prefixes", this.prefixes],
            ["children", this.children],
        ];
    }

    override invalidateMemberCaches(): void {
        // only members in children may have references which may invalidate
        // caches
        this._children.invalidateCaches();
    }

    protected static applyNamespaceOptions(model: NamespaceMeta, options: NamespaceOptions): void {
        if (options.prefixes) model.addPrefix(...options.prefixes);
        if (options.children) model.addChild(...options.children["values"]);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: NamespaceOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as NamespaceMeta;
        if (options) NamespaceMeta.applyNamespaceOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Namespace {
        $meta: NamespaceMeta;
    }
}
