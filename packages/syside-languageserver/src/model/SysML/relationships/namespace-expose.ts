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

import { AstNode, LangiumDocument } from "langium";
import { NamespaceExpose } from "../../../generated/ast";
import { NamespaceMeta } from "../../KerML/namespace";
import { NamespaceImportMeta } from "../../KerML/relationships/namespace-import";
import { ElementID, ElementIDProvider, MetatypeProto, metamodelOf, mix } from "../../metamodel";
import { ExposeMeta } from "./expose";
import { ImportOptions } from "../../KerML";
import { ViewUsageMeta } from "../view-usage";

export interface NamespaceExposeMeta<T extends NamespaceMeta = NamespaceMeta>
    extends ExposeMeta<T>,
        NamespaceImportMeta<T> {
    get importsAll(): boolean;
}

@metamodelOf(NamespaceExpose)
@mix(ExposeMeta, NamespaceImportMeta)
// eslint-disable-next-line unused-imports/no-unused-vars
export class NamespaceExposeMeta<T extends NamespaceMeta = NamespaceMeta> {
    // eslint-disable-next-line unused-imports/no-unused-vars
    protected constructor(id: ElementID) {
        // empty
    }

    ast(): NamespaceExpose | undefined {
        return this._ast as NamespaceExpose;
    }

    static create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ImportOptions<NamespaceMeta, ViewUsageMeta>
    ): T["$meta"] {
        return ExposeMeta.create.call(this, provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface NamespaceExpose {
        $meta: NamespaceExposeMeta;
    }
}
