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
import { ConstraintDefinition } from "../../generated/ast";
import { PredicateMeta, PredicateOptions } from "../KerML/predicate";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { OccurrenceDefinitionMeta, OccurrenceDefinitionOptions } from "./occurrence-definition";
import { AstNode, LangiumDocument } from "langium";

export interface ConstraintDefinitionOptions
    extends PredicateOptions,
        OccurrenceDefinitionOptions {}

@metamodelOf(ConstraintDefinition, {
    base: "Constraints::ConstraintCheck",
})
export class ConstraintDefinitionMeta extends Mixin(PredicateMeta, OccurrenceDefinitionMeta) {
    override ast(): ConstraintDefinition | undefined {
        return this._ast as ConstraintDefinition;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ConstraintDefinitionOptions
    ): T["$meta"] {
        const model = OccurrenceDefinitionMeta.create.call(
            this,
            provider,
            document,
            options
        ) as ConstraintDefinitionMeta;
        if (options) PredicateMeta.applyFunctionOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface ConstraintDefinition {
        $meta: ConstraintDefinitionMeta;
    }
}
