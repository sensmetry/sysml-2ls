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
import { OwningMembership } from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import { ElementMeta, MembershipMeta, NamespaceMeta, RelationshipOptionsBody } from "../_internal";

@metamodelOf(OwningMembership)
export class OwningMembershipMeta<T extends ElementMeta = ElementMeta> extends MembershipMeta<T> {
    protected override onTargetSet(previous?: T, target?: T): void {
        if (previous) this.unsetOwnership(previous);
        if (target) this.takeOwnership(target);
    }

    protected override onOwnerSet(
        previous: [ElementMeta, ElementMeta] | undefined,
        current: [ElementMeta, ElementMeta] | undefined
    ): void {
        // need to propagate owner to the target
        if (this._element) {
            if (current) this._element["setOwner"](current[1]);
            else this.unsetOwnership(this._element);
        }
    }

    // Owning memberships will always be parsed with an owned target element so
    // it cannot be undefined
    override element(): T {
        return this._element as T;
    }

    override ast(): OwningMembership | undefined {
        return this._ast as OwningMembership;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RelationshipOptionsBody<ElementMeta, NamespaceMeta>
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface OwningMembership {
        $meta: OwningMembershipMeta;
    }
}
