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
    Element,
    Comment,
    TextualAnnotatingElement,
    Feature,
    Namespace,
    Type,
    OperatorExpression,
    Definition,
    InvocationExpression,
    AnnotatingElement,
    Expression,
    Step,
    InlineExpression,
    Multiplicity,
    Subsetting,
    Redefinition,
    ReferenceSubsetting,
    MultiplicityRange,
    Documentation,
    MetadataFeature,
    MetadataUsage,
    TextualRepresentation,
} from "../../generated/ast";
import { typeIndex } from "../types";

test.concurrent.each([
    [Element, []],
    [Comment, [TextualAnnotatingElement, AnnotatingElement, Element]],
    [Feature, [Type, Namespace, Element]],
    [
        OperatorExpression,
        [
            InvocationExpression,
            InlineExpression,
            Expression,
            Step,
            Feature,
            Type,
            Namespace,
            Element,
        ],
    ],
])("type inheritance is sorted in inheritance order: %s", (type: string, expected: string[]) => {
    expect(Array.from(typeIndex.getInheritanceChain(type))).toStrictEqual(expected);
});

test.concurrent.each([
    [
        AnnotatingElement,
        [
            Comment,
            Documentation,
            MetadataFeature,
            MetadataUsage,
            TextualAnnotatingElement,
            TextualRepresentation,
        ],
    ],
    [Multiplicity, [MultiplicityRange]],
    [Subsetting, [Redefinition, ReferenceSubsetting]],
])("%s have subtypes computed", (supertype, subtypes) => {
    expect(subtypes).toEqual(expect.arrayContaining(Array.from(typeIndex.getSubtypes(supertype))));
});

test("map values are propagated to unset subtypes with `expandToDerivedTypes`", () => {
    expect(
        Object.fromEntries(
            typeIndex.expandToDerivedTypes({
                Type: Type,
                Element: Element,
                Definition: Definition,
            })
        )
    ).toMatchObject({
        Element: Element,
        Namespace: Element,
        Type: Type,
        Feature: Type,
        Definition: Definition,
        ConnectionDefinition: Definition,
    });
});

test("mapped arrays are expanded and merged with subtypes with `expandAndMerge`", () => {
    expect(
        Object.fromEntries(
            typeIndex.expandAndMerge({
                Type: [Type],
                Element: [Element],
            })
        )
    ).toMatchObject({
        Element: [Element],
        Namespace: [Element],
        Type: expect.arrayContaining([Type, Element]),
        Feature: expect.arrayContaining([Type, Element]),
    });
});
