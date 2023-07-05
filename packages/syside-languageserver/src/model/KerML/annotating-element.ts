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
import { AnnotatingElement } from "../../generated/ast";
import { NonNullable } from "../../utils";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { AnnotationMeta, Edge, ElementOptions, RelationshipMeta } from "./_internal";
import { ElementMeta, ElementParts } from "./element";

export interface AnnotatingElementOptions extends ElementOptions<RelationshipMeta> {
    annotations?: readonly Edge<AnnotationMeta, ElementMeta>[];
}

@metamodelOf(AnnotatingElement, "abstract")
export abstract class AnnotatingElementMeta extends ElementMeta {
    protected _annotations: AnnotationMeta[] = [];

    protected get unlinkAnnotation(): (a: AnnotationMeta) => void {
        return (a) => {
            const target = a.element();
            if (!a.isImplied && target) target["removeExplicitAnnotatingElement"](this);
        };
    }

    /**
     * Adds owned annotations and returns the new number of annotations.
     * Annotations don't own of their targets.
     */
    addAnnotation(...annotation: Edge<AnnotationMeta, ElementMeta>[]): number {
        return this.addOwnedEdges(this._annotations, annotation, ([a, target]) => {
            if (!a.isImplied) target["addExplicitAnnotatingElement"](this);
        });
    }

    /**
     * Removes and unlinks annotations by value and returns the new number of annotations.
     */
    removeAnnotation(...annotation: readonly AnnotationMeta[]): number {
        return this.removeOwnedElements(this._annotations, annotation, this.unlinkAnnotation);
    }

    /**
     * Removes and unlinks annotations by predicate and returns the new number of annotations.
     */
    removeAnnotationIf(predicate: (value: AnnotationMeta) => boolean): number {
        return this.removeOwnedElementsIf(this._annotations, predicate, this.unlinkAnnotation);
    }

    annotations(): readonly AnnotationMeta[] {
        return this._annotations;
    }

    annotatedElements(): readonly ElementMeta[] {
        const annotations = this.annotations();
        const owner = this.owner();
        if (annotations.length === 0 && owner) return [owner];
        return annotations.map((a) => a.element()).filter(NonNullable);
    }

    override ast(): AnnotatingElement | undefined {
        return this._ast as AnnotatingElement;
    }

    protected collectParts(): ElementParts {
        return [["about", this._annotations]];
    }

    protected static applyAnnotatingElementOptions(
        model: AnnotatingElementMeta,
        options: AnnotatingElementOptions
    ): void {
        if (options.annotations) model.addAnnotation(...options.annotations);
    }

    protected static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: AnnotatingElementOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as AnnotatingElementMeta;
        if (options) AnnotatingElementMeta.applyAnnotatingElementOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface AnnotatingElement {
        $meta: AnnotatingElementMeta;
    }
}
