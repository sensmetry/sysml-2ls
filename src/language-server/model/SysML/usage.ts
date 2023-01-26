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

import { Usage } from "../../generated/ast";
import { FeatureMeta } from "../KerML/feature";
import { metamodelOf, ElementID } from "../metamodel";

@metamodelOf(Usage)
export class UsageMeta extends FeatureMeta {
    isSubjectParameter = false;
    isVariant = false;

    constructor(node: Usage, id: ElementID) {
        super(node, id);
    }

    override initialize(node: Usage): void {
        // https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/blob/8e5896300809dd1bcc039e213f88210570909d51/org.omg.sysml/src/org/omg/sysml/util/UsageUtil.java#LL84C29-L84C29
        // TODO: OwningFeatureMembership
        this.isComposite = this.direction !== "none" && !this.isEnd;
        this.isAbstract ||= node.isVariation;
        this.isVariant = this.isVariantNode(node);

        if (this.isVariant && !this.name && node.references.length > 0) {
            const newName = node.references[0].chain.at(-1)?.$refText;
            if (newName) this.setName(newName);
        }
    }

    override isIgnoredParameter(): boolean {
        return super.isIgnoredParameter() || this.isSubjectParameter;
    }

    override self(): Usage {
        return super.self() as Usage;
    }

    protected isVariantNode(node: Usage): boolean {
        return node.$containerProperty === "variants";
    }
}

declare module "../../generated/ast" {
    interface Usage {
        $meta: UsageMeta;
    }
}
