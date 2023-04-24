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

import {
    ActionDefinition,
    ActionUsage,
    PartDefinition,
    PartUsage,
    PortionKind,
    StateSubactionMembership,
    SubjectMembership,
    Usage,
    VariantMembership,
} from "../../generated/ast";
import { FeatureMeta } from "../KerML/feature";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";

@metamodelOf(Usage)
export class UsageMeta extends FeatureMeta {
    isVariant = false;
    isVariation = false;
    isIndividual = false;
    isReference = false;
    portionKind?: PortionKind;

    constructor(id: ElementID, parent: ModelContainer<Usage>) {
        super(id, parent);
        this.isVariant = this.isVariantNode();
    }

    override initialize(node: Usage): void {
        // https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/blob/8e5896300809dd1bcc039e213f88210570909d51/org.omg.sysml/src/org/omg/sysml/util/UsageUtil.java#LL84C29-L84C29
        // TODO: OwningFeatureMembership
        this.isComposite = this.direction !== "none" && !this.isEnd;
        this.isVariation = node.isVariation;
        this.isAbstract ||= node.isVariation;
        this.isIndividual = node.isIndividual;
        this.isReference = node.isReference;
        this.portionKind = node.portionKind;
    }

    override isIgnoredParameter(): boolean {
        return super.isIgnoredParameter() || this.parent().is(SubjectMembership);
    }

    override ast(): Usage | undefined {
        return this._ast as Usage;
    }

    override parent(): ModelContainer<Usage> {
        return this._parent;
    }

    protected isVariantNode(): boolean {
        return this.parent().is(VariantMembership);
    }

    override namingFeature(): FeatureMeta | undefined {
        const parent = this.parent();
        if (parent.is(VariantMembership)) {
            const referenced = this.referencedFeature();
            if (referenced) return referenced;
        }
        return super.namingFeature();
    }

    isNonEntryExitComposite(): boolean {
        return this.isComposite && !this.isEntryExitAction();
    }

    isActionOwnedComposite(): boolean {
        return (
            this.isComposite &&
            !this.isEntryExitAction() &&
            this.owner().isAny([ActionDefinition, ActionUsage])
        );
    }

    isPartOwnedComposite(): boolean {
        return this.isComposite && this.owner().isAny([PartDefinition, PartUsage]);
    }

    isEntryExitAction(): boolean {
        const parent = this.parent();
        return parent.is(StateSubactionMembership) && parent.kind !== "do";
    }
}

declare module "../../generated/ast" {
    interface Usage {
        $meta: UsageMeta;
    }
}
