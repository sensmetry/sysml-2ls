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
import {
    ActionDefinition,
    ActionUsage,
    PartDefinition,
    PartUsage,
    PortionKind,
    StateSubactionMembership,
    Usage,
    VariantMembership,
} from "../../generated/ast";
import { enumerable } from "../../utils";
import { ElementMeta } from "../KerML";
import { FeatureMeta, FeatureOptions } from "../KerML/feature";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";

export interface UsageOptions extends FeatureOptions {
    isVariation?: boolean;
    isIndividual?: boolean;
    isReference?: boolean;
    portionKind?: PortionKind;
}

@metamodelOf(Usage)
export class UsageMeta extends FeatureMeta {
    isVariant = false;
    isVariation = false;
    isIndividual = false;
    portionKind?: PortionKind;

    protected override onParentSet(
        previous: ElementMeta | undefined,
        current: ElementMeta | undefined
    ): void {
        super.onParentSet(previous, current);
        this.isVariant = !!current?.is(VariantMembership);
    }

    @enumerable
    get isReference(): boolean {
        return !this.isComposite;
    }
    set isReference(value) {
        this.isComposite = !value;
    }
    get isReferenceExplicitly(): boolean {
        return !super.isComposite;
    }

    @enumerable
    override get isComposite(): boolean {
        return (
            super.isComposite &&
            Boolean(this.direction === "none" && !this.isEnd && this.owningType)
        );
    }
    override set isComposite(value) {
        this._isComposite = value;
    }
    get isCompositeExplicitly(): boolean {
        return super.isComposite;
    }

    @enumerable
    override get isAbstract(): boolean {
        return this._isAbstract || this.isVariation;
    }
    override set isAbstract(value) {
        this._isAbstract = value;
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

    protected static applyUsageOptions(model: UsageMeta, options: UsageOptions): void {
        model.isVariation = Boolean(options.isVariation);
        model.isIndividual = Boolean(options.isIndividual);
        model.isReference = Boolean(options.isReference);
        model.portionKind = options.portionKind;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: UsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as UsageMeta;
        if (options) UsageMeta.applyUsageOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Usage {
        $meta: UsageMeta;
    }
}
