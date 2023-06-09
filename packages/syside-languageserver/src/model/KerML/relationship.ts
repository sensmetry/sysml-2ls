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
import {
    Comment,
    Documentation,
    Element,
    Feature,
    Membership,
    MetadataFeature,
    Relationship,
    TextualRepresentation,
} from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import { Visibility } from "../../utils/scope-util";
import { ElementContainer } from "../containers";
import { metamodelOf } from "../metamodel";
import {
    CommentMeta,
    DocumentationMeta,
    ElementMeta,
    ElementParts,
    FeatureMeta,
    MetadataFeatureMeta,
    TextualRepresentationMeta,
} from "./_internal";

export type NonNullRelationship<
    R extends RelationshipMeta = RelationshipMeta,
    T extends ElementMeta | never = never
> = R & {
    element(): NonNullable<never extends T ? ReturnType<R["element"]> : T>;
};

export type TargetType<T extends RelationshipMeta = RelationshipMeta> = ReturnType<T["element"]>;

@metamodelOf(Relationship, "abstract")
export abstract class RelationshipMeta<T extends ElementMeta = ElementMeta> extends ElementMeta {
    protected _children = new ElementContainer<Element>();

    protected _visibility?: Visibility;
    isImplied = false;

    protected _source?: ElementMeta;
    protected _element?: T;

    override get comments(): readonly CommentMeta[] {
        return this._children.get(Comment).concat(this._comments);
    }

    override get documentation(): readonly DocumentationMeta[] {
        return this._children.get(Documentation).concat(this._docs);
    }

    override get metadata(): Stream<MetadataFeatureMeta> {
        return stream(this._children.get(MetadataFeature)).concat(this._metadata);
    }

    override get textualRepresentation(): readonly TextualRepresentationMeta[] {
        return this._children.get(TextualRepresentation).concat(this._reps);
    }

    protected override onParentSet(
        previous: ElementMeta | undefined,
        current: ElementMeta | undefined
    ): void {
        if (!this._source || this._source === previous) this._source = current;
        super.onParentSet(previous, current);
    }

    @enumerable
    get children(): readonly ElementMeta[] {
        return this._children.all;
    }

    source(): ElementMeta | undefined {
        return this._source || (this._owner as ElementMeta | undefined);
    }

    setSource(s: ElementMeta): void {
        this._source = s;
    }

    /**
     * Visibility of the element at the end of this relationship
     * @see {@link element}
     */
    @enumerable
    get visibility(): Visibility {
        return this._visibility ?? Visibility.public;
    }

    set visibility(value: Visibility) {
        this._visibility = value;
    }

    clearVisibility(): this {
        this._visibility = undefined;
        return this;
    }

    @enumerable
    get hasExplicitVisibility(): boolean {
        return this._visibility !== undefined;
    }

    /**
     * The element at the end of this relationship, check for ownership by `element().owner()`
     * @see {@link setElement}
     */
    element(): T | undefined {
        return this._element;
    }

    /**
     * @see {@link element}
     */
    setElement(e?: T): void {
        this._element = e?.is(Membership) ? e : e;
    }

    override ast(): Relationship | undefined {
        return this._ast as Relationship;
    }

    /**
     * @returns final target of this relationship after following any existing
     * chaining features
     */
    finalElement(): T | FeatureMeta | undefined {
        const target = this.element();
        return target?.is(Feature) && target.chainings.length > 0
            ? target.chainings.at(-1)?.element()
            : target;
    }

    protected collectParts(): ElementParts {
        const parts: ElementParts = [];
        if (this.source()?.parent() === this) {
            parts.push(["source", [this.source() as ElementMeta]]);
        }

        const target = this.element();
        if (target?.parent() === this) {
            parts.push(["target", [target]]);
        }

        parts.push(["children", this.children]);
        return parts;
    }
}

declare module "../../generated/ast" {
    interface Relationship {
        $meta: RelationshipMeta;
    }
}
