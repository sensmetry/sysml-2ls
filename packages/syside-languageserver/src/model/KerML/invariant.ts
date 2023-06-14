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
import { Invariant } from "../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { BooleanExpressionMeta, BooleanExpressionOptions } from "./_internal";

export const ImplicitInvariants = {
    base: "Performances::trueEvaluations",
    negated: "Performances::falseEvaluations",
};

export interface InvariantOptions extends BooleanExpressionOptions {
    isNegated?: boolean;
}

@metamodelOf(Invariant, ImplicitInvariants)
export class InvariantMeta extends BooleanExpressionMeta {
    /**
     * Whether this invariant is negated
     */
    isNegated = false;

    override ast(): Invariant | undefined {
        return this._ast as Invariant;
    }

    override defaultSupertype(): string {
        return this.isNegated ? "negated" : "base";
    }

    protected static applyInvariantOptions(model: InvariantMeta, options: InvariantOptions): void {
        model.isNegated = Boolean(options.isNegated);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: InvariantOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as InvariantMeta;
        if (options) InvariantMeta.applyInvariantOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Invariant {
        $meta: InvariantMeta;
    }
}
