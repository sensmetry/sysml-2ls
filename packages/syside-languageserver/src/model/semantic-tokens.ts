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

//! Changes to the following need to be reflected in package.json

import {
    AllSemanticTokenTypes,
    AllSemanticTokenModifiers,
    DefaultSemanticTokenOptions,
} from "langium";
import {
    SemanticTokenTypes,
    SemanticTokenModifiers,
    SemanticTokensOptions,
} from "vscode-languageserver";
import { SysMLType } from "../services";
import { typeIndex } from "./types";
import { ElementMeta } from "./KerML";
import { Type, Classifier, Feature } from "../generated/ast";
import { HighlightCommand } from "../utils";

/**
 * Semantic token types used by the SysML language server
 */
export const SysMLSemanticTokenTypes = {
    // builtin
    class: SemanticTokenTypes.class,
    comment: SemanticTokenTypes.comment,
    enum: SemanticTokenTypes.enum,
    enumMember: SemanticTokenTypes.enumMember,
    event: SemanticTokenTypes.event,
    function: SemanticTokenTypes.function,
    interface: SemanticTokenTypes.interface,
    keyword: SemanticTokenTypes.keyword,
    macro: SemanticTokenTypes.macro,
    method: SemanticTokenTypes.method,
    modifier: SemanticTokenTypes.modifier,
    namespace: SemanticTokenTypes.namespace,
    number: SemanticTokenTypes.number,
    operator: SemanticTokenTypes.operator,
    parameter: SemanticTokenTypes.parameter,
    property: SemanticTokenTypes.property,
    regexp: SemanticTokenTypes.regexp,
    string: SemanticTokenTypes.string,
    struct: SemanticTokenTypes.struct,
    type: SemanticTokenTypes.type,
    typeParameter: SemanticTokenTypes.typeParameter,
    variable: SemanticTokenTypes.variable,
    decorator: SemanticTokenTypes.decorator,

    // custom, need to be registered in package.json
    annotation: "annotation",
    annotationBody: "annotationBody",
    relationship: "relationship",
    metaclass: "metaclass",
};

/**
 * Semantic highlights to be used with `text` printer command. Has no modifiers.
 */
export const SysMLHighlightType = Object.fromEntries(
    Object.entries(SysMLSemanticTokenTypes).map(([k, v]) => [k, { type: v }] as const)
) as Record<keyof typeof SysMLSemanticTokenTypes, HighlightCommand>;

/**
 * Semantic token modifiers used by the SysML language server
 */
export const SysMLSemanticTokenModifiers = {
    // builtin
    abstract: SemanticTokenModifiers.abstract,
    async: SemanticTokenModifiers.async,
    declaration: SemanticTokenModifiers.declaration,
    defaultLibrary: SemanticTokenModifiers.defaultLibrary,
    definition: SemanticTokenModifiers.definition,
    deprecated: SemanticTokenModifiers.deprecated,
    documentation: SemanticTokenModifiers.documentation,
    modification: SemanticTokenModifiers.modification,
    readonly: SemanticTokenModifiers.readonly,
    static: SemanticTokenModifiers.static,

    // custom, need to be registered in package.json
};
//! -------------------------------------------------------------------

// register custom types and modifiers, have to do it on global variables...
Object.values(SysMLSemanticTokenTypes).forEach(
    (name, index) => (AllSemanticTokenTypes[name] = index)
);

Object.values(SysMLSemanticTokenModifiers).forEach(
    (name, index) => (AllSemanticTokenModifiers[name] = 1 << index)
);

/**
 * Default semantic tokens options implemented by the SysML language server
 */
export const DefaultSysMLSemanticTokenOptions: SemanticTokensOptions = {
    ...DefaultSemanticTokenOptions,
    legend: {
        tokenTypes: Object.keys(SysMLSemanticTokenTypes),
        tokenModifiers: Object.keys(SysMLSemanticTokenModifiers),
    },
};

/**
 * Basic types to semantic tokens map for name and reference highlighting
 */
const TYPE_TOKENS: { readonly [K in SysMLType]?: string } = {
    Namespace: SysMLSemanticTokenTypes.namespace,
    Type: SysMLSemanticTokenTypes.type,
    Feature: SysMLSemanticTokenTypes.variable,
    Class: SysMLSemanticTokenTypes.class,
    Structure: SysMLSemanticTokenTypes.struct,
    Comment: SysMLSemanticTokenTypes.annotation,
    TextualRepresentation: SysMLSemanticTokenTypes.annotation,
    EnumerationDefinition: SysMLSemanticTokenTypes.enum,
    EnumerationUsage: SysMLSemanticTokenTypes.enumMember,
    SysMLFunction: SysMLSemanticTokenTypes.function,
    Expression: SysMLSemanticTokenTypes.method,
    LiteralNumber: SysMLSemanticTokenTypes.number,
    LiteralString: SysMLSemanticTokenTypes.string,
    Relationship: SysMLSemanticTokenTypes.relationship,
    Metaclass: SysMLSemanticTokenTypes.metaclass,
    Association: SysMLSemanticTokenTypes.type,
    AssociationStructure: SysMLSemanticTokenTypes.struct,
};

let _tokenMap: Map<string, string> | undefined;

function tokenMap(): Map<string, string> {
    return (_tokenMap ??= typeIndex.expandToDerivedTypes(TYPE_TOKENS));
}

export function tokenType(element: ElementMeta): string | undefined {
    return tokenMap().get(element.nodeType());
}

/**
 * Compute semantic token modifiers for {@link node}
 * @param node
 * @returns array of modifier names
 */

export function tokenModifiers(node: ElementMeta): string[] {
    const mods: string[] = [];

    if (node.is(Type) && node.isAbstract) {
        mods.push(SysMLSemanticTokenModifiers.abstract);
    }
    if (node.is(Classifier)) {
        mods.push(SysMLSemanticTokenModifiers.definition);
    }
    if (node.isStandardElement) {
        mods.push(SysMLSemanticTokenModifiers.defaultLibrary);
    }
    if (node.is(Feature) && node.isReadonly) {
        mods.push(SysMLSemanticTokenModifiers.readonly);
    }

    return mods;
}
