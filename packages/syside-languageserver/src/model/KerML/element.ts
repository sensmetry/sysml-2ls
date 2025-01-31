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
import { Element, Membership, MembershipImport } from "../../generated/ast";
import { SysMLNodeDescription } from "../../services/shared/workspace/ast-descriptions";
import {
    BasicMetamodel,
    ElementIDProvider,
    MetatypeProto,
    ModelElementOptions,
    metamodelOf,
} from "../metamodel";
import { computeQualifiedName, Name } from "../naming";
import {
    CommentMeta,
    DocumentationMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MembershipImportMeta,
    TextualRepresentationMeta,
    AnnotatingElementMeta,
    RelationshipMeta,
    TargetType,
    OwningMembershipMeta,
    NonNullRelationship,
} from "./_internal";
import { LazyGetter, enumerable } from "../../utils/common";
import { removeIfObserved } from "../containers";
import { SysMLInterface, SysMLType } from "../../services";

/**
 * Types used in named children cache
 *
 * - `"unresolved reference"` refers to named imports not linked yet
 * - `"shadow"` - names shadowed by this scope (i.e. redefinitions)
 */
export type NamedChild = MembershipMeta | MembershipImportMeta | "unresolved reference" | "shadow";

export type ElementParts = (readonly [string, readonly ElementMeta[]])[];

export function namedMembership(
    member: MembershipMeta | MembershipImportMeta
): MembershipMeta | undefined {
    return member.is(MembershipImport) ? member.element() : member;
}

export type LazyMetaclass = LazyGetter<MetadataFeatureMeta | undefined>;

export interface ElementOptions<Parent extends ElementMeta | undefined = ElementMeta>
    extends ModelElementOptions<Parent> {
    declaredShortName?: string;
    declaredName?: string;
}

export type Edge<R extends RelationshipMeta, T extends TargetType<R> = TargetType<R>> = readonly [
    R,
    T,
];

export type Edges<R extends RelationshipMeta> = {
    [K in SysMLType]: SysMLInterface<K>["$meta"] extends R
        ? Edge<SysMLInterface<K>["$meta"]>
        : never;
}[SysMLType];

export type RestEdges<T extends RelationshipMeta[]> = { [I in keyof T]: Edge<T[I]> };

type SwappedEdge<T extends RelationshipMeta, V extends ElementMeta> = T &
    (T extends OwningMembershipMeta
        ? NonNullRelationship<RelationshipMeta<V>>
        : RelationshipMeta<V>);

type CleanupCallback = (() => void) & { owner: ElementMeta };

@metamodelOf(Element, "abstract")
export abstract class ElementMeta extends BasicMetamodel<Element> {
    private static readonly CleanupToken = {};

    protected _comments: CommentMeta[] = [];
    protected _metadata: MetadataFeatureMeta[] = [];
    protected _docs: DocumentationMeta[] = [];
    protected _reps: TextualRepresentationMeta[] = [];

    protected _declaredName?: string;
    protected readonly _name = new Name();
    protected _declaredShortName?: string;
    protected readonly _shortName = new Name();
    protected _qualifiedName = "";
    protected _description?: SysMLNodeDescription;

    // TODO: move to namespace
    protected readonly _memberLookup = new Map<string, NamedChild>();
    protected _metaclass: MetadataFeatureMeta | undefined | LazyMetaclass | "unset" = "unset";

    get isImpliedIncluded(): boolean {
        return this.setupState === "completed";
    }

    /**
     * Adds annotating element that annotates this element. An implementation
     * detail used for tracking explicit annotations. All elements added through
     * this should call {@link removeExplicitAnnotatingElement} to remove them.
     */
    protected addExplicitAnnotatingElement(element: AnnotatingElementMeta): void {
        // if the element comes from a different document, register an
        // invalidation callback to automatically remove the annotating element,
        // preventing stale references.
        const registerCleanup = (): void => {
            if (element.document === this.document) return;
            const cleanup: CleanupCallback = (): void =>
                this.removeExplicitAnnotatingElement(element, ElementMeta.CleanupToken);
            // attaching additionally `this` so that the callback can be removed
            // later
            cleanup.owner = this;
            element.document.onInvalidated.add(element, cleanup);
        };

        switch (element.nodeType()) {
            case "Comment":
                this._comments.push(element as CommentMeta);
                registerCleanup();
                break;
            case "Documentation":
                this._docs.push(element as DocumentationMeta);
                registerCleanup();
                break;
            case "TextualRepresentation":
                this._reps.push(element as TextualRepresentationMeta);
                registerCleanup();
                break;
            case "MetadataFeature":
            case "MetadataUsage":
                this._metadata.push(element as MetadataFeatureMeta);
                registerCleanup();
                break;
        }
    }

