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
import { ConjugatedPortDefinition, PortDefinition } from "../../generated/ast";
import { StructureMeta, StructureOptions } from "../KerML/structure";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { OccurrenceDefinitionMeta, OccurrenceDefinitionOptions } from "./occurrence-definition";
import { ElementParts, OwningMembershipMeta } from "../KerML";
import { enumerable } from "../../utils";
import { AstNode, LangiumDocument } from "langium";
import { PortConjugationMeta } from "./relationships";

export interface PortDefinitionOptions extends StructureOptions, OccurrenceDefinitionOptions {}

@metamodelOf(PortDefinition, {
    base: "Ports::Port",
})
export class PortDefinitionMeta extends Mixin(StructureMeta, OccurrenceDefinitionMeta) {
    private _conjugatedDefinition: OwningMembershipMeta<ConjugatedPortDefinitionMeta>;

    @enumerable
    get conjugatedDefinition(): OwningMembershipMeta<ConjugatedPortDefinitionMeta> {
        return this._conjugatedDefinition;
    }

    override ast(): PortDefinition | undefined {
        return this._ast as PortDefinition;
    }

    protected override setName(name: string | undefined): void {
        super.setName(name);

        const def = this._conjugatedDefinition?.element();
        if (def) def.declaredName = this.name ? `'~${this.name}'` : undefined;
    }

    protected override setShortName(name: string | undefined): void {
        super.setShortName(name);

        const def = this._conjugatedDefinition?.element();
        if (def) def.declaredShortName = this.shortName ? `'~${this.shortName}'` : undefined;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: PortDefinitionOptions
    ): T["$meta"] {
        const portDef = super.create(provider, document, options) as PortDefinitionMeta;
        const conjugated = ConjugatedPortDefinitionMeta.create(provider, document);
        conjugated.addHeritage([PortConjugationMeta.create(provider, document), portDef]);
        portDef._conjugatedDefinition = OwningMembershipMeta.create(provider, document, {
            parent: portDef,
            target: conjugated,
        }) as OwningMembershipMeta<ConjugatedPortDefinitionMeta>;

        if (options?.declaredName) portDef.setName(options.declaredName);
        if (options?.declaredShortName) portDef.setShortName(options.declaredShortName);

        return portDef;
    }

    protected override collectParts(): ElementParts {
        const parts = OccurrenceDefinitionMeta.prototype["collectParts"].call(this);
        if (this._conjugatedDefinition)
            parts.push(["conjugatedDefinition", [this._conjugatedDefinition]]);

        return parts;
    }
}

@metamodelOf(ConjugatedPortDefinition)
export class ConjugatedPortDefinitionMeta extends PortDefinitionMeta {
    override ast(): ConjugatedPortDefinition | undefined {
        return this._ast as ConjugatedPortDefinition;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: PortDefinitionOptions
    ): T["$meta"] {
        // don't need to add conjugation again
        return OccurrenceDefinitionMeta.create.call(this, provider, document, options);
    }
}

declare module "../../generated/ast" {
    interface PortDefinition {
        $meta: PortDefinitionMeta;
    }

    interface ConjugatedPortDefinition {
        $meta: ConjugatedPortDefinitionMeta;
    }
}
