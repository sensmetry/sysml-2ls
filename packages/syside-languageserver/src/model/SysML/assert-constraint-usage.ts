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

import { Mixin } from "ts-mixer";
import { ActionDefinition, ActionUsage, AssertConstraintUsage } from "../../generated/ast";
import { InvariantMeta, InvariantOptions } from "../KerML/invariant";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ConstraintUsageMeta, ConstraintUsageOptions } from "./constraint-usage";
import { AstNode, LangiumDocument } from "langium";

export interface AssertConstraintUsageOptions extends InvariantOptions, ConstraintUsageOptions {}

@metamodelOf(AssertConstraintUsage, {
    base: "Constraints::assertedConstraintChecks",
    negated: "Constraints::negatedConstraintChecks",
})
export class AssertConstraintUsageMeta extends Mixin(InvariantMeta, ConstraintUsageMeta) {
    override defaultSupertype(): string {
        return this.isNegated ? "negated" : "base";
    }

    protected override isBehaviorOwned(): boolean {
        const parent = this.owner();
        return Boolean(parent?.isAny(ActionDefinition, ActionUsage));
    }

    override ast(): AssertConstraintUsage | undefined {
        return this._ast as AssertConstraintUsage;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: AssertConstraintUsageOptions
    ): T["$meta"] {
        const model = ConstraintUsageMeta.create.call(
            this,
            provider,
            document,
            options
        ) as AssertConstraintUsageMeta;
        if (options) InvariantMeta.applyInvariantOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface AssertConstraintUsage {
        $meta: AssertConstraintUsageMeta;
    }
}
