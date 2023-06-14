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
import { Definition, Usage } from "../../generated/ast";
import { enumerable } from "../../utils";
import { ClassifierMeta, ClassifierOptions } from "../KerML/classifier";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";

export interface DefinitionOptions extends ClassifierOptions {
    isVariation?: boolean;
    isIndividual?: boolean;
}

@metamodelOf(Definition)
export class DefinitionMeta extends ClassifierMeta {
    protected _isVariation = false;
    isIndividual = false;

    @enumerable
    override get isAbstract(): boolean {
        return this._isAbstract || this.isVariation;
    }
    override set isAbstract(value) {
        this._isAbstract = value;
    }

    @enumerable
    get isVariation(): boolean {
        return this._isVariation;
    }
    set isVariation(value) {
        this._isVariation = value;
    }

    override ast(): Definition | undefined {
        return this._ast as Definition;
    }

    getSubjectParameter(): Usage | undefined {
        return;
    }

    protected static applyDefinitionOptions(
        model: DefinitionMeta,
        options: DefinitionOptions
    ): void {
        model._isVariation = Boolean(options.isVariation);
        model.isIndividual = Boolean(options.isIndividual);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: DefinitionOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as DefinitionMeta;
        if (options) DefinitionMeta.applyDefinitionOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Definition {
        $meta: DefinitionMeta;
    }
}
