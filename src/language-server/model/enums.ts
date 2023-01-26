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

import * as ast from "../generated/ast";
import { Visibility } from "../utils/ast-util";
import { stringifyFlags } from "../utils/common";

/**
 * Build state
 */
export type BuildState = "none" | "active" | "completed";

export function getVisibility(visibility?: ast.VisibilityKind): Visibility {
    switch (visibility) {
        case "protected":
            return Visibility.protected;
        case "private":
            return Visibility.private;
        case "public":
        case undefined:
            return Visibility.public;
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

/**
 * only the qualified element is imported
 */
type SpecificImport = "specific";

/**
 * import elements contained in the imported namespace
 */
type WildcardImport = "wildcard";

/**
 * recursively import all elements including itself
 */
type RecursiveImport = "recursive";

/**
 * recursively import all elements excluding itself
 */
type RecursiveExclusiveImport = "recursiveExclusive";

export type ImportKind =
    | SpecificImport
    | WildcardImport
    | RecursiveImport
    | RecursiveExclusiveImport;

export function getImportKind(kind?: ast.ImportKind): ImportKind {
    switch (kind) {
        case "::*":
            return "wildcard";
        case "::**":
            return "recursive";
        case "::*::**":
            return "recursiveExclusive";
        case undefined:
            return "specific";
    }
}

export type RequirementConstraintKind = "none" | "assumption" | "requirement";

export function getRequirementConstraintKind(
    kind?: ast.RequirementConstraintKind
): RequirementConstraintKind {
    switch (kind) {
        case "assume":
            return "assumption";
        case "require":
            return "requirement";
        case undefined:
            return "none";
    }
}

export type ParameterKind = "none" | "actor" | "stakeholder";

export function getParameterKind(part: ast.PartUsage): ParameterKind {
    return part.parameterKind ?? "none";
}

export type RequirementKind = "none" | "verification" | "objective";

export function getRequirementKind(requirement: ast.RequirementUsage): RequirementKind {
    switch (requirement.requirementKind) {
        case "objective":
            return "objective";
        case "verify":
            return "verification";
        case undefined:
            return "none";
    }
}

export const enum SpecializationKind {
    None = 0,
    Specialization = 1,
    Subclassification = (1 << 1) | Specialization,
    Typing = (1 << 2) | Specialization,
    ConjugatedPortTyping = (1 << 3) | Typing,
    Conjugation = 1 << 4,
    Subsetting = (1 << 5) | Specialization,
    Redefinition = (1 << 6) | Subsetting,
    Reference = (1 << 7) | Subsetting,
}

const SpecializationNames = new Map<SpecializationKind, string>([
    [SpecializationKind.None, "None"],
    [SpecializationKind.Specialization, "Specialization"],
    [SpecializationKind.Subclassification, "Subclassification"],
    [SpecializationKind.Typing, "Typing"],
    [SpecializationKind.ConjugatedPortTyping, "ConjugatedPortTyping"],
    [SpecializationKind.Conjugation, "Conjugation"],
    [SpecializationKind.Subsetting, "Subsetting"],
    [SpecializationKind.Redefinition, "Redefinition"],
    [SpecializationKind.Reference, "Reference"],
]);

export function getSpecializationKind(ref: ast.ElementReference): SpecializationKind {
    switch (ref.$containerProperty) {
        case "subsets":
            return SpecializationKind.Subsetting;
        case "redefines":
            return SpecializationKind.Redefinition;
        case "typedBy":
            return SpecializationKind.Typing;
        case "references":
            return SpecializationKind.Reference;
        case "conjugates": {
            if (ast.isUsage(ref.$container)) return SpecializationKind.ConjugatedPortTyping;
            return SpecializationKind.Conjugation;
        }
        case "specializes": {
            const owner = ref.$container;
            if (ast.isClassifier(owner)) return SpecializationKind.Subclassification;
            return SpecializationKind.Specialization;
        }
        default:
            return SpecializationKind.None;
    }
}

export function getSpecializationKindString(kind: SpecializationKind): string {
    return SpecializationNames.get(kind) ?? "<unknown>";
}

export type StateSubactionKind = "do" | "entry" | "exit" | "none";

export function getStateSubactionKind(ref: ast.ActionUsage): StateSubactionKind {
    return ref.actionKind ?? "none";
}
