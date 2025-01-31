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
import { OccurrenceDefinition } from "../../generated/ast";
import { ClassMeta, ClassOptions } from "../KerML/class";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { DefinitionMeta, DefinitionOptions } from "./definition";
import { EdgeContainer, OwningMembershipMeta, SubclassificationMeta } from "../KerML";
import { LifeClassMeta } from "./life-class";
import { AstNode, LangiumDocument } from "langium";

export interface OccurrenceDefinitionOptions extends ClassOptions, DefinitionOptions {}

@metamodelOf(OccurrenceDefinition, {
    base: "Occurrences::Occurrence",
})
export class OccurrenceDefinitionMeta extends Mixin(ClassMeta, DefinitionMeta) {
    protected _lifeClass?: OwningMembershipMeta<LifeClassMeta>;

    get lifeClass(): OwningMembershipMeta<LifeClassMeta> | undefined {
        return this.isIndividual ? this._lifeClass : undefined;
    }

    override ast(): OccurrenceDefinition | undefined {
        return this._ast as OccurrenceDefinition;
    }

    protected createLifeClass(id: ElementIDProvider): void {
        this._lifeClass = this.swapEdgeOwnership(this._lifeClass, [
            OwningMembershipMeta.create(id, this.document, { isImplied: true }),
            LifeClassMeta.create(id, this.document, {
                heritage: EdgeContainer.make([
                    SubclassificationMeta.create(id, this.document),
                    this,
                ]),
            }),
        ]);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: OccurrenceDefinitionOptions
    ): T["$meta"] {
        const model = DefinitionMeta.create.call(
            this,
            provider,
            document,
            options
        ) as OccurrenceDefinitionMeta;
        model.createLifeClass(provider);
        return model;
    }
}

declare module "../../generated/ast" {
    interface OccurrenceDefinition {
        $meta: OccurrenceDefinitionMeta;
    }
}