    /**
     * Reverse of {@link addExplicitAnnotatingElement} that stops tracking the
     * annotating element. An implementation detail.
     * @param element
     * @param token a token to signal this called from cleanup function to avoid
     * unnecessary work
     */
    protected removeExplicitAnnotatingElement(
        element: AnnotatingElementMeta,
        token?: typeof ElementMeta.CleanupToken
    ): void {
        const unregister = (): void => {
            if (token === ElementMeta.CleanupToken) return;
            const registry = element.document.onInvalidated;
            const value = registry
                .get(element)
                .find((cb) => (cb as CleanupCallback).owner === this);
            if (value) registry.delete(element, value);
        };

        switch (element.nodeType()) {
            case "Comment":
                this._comments.remove(element as CommentMeta);
                unregister();
                break;
            case "Documentation":
                this._docs.remove(element as DocumentationMeta);
                unregister();
                break;
            case "TextualRepresentation":
                this._reps.remove(element as TextualRepresentationMeta);
                unregister();
                break;
            case "MetadataFeature":
            case "MetadataUsage":
                this._metadata.remove(element as MetadataFeatureMeta);
                unregister();
                break;
        }
    }

    /**
     * Comments about this element
     */
    get comments(): readonly CommentMeta[] {
        return this._comments;
    }

    /**
     * Documentation about this element
     */
    get documentation(): readonly DocumentationMeta[] {
        return this._docs;
    }

    /**
     * Metadata about this element
     */
    get metadata(): Stream<MetadataFeatureMeta> {
        return stream(this._metadata);
    }

    /**
     * Textual representations about this element
     */
    get textualRepresentation(): readonly TextualRepresentationMeta[] {
        return this._reps;
    }

    /**
     * Name to be used in reference resolution
     */
    @enumerable
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
     * Name as it appeared in the source file
     */
    @enumerable
    get declaredName(): string | undefined {
        return this._declaredName;
    }
    set declaredName(value) {
        if (value === this._declaredName) return;
        this._declaredName = value;
        this.setName(value);
    }

