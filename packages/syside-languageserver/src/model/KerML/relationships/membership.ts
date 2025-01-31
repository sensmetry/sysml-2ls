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

import { AstNode, LangiumDocument } from "langium";
import { Membership } from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    ElementMeta,
    ElementOptions,
    NamespaceMeta,
    RelationshipMeta,
    RelationshipOptionsBody,
} from "../_internal";

export interface MembershipOptions<
    Target extends ElementMeta = ElementMeta,
    Parent extends NamespaceMeta | undefined = NamespaceMeta,
> extends RelationshipOptionsBody<Target, Parent>,
        ElementOptions<Parent> {
    isAlias?: boolean;
}

@metamodelOf(Membership)
// @ts-expect-error ignoring static inheritance error
export class MembershipMeta<T extends ElementMeta = ElementMeta> extends RelationshipMeta<T> {
    isAlias = false;

    override ast(): Membership | undefined {
        return this._ast as Membership;
    }

    override get name(): string | undefined {
        return this.isAlias ? super.name : this.element()?.name;
    }

    override get shortName(): string | undefined {
        return this.isAlias ? super.shortName : this.element()?.shortName;
    }

    /**
     * Adds new owned body elements and returns the new number of body elements.
     */
    addChild(...element: ElementMeta[]): number {
        return this.addOwnedElements(this._children, element);
    }

    /**
     * Removes owned body elements and returns the new number of body elements.
     */
    removeChild(...element: ElementMeta[]): number {
        return this.removeOwnedElements(this._children, element);
    }

    /**
     * Removes owned body elements by predicate and returns the new number of
     * body elements.
     */
    removeChildIf(predicate: (element: ElementMeta) => boolean): number {
        return this.removeOwnedElementsIf(this._children, predicate);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: MembershipOptions
    ): T["$meta"] {
        const member = super.create(provider, document, options) as MembershipMeta;
        if (options) {
            member.isAlias = Boolean(options.isAlias);
            ElementMeta.applyElementOptions(member, options);
        }
        return member;
    }
}

declare module "../../../generated/ast" {
    interface Membership {
        $meta: MembershipMeta;
    }
}
