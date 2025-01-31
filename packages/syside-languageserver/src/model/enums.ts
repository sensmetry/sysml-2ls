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

import { assertUnreachable } from "langium";
import * as ast from "../generated/ast";
import { stringifyFlags } from "../utils/common";
import { Visibility } from "../utils/scope-util";

/**
 * Build state
 */
export type BuildState = "none" | "active" | "completed";

export function getVisibility(visibility?: ast.VisibilityKind): Visibility | undefined {
    switch (visibility) {
        case "protected":
            return Visibility.protected;
        case "private":
            return Visibility.private;
        case "public":
            return Visibility.public;
        case undefined:
            return;
    }
}

export type FeatureDirectionKind = "in" | "out" | "inout" | "none";

export function getFeatureDirectionKind(kind?: ast.FeatureDirectionKind): FeatureDirectionKind {
    return kind ?? "none";
}

export function conjugateDirectionKind(kind: FeatureDirectionKind): FeatureDirectionKind {
    switch (kind) {
        case "in":
            return "out";
        case "out":
            return "in";
        case "inout":
            return "inout";
        case "none":
            return "none";
    }
}

export const enum TypeClassifier {
    None = 0,
    DataType = 1 << 0,
    Class = 1 << 1,
    Structure = 1 << 2,
    Association = 1 << 3,
    AssociationStruct = Structure | Association,
}

const TypeClassifierNames = new Map([
    [TypeClassifier.None, "None"],
    [TypeClassifier.DataType, "DataType"],
    [TypeClassifier.Class, "Class"],
    [TypeClassifier.Structure, "Structure"],
    [TypeClassifier.Association, "Association"],
    [TypeClassifier.AssociationStruct, "AssociationStruct"],
]);

export function getTypeClassifierString(v: number): string {
    return stringifyFlags(v, TypeClassifierNames);
}

export type RequirementConstraintKind = "assumption" | "requirement";

export function getRequirementConstraintKind(
    node: ast.RequirementConstraintMembership
): RequirementConstraintKind {
    switch (node.kind) {
        case "assume":
            return "assumption";
        case "require":
        case undefined:
            return "requirement";
    }
}

export type StateSubactionKind = ast.StateSubactionMembership["kind"];

export type TransitionFeatureKind = ast.TransitionFeatureKind;

export function getTransitionFeatureKind(
    node: ast.TransitionFeatureMembership
): TransitionFeatureKind {
    switch (node.kind) {
        case "accept":
            return "trigger";
        case "do":
            return "effect";
        case "if":
            return "guard";
        default:
            assertUnreachable(node.kind);
    }
}

export function getTransitionFeatureKindText(kind: TransitionFeatureKind): string {
    switch (kind) {
        case "trigger":
            return "accept";
        case "effect":
            return "do";
        case "guard":
            return "if";
        default:
            assertUnreachable(kind);
    }
}
