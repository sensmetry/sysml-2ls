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
import { Element, Membership, MembershipImport } from "../../generated/ast";
import { SysMLNodeDescription } from "../../services/shared/workspace/ast-descriptions";
import { BasicMetamodel, metamodelOf } from "../metamodel";
import { computeQualifiedName, Name } from "../naming";
import {
    CommentMeta,
    DocumentationMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MembershipImportMeta,
    TextualRepresentationMeta,
} from "./_internal";
import { LazyGetter, enumerable } from "../../utils/common";

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

@metamodelOf(Element, "abstract")
export abstract class ElementMeta extends BasicMetamodel<Element> {
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

    /**
     * Comments about this element
     */
    get comments(): readonly CommentMeta[] {
        return this._comments;
    }
    addComment(...comment: CommentMeta[]): this {
        this._comments.push(...comment);
        return this;
    }

    /**
     * Documentation about this element
     */
    get documentation(): readonly DocumentationMeta[] {
        return this._docs;
    }
    addDocumentation(...comment: DocumentationMeta[]): this {
        this._docs.push(...comment);
        return this;
    }

    /**
     * Metadata about this element
     */
    get metadata(): Stream<MetadataFeatureMeta> {
        return stream(this._metadata);
    }
    addMetadata(...meta: MetadataFeatureMeta[]): this {
        this._metadata.push(...meta);
        return this;
    }

    /**
     * Textual representations about this element
     */
    get textualRepresentation(): readonly TextualRepresentationMeta[] {
        return this._reps;
    }
    addTextualRepresentation(...rep: TextualRepresentationMeta[]): this {
        this._reps.push(...rep);
        return this;
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

    /**
     * Add a {@link child} to this element scope
     */
    protected addLookupMember(child: MembershipMeta<ElementMeta>): void {
        const meta = child.element();
        if (child.name || child.shortName) {
            if (child.name) this._memberLookup.set(child.name, child);
            if (child.shortName) this._memberLookup.set(child.shortName, child);
        } else {
            if (meta?.name) this._memberLookup.set(meta.name, child);
            if (meta?.shortName) this._memberLookup.set(meta.shortName, child);
        }
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
            // only remove this child if it is already cached with the old name
            const cached = owner._memberLookup.get(previousName);
            const isCached = cached === this.parent() || cached === "shadow";
            if (cached && isCached) owner._memberLookup.delete(previousName);
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
}

declare module "../../generated/ast" {
    interface Element {
        $meta: ElementMeta;
    }
}
