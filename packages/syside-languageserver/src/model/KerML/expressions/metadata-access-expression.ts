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
import { MetadataAccessExpression } from "../../../generated/ast";
import {
    ElementIDProvider,
    MetatypeProto,
    ModelElementOptions,
    metamodelOf,
} from "../../metamodel";
import { ElementMeta, ExpressionMeta, RelationshipMeta, TypeMeta } from "../_internal";
import { enumerable } from "../../../utils";

export interface MetadataAccessExpressionOptions extends ModelElementOptions<RelationshipMeta> {
    reference: ElementMeta;
}

@metamodelOf(MetadataAccessExpression)
export class MetadataAccessExpressionMeta extends ExpressionMeta {
    protected _reference?: ElementMeta;

    @enumerable
    get reference(): ElementMeta | undefined {
        return this._reference;
    }
    set reference(value: ElementMeta) {
        this._reference = value;
    }

    override ast(): MetadataAccessExpression | undefined {
        return this._ast as MetadataAccessExpression;
    }

    override returnType(): string | TypeMeta | undefined {
        return "Metaobjects::Metaobject";
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: MetadataAccessExpressionOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as MetadataAccessExpressionMeta;
        model._reference = options?.reference;
        return model;
    }
}

declare module "../../../generated/ast" {
    interface MetadataAccessExpression {
        $meta: MetadataAccessExpressionMeta;
    }
}
