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
import { ConnectorAsUsage } from "../../generated/ast";
import { ConnectorMeta, ConnectorOptions } from "../KerML/connector";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { UsageMeta, UsageOptions } from "./usage";
import { AstNode, LangiumDocument } from "langium";
import { FeatureMeta, InheritanceMeta, MembershipMeta, TypeMeta } from "../KerML";
import { enumerable } from "../../utils";

export interface ConnectorAsUsageOptions extends UsageOptions, ConnectorOptions {}

// never returned from the textual syntax so make it abstract
@metamodelOf(ConnectorAsUsage, "abstract")
export class ConnectorAsUsageMeta extends Mixin(ConnectorMeta, UsageMeta) {
    @enumerable
    // @ts-expect-error issue with mixins
    override get isComposite(): boolean {
        return false;
    }
    override set isComposite(value) {
        // empty
    }

    override ast(): ConnectorAsUsage | undefined {
        return this._ast as ConnectorAsUsage;
    }

    override defaultSupertype(): string {
        return ConnectorMeta.prototype.defaultSupertype.call(this);
    }

    protected override onHeritageAdded(heritage: InheritanceMeta, target: TypeMeta): void {
        this.resetEnds();
        UsageMeta.prototype["onHeritageAdded"].call(this, heritage, target);
    }

    protected override onHeritageRemoved(heritage: InheritanceMeta[]): void {
        this.resetEnds();
        UsageMeta.prototype["onHeritageRemoved"].call(this, heritage);
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        return ConnectorMeta.prototype.featureMembers.call(this);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ConnectorAsUsageOptions
    ): T["$meta"] {
        const model = ConnectorMeta.create.call(this, provider, document, options) as UsageMeta;
        if (options) UsageMeta.applyUsageOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface ConnectorAsUsage {
        $meta: ConnectorAsUsageMeta;
    }
}
