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

import { Result } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer, ParentModel } from "../metamodel";
import { InlineExpressionMeta } from "./inline-expression";
import { VisibilityMeta } from "./visibility-element";
import { castToRelated } from "./_internal";

@metamodelOf(Result)
export class ResultMeta extends VisibilityMeta {
    element?: InlineExpressionMeta;

    constructor(id: ElementID, parent: ModelContainer<Result>) {
        super(id, parent);
    }

    override initialize(node: Result): void {
        this.element = node.expression.$meta;
        const parent = this.parent(true);
        if ("result" in parent) parent.result = castToRelated(this);
    }

    override self(): Result | undefined {
        return super.self() as Result;
    }

    override parent(_: true): ParentModel<Result>;
    override parent(): ModelContainer<Result>;

    override parent(): ModelContainer<Result> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface Result {
        $meta: ResultMeta;
    }
}
