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
import { CalculationDefinition, CalculationUsage } from "../../generated/ast";
import { ExpressionMeta, ExpressionOptions } from "../KerML/expression";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { AstNode, LangiumDocument } from "langium";
import { ElementParts } from "../KerML";

export interface CalculationUsageOptions extends ExpressionOptions, ActionUsageOptions {}

@metamodelOf(CalculationUsage, {
    base: "Calculations::calculations",
    subcalculation: "Calculations::Calculation::subcalculations",
})
export class CalculationUsageMeta extends Mixin(ExpressionMeta, ActionUsageMeta) {
    override ast(): CalculationUsage | undefined {
        return this._ast as CalculationUsage;
    }
    override getSubactionType(): string | undefined {
        return this.isSubcalculation() ? "subcalculation" : super.getSubactionType();
    }

    isSubcalculation(): boolean {
        const parent = this.owner();
        return Boolean(
            this.isNonEntryExitComposite() && parent?.isAny(CalculationUsage, CalculationDefinition)
        );
    }

    protected override collectDeclaration(parts: ElementParts): void {
        ActionUsageMeta.prototype["collectDeclaration"].call(this, parts);
        if (this._result) parts.push(["result", [this._result]]);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: CalculationUsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as CalculationUsageMeta;
        if (options) ExpressionMeta.applyExpressionOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface CalculationUsage {
        $meta: CalculationUsageMeta;
    }
}
