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
import { MembershipExpose } from "../../../generated/ast";
import { MembershipMeta } from "../../KerML/relationships/membership";
import { MembershipImportMeta } from "../../KerML/relationships/membership-import";
import { ElementID, ElementIDProvider, MetatypeProto, metamodelOf, mix } from "../../metamodel";
import { ExposeMeta } from "./expose";
import { ImportOptions } from "../../KerML";
import { ViewUsageMeta } from "../view-usage";

export interface MembershipExposeMeta<T extends MembershipMeta = MembershipMeta>
    extends ExposeMeta<T>,
        Omit<MembershipImportMeta<T>, "visibility" | "clearVisibility" | "setMetaclass"> {
    get importsAll(): boolean;
}

@metamodelOf(MembershipExpose)
@mix(ExposeMeta, MembershipImportMeta)
// eslint-disable-next-line unused-imports/no-unused-vars
export class MembershipExposeMeta<T extends MembershipMeta = MembershipMeta> {
    // eslint-disable-next-line unused-imports/no-unused-vars
    protected constructor(id: ElementID) {
        // empty
    }

    ast(): MembershipExpose | undefined {
        return this._ast as MembershipExpose;
    }

    static create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ImportOptions<MembershipMeta, ViewUsageMeta>
    ): T["$meta"] {
        return ExposeMeta.create.call(this, provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface MembershipExpose {
        $meta: MembershipExposeMeta;
    }
}