    /**
     * @param name new name
     */
    protected setName(name: string | undefined): void {
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
    @enumerable
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
     * Name as it appeared in the source file
     */
    @enumerable
    get declaredShortName(): string | undefined {
        return this._declaredShortName;
    }
    set declaredShortName(value) {
        if (value === this._declaredShortName) return;
        this._declaredShortName = value;
        this.setShortName(value);
    }

    /**
     * @param name new short name
     */
    protected setShortName(name: string | undefined): void {
        const old = this.shortName;
        this.updateName(this._shortName, name);
        const parent = this.parent();
        if (parent?.is(Membership) && parent.shortName === old && parent.name === this.name)
            parent.updateName(parent._shortName, name);
    }

    /**
     * Fully qualified name based on preferably name
     */
    @enumerable
    get qualifiedName(): string {
        return this._qualifiedName;
    }

    /**
     * Cached descriptions for this element based on names only
     */
    get description(): SysMLNodeDescription | undefined {
        return this._description;
    }

    findMember(name: string): NamedChild | undefined {
        return this._memberLookup.get(name);
    }
    hasMember(name: string): boolean {
        return this._memberLookup.has(name);
    }

    get namedMembers(): IterableIterator<[string, NamedChild]> {
        return this._memberLookup.entries();
    }

    get reservedNames(): IterableIterator<string> {
        return this._memberLookup.keys();
    }

    /**
     * Library metaclass of this element
     */
    get metaclass(): MetadataFeatureMeta | undefined {
        if (!this._metaclass || this._metaclass === "unset") return;
        if (typeof this._metaclass === "function") return (this._metaclass = this._metaclass());
        return this._metaclass;
    }

    setMetaclass(meta: MetadataFeatureMeta | undefined | LazyMetaclass): this {
        this._metaclass = meta;
        return this;
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

    override parent(): ElementMeta | undefined {
        return this._parent as ElementMeta;
    }

    override owner(): ElementMeta | undefined {
        return this._owner as ElementMeta | undefined;
    }

    /**
     * @returns stream of all owned and inherited metadata features
     */
    allMetadata(): Stream<MetadataFeatureMeta> {
        return this.metadata;
    }

    protected override onOwnerSet(
        previous: [ElementMeta, ElementMeta] | undefined,
        current: [ElementMeta, ElementMeta] | undefined
    ): void {
        const oldParent = previous?.[0];
        if (oldParent?.is(Membership)) {
            const oldOwner = previous?.[1] as ElementMeta;
            if (oldParent.name) oldOwner.removeLookupMemberByName(oldParent, oldParent.name);
            if (oldParent.shortName)
                oldOwner.removeLookupMemberByName(oldParent, oldParent.shortName);
        }

        const currentParent = current?.[0];
        const currentOwner = current?.[1];
        if (currentParent?.is(Membership)) currentOwner?.addLookupMember(currentParent);
    }

    /**
     * Add a {@link child} to this element scope
     */
    protected addLookupMember(child: MembershipMeta<ElementMeta>): void {
        if (child.name) this._memberLookup.set(child.name, child);
        if (child.shortName) this._memberLookup.set(child.shortName, child);
    }

    protected removeLookupMemberByName(member: ElementMeta | undefined, name: string): void {
        if (!member) return;
        // only remove this child if it is already cached with the name
        const cached = this._memberLookup.get(name);
        const isCached = cached === member || cached === "shadow";
        if (cached && isCached) this._memberLookup.delete(name);
    }

    /**
     * @param name name to update
     * @param exported description corresponding to {@link name} (either full or short name)
     * @param value new name
     */
    private updateName(name: Name, value: string | undefined): void {
        const owner = this.owner();
        const previousName = name.sanitized;

        // update names
        name.set(value);
        if (previousName === name.sanitized) return;

        // remove this child
        if (previousName && owner) {
            owner.removeLookupMemberByName(this.parent(), previousName);
        }

        this._qualifiedName = computeQualifiedName(this, owner);

        if (name.sanitized && name.sanitized.length > 0) {
            const membership = this.parent();
            if (owner && !owner._memberLookup.has(name.sanitized) && membership?.is(Membership)) {
                owner._memberLookup.set(name.sanitized, membership);
            }
        }
    }

    protected abstract collectParts(): ElementParts;

    /**
     * Parts of this elements in the order they appear in textual notation
     */
    parts(): Partial<Record<string, readonly ElementMeta[]>> {
        return Object.fromEntries(this.collectParts());
    }

    ownedElements(): Stream<ElementMeta> {
        return stream(this.collectParts())
            .map(([_, elements]) => elements)
            .flat();
    }

    /**
     * Invalidate cached members to make sure they are up-to date
     */
    invalidateMemberCaches(): void {
        // empty
    }

    protected swapEdgeOwnership<T extends RelationshipMeta, V extends ElementMeta>(
        current: RelationshipMeta | undefined,
        edge: readonly [T, V]
    ): SwappedEdge<T, V>;
    protected swapEdgeOwnership<T extends RelationshipMeta, V extends ElementMeta>(
        current: RelationshipMeta | undefined,
        edge: readonly [T, V] | undefined
    ): SwappedEdge<T, V> | undefined;

    protected swapEdgeOwnership(
        current: RelationshipMeta | undefined,
        edge: readonly [RelationshipMeta, ElementMeta] | undefined
    ): RelationshipMeta | undefined {
        if (edge) {
            // removing the target element so that it doesn't trigger parent
            // change twice
            edge[0]["setElement"](undefined);
            this.swapOwnership(current, edge[0]);
            edge[0]["setElement"](edge[1]);

            return edge[0];
        }

        return this.swapOwnership(current, undefined);
    }

    protected addOwnedEdges<E extends RelationshipMeta, T extends TargetType<E>>(
        container: Pick<E[], "push">,
        edges: readonly Edge<E, T>[],
        callback?: (value: Edge<E, T>) => void
    ): number {
        return container.push(
            ...edges.map(([edge, target]) => {
                this.takeOwnership(edge);
                edge["setElement"](target);
                callback?.([edge, target]);
                return edge;
            })
        );
    }

    protected addOwnedElements<T extends ElementMeta>(
        container: Pick<T[], "push">,
        children: readonly T[],
        callback?: (value: T) => void
    ): number {
        children.forEach((c) => {
            this.takeOwnership(c);
            callback?.(c);
        });
        return container.push(...children);
    }

    protected removeOwnedElements<T extends ElementMeta>(
        container: Pick<T[], "remove" | "length">,
        children: readonly T[],
        callback?: (value: T) => void
    ): number {
        children.forEach((c) => {
            if (container.remove(c)) {
                callback?.(c);
                this.unsetOwnership(c);
            }
        });
        return container.length;
    }

    protected removeOwnedElementsIf<T extends ElementMeta>(
        container: Pick<T[], "removeIf" | "length">,
        predicate: (value: T) => boolean,
        callback?: (value: T) => void
    ): number {
        removeIfObserved(
            container,
            (v) => {
                callback?.(v);
                this.unsetOwnership(v);
            },
            predicate
        );
        return container.length;
    }

    protected static applyElementOptions(model: ElementMeta, options: ElementOptions): void {
        if (options?.declaredName) model.declaredName = options.declaredName;
        if (options?.declaredShortName) model.declaredShortName = options.declaredShortName;
    }

    protected static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ElementOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as ElementMeta;
        if (options) ElementMeta.applyElementOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Element {
        $meta: ElementMeta;
    }
}
