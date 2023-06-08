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

import { AnnotatingElement } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { AnnotationMeta } from "./_internal";
import { ElementMeta, ElementParts } from "./element";

@metamodelOf(AnnotatingElement, "abstract")
export abstract class AnnotatingElementMeta extends ElementMeta {
    protected _annotations: AnnotationMeta[] = [];

    addAnnotation(...annotation: AnnotationMeta[]): this {
        this._annotations.push(...annotation);
        annotation.forEach((a) => a["setParent"](this));
        return this;
    }

    annotations(): readonly AnnotationMeta[] {
        return this._annotations;
    }

    annotatedElements(): readonly ElementMeta[] {
        const annotations = this.annotations();
        const owner = this.owner();
        if (annotations.length === 0 && owner) return [owner];
        return annotations.map((a) => a.element()).filter((e): e is ElementMeta => Boolean(e));
    }

    override ast(): AnnotatingElement | undefined {
        return this._ast as AnnotatingElement;
    }

    textualParts(): ElementParts {
        return { about: this._annotations };
    }
}

declare module "../../generated/ast" {
    interface AnnotatingElement {
        $meta: AnnotatingElementMeta;
    }
}
