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
import { Expose } from "../../../generated/ast";
import { Visibility } from "../../../utils";
import { enumerable } from "../../../utils";
import { Importable, ImportMeta, ImportOptions } from "../../KerML/relationships/import";
import { ElementIDProvider, metamodelOf, MetatypeProto } from "../../metamodel";
import { ViewUsageMeta } from "../view-usage";

@metamodelOf(Expose, "abstract")
export abstract class ExposeMeta<T extends Importable = Importable> extends ImportMeta<T> {
    /**
     * Visibility of the element at the end of this import
     * @see {@link element}
     */
    @enumerable
    override get visibility(): Visibility {
        return Visibility.protected;
    }

    override set visibility(value: Visibility) {
        if (value != Visibility.protected) {
            throw new Error("Expose visibility must be protected");
        }
    }

    @enumerable
    override get importsAll(): boolean {
        return true;
    }

    override ast(): Expose | undefined {
        return this._ast as Expose;
    }

    protected static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ImportOptions<Importable, ViewUsageMeta>
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface Expose {
        $meta: ExposeMeta;
    }
}
