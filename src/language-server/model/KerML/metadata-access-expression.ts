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

import { MetadataAccessExpression } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { InlineExpressionMeta } from "./inline-expression";
import { ElementMeta, TypeMeta } from "./_internal";

@metamodelOf(MetadataAccessExpression)
export class MetadataAccessExpressionMeta extends InlineExpressionMeta {
    reference?: ElementMeta;

    constructor(id: ElementID, parent: ModelContainer<MetadataAccessExpression>) {
        super(id, parent);
    }

    override self(): MetadataAccessExpression | undefined {
        return super.self() as MetadataAccessExpression;
    }

    override parent(): ModelContainer<MetadataAccessExpression> {
        return this._parent;
    }

    override returnType(): string | TypeMeta | undefined {
        return "Metaobjects::Metaobject";
    }
}

declare module "../../generated/ast" {
    interface MetadataAccessExpression {
        $meta: MetadataAccessExpressionMeta;
    }
}
