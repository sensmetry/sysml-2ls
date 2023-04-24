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
    AnnotatingElement,
    Comment,
    Documentation,
    Feature,
    Membership,
    MetadataFeature,
    Relationship,
} from "../../generated/ast";
import { Visibility } from "../../utils/scope-util";
import { getVisibility } from "../enums";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { CommentMeta, DocumentationMeta, ElementMeta, FeatureMeta } from "./_internal";

export type NonNullRelationship<
    R extends RelationshipMeta = RelationshipMeta,
    T extends ElementMeta | never = never
> = R & {
    element(): NonNullable<never extends T ? ReturnType<R["element"]> : T>;
};

export type TargetType<T extends RelationshipMeta = RelationshipMeta> = ReturnType<T["element"]>;

@metamodelOf(Relationship, "abstract")
export abstract class RelationshipMeta<T extends ElementMeta = ElementMeta> extends ElementMeta {
    /**
     * Visibility of the element at the end of this relationship
     * @see {@link element}
     */
    visibility: Visibility = Visibility.public;

    /**
     * Whether this relationship was constructed implicitly
     */
    isImplied = false;

    protected _source: ElementMeta;
    protected _element?: T;

    constructor(id: ElementID, parent: ModelContainer<Relationship>) {
        super(id, parent);

        this._source = parent as ElementMeta;
    }

    source(): ElementMeta {
        return this._source;
    }
    setSource(s: ElementMeta): void {
        this._source = s;
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

    override initialize(node: Relationship): void {
        this.visibility = getVisibility(node.visibility);
        if (node.element) this._element = node.element.$meta as T;
    }

    override reset(node: Relationship): void {
        if (node.element) this._element = node.element.$meta as T;
        else this._element = undefined;
    }

    override ast(): Relationship | undefined {
        return this._ast as Relationship;
    }

    override parent(): ModelContainer<Relationship> {
        return this._parent;
    }

    override owner(): ElementMeta {
        // only namespaces are entry types
        return this._owner as ElementMeta;
    }

    protected override collectChildren(node: Relationship): void {
        node.annotations.forEach((a) => {
            if (!a.element) return;

            const element = a.element as AnnotatingElement;
            const meta = element.$meta;
            if (element.about.length > 0) return;

            if (meta.is(MetadataFeature)) this.metadata.push(meta);
            else if (element.$type === Comment) this.comments.push(meta as CommentMeta);
            else if (element.$type === Documentation) this.docs.push(meta as DocumentationMeta);
        });

        // TODO: do something with other elements
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
}

declare module "../../generated/ast" {
    interface Relationship {
        $meta: RelationshipMeta;
    }
}
