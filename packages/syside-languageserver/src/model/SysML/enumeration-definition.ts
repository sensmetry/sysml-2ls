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

import { EnumerationDefinition } from "../../generated/ast";
import { enumerable } from "../../utils";
import { metamodelOf } from "../metamodel";
import { AttributeDefinitionMeta, AttributeDefinitionOptions } from "./attribute-definition";

export type EnumerationDefinitionOptions = AttributeDefinitionOptions;

@metamodelOf(EnumerationDefinition)
export class EnumerationDefinitionMeta extends AttributeDefinitionMeta {
    @enumerable
    override get isVariation(): boolean {
        return true;
    }
    override set isVariation(value) {
        // empty
    }

    override ast(): EnumerationDefinition | undefined {
        return this._ast as EnumerationDefinition;
    }
}

declare module "../../generated/ast" {
    interface EnumerationDefinition {
        $meta: EnumerationDefinitionMeta;
    }
}
