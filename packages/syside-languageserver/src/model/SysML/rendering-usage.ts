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

import {
    ReferenceSubsetting,
    Redefinition,
    RenderingDefinition,
    RenderingUsage,
    ViewRenderingMembership,
} from "../../generated/ast";
import { FeatureMeta } from "../KerML";
import { GeneralType, metamodelOf } from "../metamodel";
import { PartUsageMeta, PartUsageOptions } from "./part-usage";

export type RenderingUsageOptions = PartUsageOptions;

@metamodelOf(RenderingUsage, {
    base: "Views::renderings",
    subrendering: "Views::Rendering::subrenderings",
    viewRendering: "Views::View::viewRendering",
})
export class RenderingUsageMeta extends PartUsageMeta {
    override defaultSupertype(): string {
        return this.isSubrendering() ? "subrendering" : "base";
    }

    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isViewRendering()) {
            supertypes.push({ type: "viewRendering", specialization: Redefinition });
        }
        return supertypes;
    }

    isSubrendering(): boolean {
        const parent = this.owner();
        return Boolean(parent?.isAny(RenderingUsage, RenderingDefinition));
    }

    isViewRendering(): boolean {
        const parent = this.parent();
        return Boolean(parent?.is(ViewRenderingMembership));
    }

    override ast(): RenderingUsage | undefined {
        return this._ast as RenderingUsage;
    }
    override namingFeature(): FeatureMeta | undefined {
        return this.parent()?.is(ViewRenderingMembership)
            ? (this.types(ReferenceSubsetting).head() as FeatureMeta | undefined)
            : super.namingFeature();
    }
}

declare module "../../generated/ast" {
    interface RenderingUsage {
        $meta: RenderingUsageMeta;
    }
}
