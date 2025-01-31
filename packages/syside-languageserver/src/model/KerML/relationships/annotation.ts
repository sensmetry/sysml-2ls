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

import { AstNode, LangiumDocument } from "langium";
import { AnnotatingElement, Annotation } from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    AnnotatingElementMeta,
    ElementMeta,
    RelationshipMeta,
    RelationshipOptionsBody,
} from "../_internal";

export type AnnotationOptions<Parent extends ElementMeta | undefined = ElementMeta> =
    Parent extends AnnotatingElementMeta | undefined
        ? RelationshipOptionsBody<ElementMeta, Parent> & { source?: never } // parent is the source
        : Omit<RelationshipOptionsBody<ElementMeta, Parent>, "target"> & {
              target?: never;
              source: AnnotatingElementMeta;
          };

@metamodelOf(Annotation)
export class AnnotationMeta<T extends ElementMeta = ElementMeta> extends RelationshipMeta<T> {
    override ast(): Annotation | undefined {
        return this._ast as Annotation;
    }

    protected override onParentSet(
        previous: ElementMeta | undefined,
        current: ElementMeta | undefined
    ): void {
        // annotating elements are implicitly sources of annotation
        // clear previous parent member

        if (previous) {
            if (previous === this._source) this._source = undefined;
            else this._element = undefined;
        }

        if (current?.is(AnnotatingElement)) this._source = current;
        else (this._element as ElementMeta | undefined) = current;
    }

    static override create<T extends AstNode, P extends ElementMeta | undefined>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: AnnotationOptions<P>
    ): T["$meta"] {
        const self = ElementMeta.create.call(this, provider, document, options) as AnnotationMeta;

        if (options) {
            self._visibility = options.visibility;
            self._isImplied = Boolean(options.isImplied);
            // type inference breaks down...
            if (options.source) self._source = options.source;
            if (options.target) self.setElement(options.target);
        }
        return self;
    }
}

declare module "../../../generated/ast" {
    interface Annotation {
        $meta: AnnotationMeta;
    }
}
