/********************************************************************************
 * Copyright (c) 2022-2023 Sensmetry UAB and others
 *
 * model program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * model Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { AstNode } from "langium";
import { SysMLInterface, SysMLType } from "../services";
import * as ast from "../generated/ast";
import {
    ActionUsageMeta,
    BasicMetamodel,
    ConjugatedPortDefinitionMeta,
    ExpressionMeta,
    FeatureMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityRangeMeta,
    OwningMembershipMeta,
    ParameterMembershipMeta,
    RelationshipMeta,
    getFeatureDirectionKind,
    getTransitionFeatureKind,
    getVisibility,
    prettyAnnotationBody,
    typeIndex,
} from "../model";

type AstToModelFunction<T extends AstNode = AstNode> = (
    model: NonNullable<T["$meta"]>,
    node: T
) => void;

const AstToModel: {
    [K in SysMLType]?: AstToModelFunction<SysMLInterface<K>>;
} & { default: AstToModelFunction } = {
    default(model, node) {
        model["_ast"] = node;
        model["setParent"](node.$container?.$meta);
    },

    [ast.FeatureReferenceExpression](model, node) {
        model["_expression"] = node.expression.$meta as MembershipMeta<FeatureMeta>;
    },

    [ast.LiteralBoolean](model, node) {
        model.literal = node.literal;
    },

    [ast.LiteralNumber](model, node) {
        // only check the cst node text for exponential or decimal notation
        model["_isInteger"] = !/[eE.]/.test(node.$cstNode?.text ?? "");
        model["_literal"] = node.literal;
    },

    [ast.LiteralString](model, node) {
        model.literal = node.literal.slice(1, node.literal.length - 1);
    },

    [ast.OperatorExpression](model, node) {
        if (node.operator) model.operator = `'${node.operator}'`;
        model["_operands"] = node.operands.map((e) => e.$meta);
    },

    [ast.ElementReference](model, node) {
        model.text = node.text ?? node.$cstNode?.text ?? "";
        model.found.length = node.parts.length;
    },

    [ast.FeatureValue](model, node) {
        model.isDefault = node.isDefault;
        model.isInitial = node.isInitial;
    },

    [ast.Import](model, node) {
        model.isRecursive = !!node.isRecursive;
        model["_importsAll"] = node.importsAll;
    },

    [ast.AnnotatingElement](model, node) {
        model.addAnnotation(...node.about.map((a) => a.$meta));
    },

    [ast.Connector](model, node) {
        model["_ends"] = node.ends.map((e) => e.$meta);
    },

    [ast.Element](model, node) {
        model.declaredName = node.declaredName;
        model.declaredShortName = node.declaredShortName;
    },

    [ast.Expression](model, node) {
        model["_result"] = node.result?.$meta;
    },

    [ast.SysMLFunction](model, node) {
        model["_result"] = node.result?.$meta;
    },

    [ast.Feature](model, node) {
        model.value = node.value?.$meta;
        model.isOrdered = node.isOrdered;

        model.direction = getFeatureDirectionKind(node.direction);
        model.isPortion = !!node.isPortion;
        model.isComposite = !!node.isComposite || model.isPortion;
        model.isReadonly = !!node.isReadOnly;
        model.isDerived = !!node.isDerived;
        model.isEnd = !!node.isEnd;

        model.isOrdered = node.isOrdered;
        model.isNonUnique = node.isNonunique;
    },

    [ast.Invariant](model, node) {
        model.isNegated = node.isNegated;
    },

    [ast.LibraryPackage](model, node) {
        model.isStandard = node.isStandard;
    },

    [ast.MultiplicityRange](model, node) {
        model["_range"] = node.range?.$meta as OwningMembershipMeta<ExpressionMeta>;
    },

    [ast.Namespace](model, node) {
        model["_prefixes"].length = 0;
        model["_children"].clear();

        model["_prefixes"].push(
            ...node.prefixes.map((m) => m.$meta as OwningMembershipMeta<MetadataFeatureMeta>)
        );
        model["_children"].add(...node.children.map((child) => child.$meta));
    },

    [ast.Relationship](model, node) {
        model["_visibility"] = getVisibility(node.visibility);
        if (node.element) model["_element"] = node.element.$meta;
        else if (node.targetChain) model["_element"] = node.targetChain.$meta;
        else model["_element"] = undefined;

        if (node.sourceChain) model["_source"] = node.sourceChain.$meta;

        model["_children"].add(...node.elements.map((e) => e.$meta));
    },

    [ast.TextualAnnotatingElement](model, node) {
        // Body may fail to parse and be left undefined so check here
        if (node.body as string | undefined) model.body = prettyAnnotationBody(node.body);
    },

    [ast.TextualRepresentation](model, node) {
        model.language = node.language.substring(1, node.language.length - 1);
    },

    [ast.Type](model, node) {
        model["_isAbstract"] = !!node.isAbstract;
        model["_multiplicity"] = node.multiplicity
            ?.$meta as OwningMembershipMeta<MultiplicityRangeMeta>;

        model["_heritage"].clear();
        model["_heritage"].add(...node.heritage.map((e) => e.$meta));

        model["_typeRelationships"].clear();
        model["_typeRelationships"].add(...node.typeRelationships.map((e) => e.$meta));
    },

    [ast.RequirementConstraintMembership](model, node) {
        model.kind = node.kind === "assume" ? "assumption" : "requirement";
    },

    [ast.StateSubactionMembership](model, node) {
        model.kind = node.kind;
    },

    [ast.TransitionFeatureMembership](model, node) {
        model.kind = getTransitionFeatureKind(node);
    },

    [ast.AcceptActionUsage](model, node) {
        (model["_payload"] as RelationshipMeta | undefined) = node.payload.$meta;
        (model["_receiver"] as RelationshipMeta | undefined) = node.receiver?.$meta;
    },

    [ast.ActionUsage](model, node) {
        model.isParallel = node.isParallel;
    },

    [ast.AssignmentActionUsage](model, node) {
        (model.targetMember as RelationshipMeta) = node.targetMember.$meta;
        (model.assignedValue as RelationshipMeta) = node.assignedValue.$meta;
    },

    [ast.Definition](model, node) {
        model.isIndividual = node.isIndividual;
        model["_isVariation"] = node.isVariation;
    },

    [ast.ForLoopActionUsage](model, node) {
        (model.variable as RelationshipMeta) = node.variable.$meta;
        (model.sequence as RelationshipMeta) = node.sequence.$meta;
        (model.body as RelationshipMeta) = node.body.$meta;
    },

    [ast.IfActionUsage](model, node) {
        model["_condition"] = node.condition.$meta as ParameterMembershipMeta<ExpressionMeta>;
        model["_then"] = node.then.$meta as ParameterMembershipMeta<ActionUsageMeta>;
        model["_else"] = node.else?.$meta as ParameterMembershipMeta<ActionUsageMeta>;
    },

    [ast.PortDefinition](model, node) {
        model["_conjugatedDefinition"] = node.conjugated
            ?.$meta as OwningMembershipMeta<ConjugatedPortDefinitionMeta>;
    },

    [ast.SatisfyRequirementUsage](model, node) {
        model["_satisfactionSubject"] = node.satisfactionSubject?.$meta;
    },

    [ast.SendActionUsage](model, node) {
        (model.payload as RelationshipMeta | undefined) = node.payload.$meta;
        (model.sender as RelationshipMeta | undefined) = node.sender?.$meta;
        (model.receiver as RelationshipMeta | undefined) = node.receiver?.$meta;
    },

    [ast.StateDefinition](model, node) {
        model.isParallel = node.isParallel;
    },

    [ast.TransitionUsage](model, node) {
        (model["_source"] as RelationshipMeta | undefined) = node.source?.$meta;
        (model["_payload"] as RelationshipMeta | undefined) = node.payload?.$meta;
        (model["_accepter"] as RelationshipMeta | undefined) = node.accepter?.$meta;
        (model["_transitionLinkSource"] as RelationshipMeta | undefined) =
            node.transitionLinkSource?.$meta;
        (model["_guard"] as RelationshipMeta | undefined) = node.guard?.$meta;
        (model["_effect"] as RelationshipMeta | undefined) = node.effect?.$meta;
        (model["_then"] as RelationshipMeta | undefined) = node.then?.$meta;
        (model["_else"] as RelationshipMeta | undefined) = node.else?.$meta;
    },

    [ast.Usage](model, node) {
        model.isVariation = node.isVariation;
        model.isIndividual = node.isIndividual;
        model.isReference = node.isReference;
        model.portionKind = node.portionKind;
    },

    [ast.WhileLoopActionUsage](model, node) {
        (model.condition as RelationshipMeta | undefined) = node.condition?.$meta;
        (model.body as RelationshipMeta | undefined) = node.body.$meta;
        (model.until as RelationshipMeta | undefined) = node.until?.$meta;
    },
};

type ClearArtifactsFunction<T extends AstNode = AstNode> = (model: NonNullable<T["$meta"]>) => void;

const ClearArtifacts: { [K in SysMLType]?: ClearArtifactsFunction<SysMLInterface<K>> } & {
    default: ClearArtifactsFunction;
} = {
    default(model) {
        model.setupState = "none";
    },

    [ast.Element](model) {
        model["_comments"] = model["_comments"].filter((e) => e.owner() === model);
        model["_docs"] = model["_docs"].filter((e) => e.owner() === model);
        model["_reps"] = model["_reps"].filter((e) => e.owner() === model);
        model["_metadata"] = model["_metadata"].filter((e) => e.owner() === model);
        model["_metaclass"] = "unset";

        // remove stale lookup members due to reference resolution/heritage
        const garbage: string[] = [];
        for (const [key, value] of model.namedMembers) {
            if (typeof value === "string") {
                garbage.push(key);
            }
        }

        garbage.forEach((key) => model["_memberLookup"].delete(key));
    },

    [ast.Feature](model) {
        // reset effective names
        model["setName"](model.declaredName);
        model["setShortName"](model.declaredShortName);
    },

    [ast.ElementReference](model) {
        model.to.reset();
        model.found.fill(undefined);
    },

    [ast.Namespace](model) {
        model["_importResolutionState"] = "none";
    },

    [ast.Relationship](model) {
        // remove unowned target element
        if (model.element()?.parent() !== model) model["_element"] = undefined;
        if (model.source() === model.parent() || model.source()?.parent() === model) return;
        model["_source"] = undefined;
    },

    [ast.Type](model) {
        // remove implicit and out-of-line relationships
        const heritage = model.heritage.filter((e) => !e.isImplied && e.parent() === model);
        model["_heritage"].clear();
        model["_heritage"].add(...heritage);

        const typeRelationships = model.typeRelationships.filter(
            (e) => !e.isImplied && e.parent() === model
        );
        model["_typeRelationships"].clear();
        model["_typeRelationships"].add(...typeRelationships);

        model["resetInputParameters"]();
    },

    [ast.Association](model) {
        model["resetEnds"]();
    },

    [ast.Connector](model) {
        model["resetEnds"]();
    },

    [ast.MultiplicityRange](model) {
        model["_bounds"] = "unset";
    },
};

let Ast2ModelChains: Map<string, AstToModelFunction[]> | undefined;

/**
 * Initialize `model` from the parsed AST node `node`
 * @param model
 * @param node
 */
export function astToModel<T extends AstNode>(model: NonNullable<T["$meta"]>, node: T): void {
    if (!Ast2ModelChains) {
        Ast2ModelChains = typeIndex.chain(
            AstToModel as Partial<Record<SysMLType, AstToModelFunction>>,
            "supertype-first"
        );
    }

    Ast2ModelChains.get(node.$type)?.forEach((fn) => fn(model, node));
}

let ClearArtifactsChains: Map<string, ClearArtifactsFunction[]> | undefined;

/**
 * Clear build artifacts from `model` element
 * @param model
 */
export function clearArtifacts(model: BasicMetamodel): void {
    if (!ClearArtifactsChains) {
        ClearArtifactsChains = typeIndex.chain(
            ClearArtifacts as Partial<Record<SysMLType, ClearArtifactsFunction>>,
            // reverse order of the initialization
            "subtype-first"
        );
    }

    ClearArtifactsChains.get(model.nodeType())?.forEach((fn) => fn(model));
}
