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

import { Mixin } from "ts-mixer";
import { SysMLFunction } from "../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { FunctionMixin } from "../mixins/function";
import { BehaviorMeta, TypeMeta } from "./_internal";

export const ImplicitFunctions = {
    base: "Performances::Evaluation",
};

@metamodelOf(SysMLFunction, ImplicitFunctions)
export class FunctionMeta extends Mixin(BehaviorMeta, FunctionMixin) {
    constructor(id: ElementID, parent: ModelContainer<SysMLFunction>) {
        super(id, parent);
    }

    override initialize(node: SysMLFunction): void {
        if (node.result) this.result = node.result.$meta;
    }

    override reset(node: SysMLFunction): void {
        this.initialize(node);
    }

    override ast(): SysMLFunction | undefined {
        return this._ast as SysMLFunction;
    }

    override parent(): ModelContainer<SysMLFunction> {
        return this._parent;
    }

    /**
     * @returns fully qualified name or AST node of the return type of this
     * expression if one can be inferred, undefined otherwise
     */
    returnType(): TypeMeta | string | undefined {
        return this.getReturnType(this);
    }
}

declare module "../../generated/ast" {
    interface SysMLFunction {
        $meta: FunctionMeta;
    }
}
