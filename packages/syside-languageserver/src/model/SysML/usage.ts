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
    FeatureMembership,
    PartDefinition,
    PartUsage,
    PortionKind,
    StateSubactionMembership,
    SubjectMembership,
    Usage,
    VariantMembership,
} from "../../generated/ast";
import { enumerable } from "../../utils";
import { ElementMeta } from "../KerML";
import { FeatureMeta } from "../KerML/feature";
import { metamodelOf } from "../metamodel";

@metamodelOf(Usage)
export class UsageMeta extends FeatureMeta {
    isVariant = false;
    isVariation = false;
    isIndividual = false;
    protected _isReference = false;
    portionKind?: PortionKind;
    protected _isImpliedComposite = false;

    protected override onParentSet(
        previous: ElementMeta | undefined,
        current: ElementMeta | undefined
    ): void {
        super.onParentSet(previous, current);
        this.isVariant = !!current?.is(VariantMembership);
        this._isImpliedComposite = Boolean(
            this.direction === "none" && !this.isEnd && current?.is(FeatureMembership)
        );
    }

    @enumerable
    get isReference(): boolean {
        return this._isReference;
    }
    set isReference(value) {
        this._isReference = value;
    }

    @enumerable
    override get isComposite(): boolean {
        return this._isImpliedComposite || super.isComposite;
    }
    override set isComposite(value) {
        this._isComposite = value;
    }

    @enumerable
    override get isAbstract(): boolean {
        return this._isAbstract || this.isVariation;
    }
    override set isAbstract(value) {
        this._isAbstract = value;
    }

    override isIgnoredParameter(): boolean {
        return super.isIgnoredParameter() || !!this.parent()?.is(SubjectMembership);
    }

    override ast(): Usage | undefined {
        return this._ast as Usage;
    }
    protected isVariantNode(): boolean {
        return !!this.parent()?.is(VariantMembership);
    }

    override namingFeature(): FeatureMeta | undefined {
        const parent = this.parent();
        if (parent?.is(VariantMembership)) {
            const referenced = this.referencedFeature();
            if (referenced) return referenced;
        }
        return super.namingFeature();
    }

    isNonEntryExitComposite(): boolean {
        return this.isComposite && !this.isEntryExitAction();
    }

    isActionOwnedComposite(): boolean {
        return Boolean(
            this.isComposite &&
                !this.isEntryExitAction() &&
                this.owner()?.isAny(ActionDefinition, ActionUsage)
        );
    }

    isPartOwnedComposite(): boolean {
        return Boolean(this.isComposite && this.owner()?.isAny(PartDefinition, PartUsage));
    }

    isEntryExitAction(): boolean {
        const parent = this.parent();
        return !!parent?.is(StateSubactionMembership) && parent.kind !== "do";
    }
}

declare module "../../generated/ast" {
    interface Usage {
        $meta: UsageMeta;
    }
}
