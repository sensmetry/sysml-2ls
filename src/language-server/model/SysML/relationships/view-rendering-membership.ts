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

import { ViewRenderingMembership } from "../../../generated/ast";
import { FeatureMembershipMeta } from "../../KerML/relationships/feature-membership";
import { metamodelOf, ElementID, ModelContainer } from "../../metamodel";
import { RenderingUsageMeta } from "../rendering-usage";

@metamodelOf(ViewRenderingMembership)
export class ViewRenderingMembershipMeta<
    T extends RenderingUsageMeta = RenderingUsageMeta
> extends FeatureMembershipMeta<T> {
    constructor(id: ElementID, parent: ModelContainer<ViewRenderingMembership>) {
        super(id, parent);
    }

    override ast(): ViewRenderingMembership | undefined {
        return this._ast as ViewRenderingMembership;
    }

    override parent(): ModelContainer<ViewRenderingMembership> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface ViewRenderingMembership {
        $meta: ViewRenderingMembershipMeta;
    }
}
