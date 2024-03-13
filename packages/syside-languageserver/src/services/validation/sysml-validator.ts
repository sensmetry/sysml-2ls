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

import { stream } from "langium";
import * as ast from "../../generated/ast";
import {
    AcceptActionUsageMeta,
    ActionUsageMeta,
    ActorMembershipMeta,
    AllocationUsageMeta,
    AnalysisCaseUsageMeta,
    AssociationStructMeta,
    AttributeUsageMeta,
    BasicMetamodel,
    CalculationUsageMeta,
    CaseDefinitionMeta,
    CaseUsageMeta,
    ClassMeta,
    ConjugatedPortDefinitionMeta,
    ConnectionUsageMeta,
    ConstraintUsageMeta,
    ControlNodeMeta,
    DataTypeMeta,
    DefinitionMeta,
    ElementMeta,
    EnumerationUsageMeta,
    EventOccurrenceUsageMeta,
    ExhibitStateUsageMeta,
    ExposeMeta,
    ExpressionMeta,
    FeatureMeta,
    FlowConnectionDefinitionMeta,
    FlowConnectionUsageMeta,
    IncludeUseCaseUsageMeta,
    InteractionMeta,
    InterfaceDefinitionMeta,
    InterfaceUsageMeta,
    ItemUsageMeta,
    MetadataUsageMeta,
    OPERATORS,
    ObjectiveMembershipMeta,
    OccurrenceDefinitionMeta,
    OccurrenceUsageMeta,
    OperatorExpressionMeta,
    ParameterMembershipMeta,
    PartUsageMeta,
    PerformActionUsageMeta,
    PortDefinitionMeta,
    PortUsageMeta,
    ReferenceSubsettingMeta,
    RenderingUsageMeta,
    RequirementConstraintMembershipMeta,
    RequirementDefinitionMeta,
    RequirementUsageMeta,
    RequirementVerificationMembershipMeta,
    SendActionUsageMeta,
    StakeholderMembershipMeta,
    StateDefinitionMeta,
    StateSubactionMembershipMeta,
    StateUsageMeta,
    SubjectMembershipMeta,
    SuccessionAsUsageMeta,
    TransitionFeatureMembershipMeta,
    TransitionUsageMeta,
    TypeMeta,
    UsageMeta,
    UseCaseUsageMeta,
    VariantMembershipMeta,
    VerificationCaseUsageMeta,
    ViewDefinitionMeta,
    ViewRenderingMembershipMeta,
    ViewUsageMeta,
    ViewpointUsageMeta,
} from "../../model";
import { KeysMatching } from "../../utils";
import { SubtypeKeys, SysMLType } from "../sysml-ast-reflection";
import { KerMLValidator } from "./kerml-validator";
import { ModelDiagnosticInfo, ModelValidationAcceptor, validateSysML } from "./validation-registry";

/**
 * Implementation of custom validations.
 */
export class SysMLValidator extends KerMLValidator {
    // validateDefinitionNonVariationMembership - duplicate with validateVariantMembershipOwningNamespace

    protected isVariation(node: ElementMeta): boolean {
        return node.isAny(ast.Usage, ast.Definition) ? node.isVariation : false;
    }

    @validateSysML(ast.Definition)
    @validateSysML(ast.Usage)
    validateVariationMembership(
        node: DefinitionMeta | UsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.isVariation) {
            const [type, code] = node.is(ast.Usage)
                ? [ast.Usage, "validateUsageVariationMembership"]
                : [ast.Definition, "validateDefinitionVariationMembership"];
            this.apply(
                "error",
                node
                    .ownedElements()
                    .filter(BasicMetamodel.is(ast.FeatureMembership))
                    .filter((m) => !m.isAny(ast.ParameterMembership, ast.ObjectiveMembership)),
                `All ownedMemberships of variation ${type} must be VariantMemberships.`,
                accept,
                { code }
            );
        }
    }

    @validateSysML(ast.Definition)
    @validateSysML(ast.Usage)
    validateVariationSpecialization(
        node: DefinitionMeta | UsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.isVariation) {
            const [type, code, sup] = node.is(ast.Usage)
                ? [ast.Usage, "validateUsageVariationSpecialization", "Definition or Usage"]
                : [ast.Definition, "validateDefinitionVariationSpecialization", ast.Definition];
            this.apply(
                "error",
                node.specializations().filter((s) => {
                    const target = s.element();
                    return target && this.isVariation(target);
                }),
                `A variation ${type} may not specialize any other variation ${sup}.`,
                accept,
                { code }
            );
        }
    }

    // validateReferenceUsageIsReference - implicitly ensured by the model
    // validateUsageNonVariationMembership - duplicate with validateVariantMembershipOwningNamespace

    /* // too restrictive such that pilot skips this for now
    @validateSysML(ast.Usage)
    validateUsageOwningType(node: UsageMeta, accept: ModelValidationAcceptor): void {
        if (node.owningType && !node.owningType.isAny(ast.Usage, ast.Definition)) {
            accept(
                "error",
                "Usage must either have no owning type, or it must be a Definition or a Usage.",
                {
                    element: node,
                    code: "validateUsageOwningType",
                }
            );
        }
    }
    */

    @validateSysML(ast.VariantMembership)
    validateVariantMembershipOwningNamespace(
        node: VariantMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.parent();
        if (!owner || !this.isVariation(owner)) {
            accept(
                "error",
                "The membershipOwningNamespace of a VariantMembership must be a variation-point Definition or Usage.",
                {
                    element: node,
                    keyword: "variant",
                    code: "validateVariantMembershipOwningNamespace",
                }
            );
        }
    }

    // TODO: validateAttributeUsageFeatures - seems to be blocked by KERML-4
    // validateAttributeUsageIsReference - implicitly ensured by the model
    // TODO: validateAttributeDefinitionFeatures - seems to be blocked by KERML-4

    @validateSysML(ast.AttributeUsage)
    validateAttributeUsageTyping(node: AttributeUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.DataType,
            accept,
            "An AttributeUsage must be typed by DataTypes only.",
            { code: "validateAttributeUsageTyping" }
        );
    }

    // validateEnumerationDefinitionIsVariation - implicitly ensured by the model

    @validateSysML(ast.EnumerationUsage)
    validateEnumerationUsageTyping(
        node: EnumerationUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        // not in spec but, only in pilot
        this.validateExactlyOneTyping(
            node,
            ast.EnumerationDefinition,
            accept,
            "An EnumerationUsage must be typed by exactly one EnumerationDefinition.",
            { code: "validateEnumerationUsageTyping" }
        );
    }

    // validateEventOccurrenceUsageIsReference - implicitly ensured by the model

    @validateSysML(ast.EventOccurrenceUsage)
    validateEventOccurrenceUsageReference(
        node: EventOccurrenceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.EventOccurrenceUsage,
            reference: ast.OccurrenceUsage,
            info: { code: "validateEventOccurrenceUsageReference" },
        });
    }

    // validateLifeClassIsSufficient - implicitly ensured by the model

    @validateSysML(ast.OccurrenceDefinition)
    validateOccurrenceDefinitionLifeClass(
        node: OccurrenceDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const members = node.children
            .filter(BasicMetamodel.is(ast.OwningMembership))
            .filter((m) => m.element().nodeType() === ast.LifeClass);
        if (node.lifeClass) members.push(node.lifeClass);

        if (node.isIndividual) {
            if (members.length !== 1) {
                this.apply(
                    "error",
                    members,
                    "Individual OccurrenceDefinitions must have exactly one LifeClass ownedMember",
                    accept,
                    { code: "validateOccurrenceDefinitionLifeClass" }
                );
            }
        } else if (members.length > 0) {
            this.apply(
                "error",
                members,
                "Non-individual OccurrenceDefinitions must have node LifeClass ownedMember",
                accept,
                { code: "validateOccurrenceDefinitionLifeClass" }
            );
        }
    }

    @validateSysML(ast.OccurrenceUsage, [ast.ItemUsage, ast.PortUsage, ast.Step])
    validateOccurrenceUsageTyping(
        node: OccurrenceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(
            node,
            ast.Class,
            accept,
            "OccurrenceDefinition must be typed by Classes only.",
            { code: "validateOccurrenceUsageTyping" }
        );
    }

    @validateSysML(ast.OccurrenceUsage)
    validateOccurrenceUsageIndividual(
        node: OccurrenceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const types = node
            .allTypings()
            .filter(BasicMetamodel.is(ast.OccurrenceDefinition))
            .filter((t) => t.isIndividual);

        if (types.length > 1) {
            accept(
                "error",
                "An OccurrenceUsage must have at most one occurrenceDefinition with isIndividual = true.",
                { element: node, code: "validateOccurrenceUsageIndividualDefinition" }
            );
        } else if (node.isIndividual && types.length !== 1) {
            accept("error", "An individual OccurrenceUsage must an individualDefinition.", {
                element: node,
                code: "validateOccurrenceUsageIndividualUsage",
            });
        }
    }

    @validateSysML(ast.ItemUsage, [ast.PartUsage, ast.PortUsage, ast.MetadataUsage])
    validateItemUsageTyping(node: ItemUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.Structure,
            accept,
            "ItemUsage must be typed by Structures only.",
            { code: "validateItemUsageTyping" }
        );
    }

    @validateSysML(ast.PartUsage, [ast.ConnectionUsage])
    validatePartUsageTyping(node: PartUsageMeta, accept: ModelValidationAcceptor): void {
        if (
            this.validateAllTypings(
                node,
                ast.Structure,
                accept,
                "PartUsage must be typed by Structures only",
                { code: "validatePartUsageTyping" }
            )
        ) {
            this.validateAtLeastTyping(
                node,
                ast.PartDefinition,
                accept,
                "At least one of the itemDefinitions of a PartUsage must be a PartDefinition.",
                { code: "validatePartUsagePartDefinition" }
            );
        }
    }

    // validateConjugatedPortDefinitionConjugatedPortDefinitionIsEmpty - implicitly ensured by the model

    // this will usually be satisfied implictly by the model
    @validateSysML(ast.ConjugatedPortDefinition)
    validateConjugatedPortDefinitionOriginalPortDefinition(
        node: ConjugatedPortDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            node.originalPortDefinition !==
            node.specializations(ast.PortConjugation).at(0)?.element()
        ) {
            accept(
                "error",
                "The originalPortDefinition of the ownedPortConjugator of a ConjugatedPortDefinition must be the originalPortDefinition of the ConjugatedPortDefinition.",
                { element: node, code: "validateConjugatedPortDefinitionOriginalPortDefinition" }
            );
        }
    }

    // this will be satisfied by the grammar but not when creating through code
    @validateSysML(ast.PortDefinition, [ast.ConjugatedPortDefinition])
    validatePortDefinitionConjugatedPortDefinition(
        node: PortDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const conjugates = node.children
            .filter(BasicMetamodel.is(ast.OwningMembership))
            .filter((m) => m.element().is(ast.ConjugatedPortDefinition));
        if (node.conjugatedDefinition) conjugates.push(node.conjugatedDefinition);
        if (conjugates.length !== 1) {
            this.apply(
                "error",
                conjugates,
                "A PortDefinition must have exactly one ownedMember that is a ConjugatedPortDefinition.",
                accept,
                { code: "validatePortDefinitionConjugatedPortDefinition" }
            );
        }
    }

    @validateSysML(ast.PortDefinition)
    @validateSysML(ast.PortUsage)
    validatePortOwnedUsagesNotComposite(
        node: PortDefinitionMeta | PortUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const usages = node
            .ownedFeatures()
            .filter(BasicMetamodel.is(ast.Usage))
            .filter((u) => !u.is(ast.PortUsage) && u.isComposite);

        const [type, member, code] = node.is(ast.PortDefinition)
            ? [ast.PortDefinition, "ownedUsages", "validatePortDefinitionOwnedUsagesNotComposite"]
            : [ast.PortUsage, "nestedUsages", "validatePortUsageNestedUsagesNotComposite"];
        this.apply(
            "error",
            usages,
            `The ${member} of a ${type} that are not PortUsages must not be composite.`,
            accept,
            { code }
        );
    }

    @validateSysML(ast.PortUsage)
    validatePortUsageTyping(node: PortUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.PortDefinition,
            accept,
            "PortUsages must be typed by PortDefinitions only.",
            { code: "validatePortUsageTyping" }
        );
    }

    // validatePortUsageIsReference - implicitly ensured by the model

    @validateSysML(ast.ConnectionUsage, [
        ast.FlowConnectionUsage,
        ast.InterfaceUsage,
        ast.AllocationUsage,
    ])
    validateConnectionUsageTyping(
        node: ConnectionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(
            node,
            ast.Association,
            accept,
            "ConnectionUsages must be typed by Associations only.",
            { code: "validateConnectionUsageTyping" }
        );
    }

    @validateSysML(ast.FlowConnectionDefinition)
    validateFlowConnectionEnd(
        node: FlowConnectionDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const ends = node.ownedEnds();
        if (ends.length <= 2) return;
        this.apply("error", ends, "FlowConnectionDefinition can have at most 2 ends.", accept, {
            code: "validateFlowConnectionEnd",
        });
    }

    @validateSysML(ast.FlowConnectionUsage)
    validateFlowConnectionUsageTyping(
        node: FlowConnectionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(
            node,
            ast.Interaction,
            accept,
            "FlowConnectionUsages must be typed by Interactions only.",
            { code: "validateFlowConnectionUsageTyping" }
        );
    }

    @validateSysML(ast.InterfaceDefinition)
    @validateSysML(ast.InterfaceUsage)
    validateInterfaceEnds(
        node: InterfaceDefinitionMeta | InterfaceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.InterfaceDefinition)
            ? [ast.InterfaceDefinition, "validateInterfaceDefinitionEnd"]
            : [ast.InterfaceUsage, "validateInterfaceUsageEnd"];
        this.apply(
            "error",
            node.ownedEnds().filter((f) => !f.is(ast.PortUsage)),
            `An ${type} end must be a port.`,
            accept,
            { code }
        );
    }

    @validateSysML(ast.InterfaceUsage)
    validateInterfaceUsageTyping(node: InterfaceUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.InterfaceDefinition,
            accept,
            "InterfaceUsages must be typed by InterfaceDefinitions only.",
            { code: "validateInterfaceUsageTyping" }
        );
    }

    @validateSysML(ast.AllocationUsage)
    validateAllocationUsageTyping(
        node: AllocationUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(
            node,
            ast.AllocationDefinition,
            accept,
            "AllocationUsages must be typed by AllocationDefinitions only.",
            { code: "validateAllocationUsageTyping" }
        );
    }

    @validateSysML(ast.AcceptActionUsage)
    validateAcceptActionUsageParameters(
        node: AcceptActionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkParameters(node, ["payload", "receiver"], accept, {
            type: ast.AcceptActionUsage,
            info: { code: "validateAcceptActionUsageParameters" },
        });
    }

    @validateSysML(ast.ActionUsage, [ast.StateUsage, ast.CalculationUsage, ast.FlowConnectionUsage])
    validateActionUsageTyping(node: ActionUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.Behavior,
            accept,
            "ActionUsages must be typed by Behaviors only.",
            { code: "validateActionUsageTyping" }
        );
    }

    // TODO: validateControlNodeIncomingSuccessions (not in pilot)
    // TODO: validateControlNodeOutgoingSuccessions (not in pilot)

    @validateSysML(ast.ControlNode)
    validateControlNodeOwningType(node: ControlNodeMeta, accept: ModelValidationAcceptor): void {
        if (!node.owningType?.isAny(ast.ActionDefinition, ast.ActionUsage)) {
            accept(
                "error",
                "The owningType of a ControlNode must be an ActionDefinition or ActionUsage.",
                { element: node, code: "validateControlNodeOwningType" }
            );
        }
    }

    // TODO: validateDecisionNodeIncomingSuccessions (not in pilot)
    // TODO: validateDecisionNodeOutgoingSuccessions (not in pilot)
    // TODO: validateForkNodeIncomingSuccessions (not in pilot)
    // TODO: validateJoinNodeOutgoingSuccessions (not in pilot)
    // TODO: validateMergeNodeIncomingSuccessions (not in pilot)
    // TODO: validateMergeNodeOutgoingSuccessions (not in pilot)

    @validateSysML(ast.PerformActionUsage, [ast.ExhibitStateUsage, ast.IncludeUseCaseUsage])
    validatePerformActionUsageReference(
        node: PerformActionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.PerformActionUsage,
            reference: ast.ActionUsage,
            info: { code: "validatePerformActionUsageReference" },
        });
    }

    @validateSysML(ast.SendActionUsage)
    validateSendActionParameters(node: SendActionUsageMeta, accept: ModelValidationAcceptor): void {
        this.checkParameters(node, ["payload", "sender", "receiver"], accept, {
            type: ast.SendActionUsage,
            info: { code: "validateSendActionParameters" },
        });
    }

    @validateSysML(ast.SendActionUsage)
    validateSendActionReceiver(node: SendActionUsageMeta, accept: ModelValidationAcceptor): void {
        const receiver = node.receiver?.element()?.value?.element();
        if (
            (receiver?.is(ast.FeatureReferenceExpression) &&
                receiver.expression?.element()?.is(ast.PortUsage)) ||
            (receiver?.is(ast.FeatureChainExpression) &&
                receiver.featureMembers()[0].element()?.basicFeature().is(ast.PortUsage))
        ) {
            accept("warning", "Sending to a port should be done through 'via' instead of 'to'", {
                element: node.receiver,
                code: "validateSendActionReceiver",
            });
        }
    }

    @validateSysML(ast.ExhibitStateUsage)
    validateExhibitStateUsageReference(
        node: ExhibitStateUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.ExhibitStateUsage,
            reference: ast.StateUsage,
            info: { code: "validateExhibitStateUsageReference" },
        });
    }

    @validateSysML(ast.StateSubactionMembership)
    validateStateSubactionMembershipOwningType(
        node: StateSubactionMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.StateDefinition, ast.StateUsage)) {
            accept(
                "error",
                "The owningType of a StateSubactionMembership must be a StateDefinition or a StateUsage.",
                { element: node, code: "validateStateSubactionMembershipOwningType" }
            );
        }
    }

    // TODO: validateStateDefinitionIsParallelGeneralization (not in pilot)

    @validateSysML(ast.SuccessionAsUsage)
    @validateSysML(ast.TransitionUsage)
    validateStateParallelSubactions(
        node: SuccessionAsUsageMeta | TransitionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.owningType;
        if (owner?.isAny(ast.StateDefinition, ast.StateUsage) && owner.isParallel) {
            const [type, member, code] = owner.is(ast.StateDefinition)
                ? [ast.StateDefinition, "ownedActions", "validateStateDefinitionParallelSubactions"]
                : [ast.StateUsage, "nestedActions", "validateStateUsageParallelSubactions"];
            accept(
                "error",
                `Parallel ${type} ${member} must not have any incomingTransitions or outgoingTransitions.`,
                { element: node, code }
            );
        }
    }

    @validateSysML(ast.StateDefinition)
    @validateSysML(ast.StateUsage)
    validateStateSubactionKind(
        node: StateDefinitionMeta | StateUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const subactions = node
            .featureMembers()
            .filter(BasicMetamodel.is(ast.StateSubactionMembership));

        const [type, code] = node.is(ast.StateDefinition)
            ? [ast.StateDefinition, "validateStateDefinitionStateSubactionKind"]
            : [ast.StateUsage, "validateStateUsageStateSubactionKind"];
        for (const kind of ["do", "entry", "exit"])
            this.atMostOne(
                "error",
                subactions.filter((m) => m.kind === kind),
                accept,
                `A ${type} must not have more than one owned StateSubactionMembership of kind ${kind}.`,
                { code }
            );
    }

    @validateSysML(ast.StateUsage)
    validateStateUsageTyping(node: StateUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.Behavior,
            accept,
            "StateUsages must be typed by Behaviors only.",
            { code: "validateStateUsageTyping" }
        );
    }

    // implicitly ensured by the type system for the most part
    @validateSysML(ast.TransitionFeatureMembership)
    validateTransitionFeatureMembership(
        node: TransitionFeatureMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.element();
        if (!target) return;

        switch (node.kind) {
            case "effect": {
                if (!target.is(ast.ActionUsage))
                    accept("error", "TransitionFeature of kind effect must be an ActionUsage.", {
                        element: target,
                        code: "validateTransitionFeatureMembershipEffectAction",
                    });
                return;
            }

            case "guard": {
                if (!target.is(ast.Expression) || !this.isBoolean(target))
                    accept(
                        "error",
                        "TransitionFeature of kind guard must be a boolean expression.",
                        {
                            element: target,
                            code: "validateTransitionFeatureMembershipGuardExpression",
                        }
                    );
                return;
            }

            case "trigger": {
                if (!target.is(ast.AcceptActionUsage))
                    accept(
                        "error",
                        "TransitionFeature of kind trigger must be an AcceptActionUsage.",
                        {
                            element: target,
                            code: "validateTransitionFeatureMembershipTriggerAction",
                        }
                    );
                return;
            }
        }
    }

    @validateSysML(ast.TransitionFeatureMembership)
    validateTransitionFeatureMembershipOwningType(
        node: TransitionFeatureMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.is(ast.TransitionUsage))
            accept(
                "error",
                "The owningType of a TransitionFeatureMembership must be a TransitionUsage.",
                { element: node, code: "validateTransitionFeatureMembershipOwningType" }
            );
    }

    /* istanbul ignore next */ // here for parity with pilot
    @validateSysML(ast.TransitionUsage)
    validateTransitionUsageParameters(
        node: TransitionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        // should be ensured by the type system but TS makes it easy to steal
        // other references
        if (!node.transitionLinkSource)
            accept("error", "A TransitionUsage must have a transitionLinkSource.", {
                element: node,
                code: "validateTransitionUsageParameters",
            });

        if (node.accepter && !node.payload) {
            accept("error", "A TransitionUsage with a triggerAction must have a payload.", {
                element: node,
                code: "validateTransitionUsageParameters",
            });
        }
    }

    @validateSysML(ast.TransitionUsage)
    validateTransitionUsageSuccession(
        node: TransitionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const succession = stream([node.then, node.else], node.children)
            .filter(BasicMetamodel.is(ast.OwningMembership))
            .map((m) => m.element())
            .filter(BasicMetamodel.is(ast.SuccessionAsUsage))
            .head();

        if (
            !succession
                ?.relatedFeatures()
                .slice(1)
                .every((f) => f?.basicFeature().is(ast.ActionUsage))
        ) {
            accept(
                "error",
                "A TransitionUsage must have an ownedMember that is a Succession with an ActionUsage as its targetFeature.",
                { element: succession ?? node, code: "validateTransitionUsageSuccession" }
            );
        }
    }

    @validateSysML(ast.CalculationUsage, [ast.CaseUsage])
    validateCalculationUsageTyping(
        node: CalculationUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.SysMLFunction,
            accept,
            "CalculationUsages must be typed by exactly one Function.",
            { code: "validateCalculationUsageTyping" }
        );
    }

    @validateSysML(ast.ConstraintUsage, [ast.RequirementUsage])
    validateConstraintUsageTyping(
        node: ConstraintUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.Predicate,
            accept,
            "ConstraintUsages must be typed by exactly one Predicate.",
            { code: "validateConstraintUsageTyping" }
        );
    }

    @validateSysML(ast.SubjectMembership)
    validateSubjectMembershipOwningType(
        node: SubjectMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            !node
                .owner()
                ?.isAny(
                    ast.RequirementUsage,
                    ast.RequirementDefinition,
                    ast.CaseDefinition,
                    ast.CaseUsage
                ) &&
            // pilot allows for some reason
            !node.parent()?.parent()?.is(ast.RequirementConstraintMembership)
        )
            accept(
                "error",
                `The owningType of SubjectMembership must be a RequirementDefinition, RequirementUsage, CaseDefinition, or CaseUsage.`,
                { element: node, code: `validateSubjectMembershipOwningType` }
            );
    }

    @validateSysML(ast.ActorMembership)
    validateActorMembershipOwningType(
        node: ActorMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            !node
                .owner()
                ?.isAny(
                    ast.RequirementUsage,
                    ast.RequirementDefinition,
                    ast.CaseDefinition,
                    ast.CaseUsage
                )
        )
            accept(
                "error",
                `The owningType of ActorMembership must be a RequirementDefinition, RequirementUsage, CaseDefinition, or CaseUsage.`,
                { element: node, code: `validateActorMembershipOwningType` }
            );
    }

    // validateFramedConcernUsageConstraintKind - implicitly ensured by the model

    @validateSysML(ast.RequirementConstraintMembership)
    validateRequirementConstraintMembershipIsComposite(
        node: RequirementConstraintMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.element()?.isComposite)
            accept(
                "error",
                "The ownedConstraint of a RequirementConstraintMembership must be composite.",
                { element: node, code: "validateRequirementConstraintMembershipIsComposite" }
            );
    }

    @validateSysML(ast.RequirementConstraintMembership)
    @validateSysML(ast.StakeholderMembership)
    validateRequirementMembershipOwningType(
        node: RequirementConstraintMembershipMeta | StakeholderMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.RequirementUsage, ast.RequirementDefinition))
            accept(
                "error",
                `The owningType of an ${node.nodeType()} must be a RequirementDefinition or RequirementUsage.`,
                { element: node, code: `validate${node.nodeType()}OwningType` }
            );
    }

    @validateSysML(ast.RequirementDefinition)
    @validateSysML(ast.RequirementUsage)
    validateRequirementOnlyOneSubject(
        node: RequirementDefinitionMeta | RequirementUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.RequirementDefinition)
            ? [ast.RequirementDefinition, "validateRequirementDefinitionOnlyOneSubject"]
            : [ast.RequirementUsage, "validateRequirementUsageOnlyOneSubject"];
        this.atMostOneMember(
            node,
            ast.SubjectMembership,
            accept,
            `A ${type} must have at most one featureMembership that is a SubjectMembership.`,
            { code }
        );
    }

    @validateSysML(ast.RequirementDefinition)
    @validateSysML(ast.RequirementUsage)
    validateRequirementSubjectParameterPosition(
        node: RequirementDefinitionMeta | RequirementUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.RequirementDefinition)
            ? [ast.RequirementDefinition, "validateRequirementDefinitionSubjectParameterPosition"]
            : [ast.RequirementUsage, "validateRequirementUsageSubjectParameterPosition"];

        this.checkFirstInput(
            node,
            node.featuresByMembership(ast.SubjectMembership).head(),
            accept,
            `The subjectParameter of a ${type} must be its first input.`,
            { code }
        );
    }

    @validateSysML(ast.RequirementUsage, [ast.ViewpointUsage])
    validateRequirementUsageTyping(
        node: RequirementUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.RequirementDefinition,
            accept,
            "RequirementUsages must be typed by exactly one RequirementDefinition.",
            { code: "validateRequirementUsageTyping" }
        );
    }

    @validateSysML(ast.CaseDefinition)
    @validateSysML(ast.CaseUsage)
    validateCaseDefinitionOnlyOneSubject(
        node: CaseDefinitionMeta | CaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.CaseDefinition)
            ? [ast.CaseDefinition, "validateCaseDefinitionOnlyOneSubject"]
            : [ast.CaseUsage, "validateCaseUsageOnlyOneSubject"];
        this.atMostOneMember(
            node,
            ast.SubjectMembership,
            accept,
            `A ${type} must have at most one featureMembership that is a SubjectMembership.`,
            { code }
        );
    }

    @validateSysML(ast.CaseDefinition)
    @validateSysML(ast.CaseUsage)
    validateCaseOnlyOneObjective(
        node: CaseDefinitionMeta | CaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.CaseDefinition)
            ? [ast.CaseDefinition, "validateCaseDefinitionOnlyOneObjective"]
            : [ast.CaseUsage, "validateCaseUsageOnlyOneObjective"];
        this.atMostOneMember(
            node,
            ast.ObjectiveMembership,
            accept,
            `A ${type} must have at most one featureMembership that is a ObjectiveMembership.`,
            { code }
        );
    }

    @validateSysML(ast.CaseDefinition)
    @validateSysML(ast.CaseUsage)
    validateCaseSubjectParameterPosition(
        node: CaseDefinitionMeta | CaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.CaseDefinition)
            ? [ast.CaseDefinition, "validateCaseDefinitionSubjectParameterPosition"]
            : [ast.CaseUsage, "validateCaseUsageSubjectParameterPosition"];

        this.checkFirstInput(
            node,
            node.featuresByMembership(ast.SubjectMembership).head(),
            accept,
            `The subjectParameter of a ${type} must be its first input.`,
            { code }
        );
    }

    @validateSysML(ast.CaseUsage, [
        ast.AnalysisCaseUsage,
        ast.VerificationCaseUsage,
        ast.UseCaseUsage,
    ])
    validateCaseUsageTyping(node: CaseUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.CaseDefinition,
            accept,
            "CaseUsages must be typed by exactly one CaseDefinition.",
            { code: "validateCaseUsageTyping" }
        );
    }

    @validateSysML(ast.ObjectiveMembership)
    validateObjectiveMembershipIsComposite(
        node: ObjectiveMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.element()?.isComposite)
            accept("error", "The ownedConstraint of a ObjectiveMembership must be composite.", {
                element: node,
                code: "validateObjectiveMembershipIsComposite",
            });
    }

    @validateSysML(ast.ObjectiveMembership)
    validateObjectiveMembershipOwningType(
        node: ObjectiveMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.CaseUsage, ast.CaseDefinition))
            accept(
                "error",
                `The owningType of an ObjectiveMembership must be a CaseDefinition or CaseUsage.`,
                { element: node, code: `validateObjectiveMembershipOwningType` }
            );
    }

    @validateSysML(ast.AnalysisCaseUsage)
    validateAnalysisCaseUsageTyping(
        node: AnalysisCaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.AnalysisCaseDefinition,
            accept,
            "AnalysisCaseUsages must be typed by exactly one AnalysisCaseDefinition",
            { code: "validateAnalysisCaseUsageTyping" }
        );
    }

    // validateRequirementVerificationMembershipKind - implicitly ensured by the model

    @validateSysML(ast.RequirementVerificationMembership)
    validateRequirementVerificationMembershipOwningType(
        node: RequirementVerificationMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.isLegalVerification())
            accept(
                "error",
                "The owningType of a RequirementVerificationMembership must be a RequirementUsage that is owned by an ObjectiveMembership.",
                { element: node, code: "validateRequirementVerificationMembershipOwningType" }
            );
    }

    @validateSysML(ast.VerificationCaseUsage)
    validateVerificationCaseUsageTyping(
        node: VerificationCaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.VerificationCaseDefinition,
            accept,
            "VerificationCaseUsages must be typed by exactly one VerificationCaseDefinition.",
            { code: "validateVerificationCaseUsageTyping" }
        );
    }

    @validateSysML(ast.IncludeUseCaseUsage)
    validateIncludeUseCaseUsageReference(
        node: IncludeUseCaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.IncludeUseCaseUsage,
            reference: ast.UseCaseUsage,
            info: { code: "validateIncludeUseCaseUsageReference" },
        });
    }

    @validateSysML(ast.UseCaseUsage)
    validateUseCaseUsageTyping(node: UseCaseUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.UseCaseDefinition,
            accept,
            "UseCaseUsages must be typed by exactly one UseCaseDefinition.",
            { code: "validateUseCaseUsageTyping" }
        );
    }

    // validateExposeIsImportAll - implicitly ensured by the model

    @validateSysML(ast.Expose)
    validateExposeOwningNamespace(node: ExposeMeta, accept: ModelValidationAcceptor): void {
        if (!node.owner()?.is(ast.ViewUsage)) {
            accept("error", "The importOwningNamespace of an Expose must be a ViewUsage.", {
                element: node,
                code: "validateExposeOwningNamespace",
            });
        }
    }

    @validateSysML(ast.RenderingUsage)
    validateRenderingUsageTyping(node: RenderingUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.RenderingDefinition,
            accept,
            "RenderingUsages must be typed by exactly one RenderingDefinition.",
            { code: "validateRenderingUsageTyping" }
        );
    }

    @validateSysML(ast.ViewDefinition)
    @validateSysML(ast.ViewUsage)
    validateViewDefinitionOnlyOneViewRendering(
        node: ViewDefinitionMeta | ViewUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.ViewDefinition)
            ? [ast.ViewDefinition, "validateViewDefinitionOnlyOneViewRendering"]
            : [ast.ViewUsage, "validateViewUsageOnlyOneViewRendering"];

        this.atMostOneMember(
            node,
            ast.ViewRenderingMembership,
            accept,
            `A ${type} must have at most one ViewRenderingMembership.`,
            { code }
        );
    }

    @validateSysML(ast.ViewpointUsage)
    validateViewpointUsageTyping(node: ViewpointUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.ViewpointDefinition,
            accept,
            "ViewpointUsages must be typed by exactly one ViewpointDefinition.",
            { code: "validateViewpointUsageTyping" }
        );
    }

    @validateSysML(ast.ViewRenderingMembership)
    validateViewRenderingMembershipOwningType(
        node: ViewRenderingMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.ViewUsage, ast.ViewDefinition))
            accept(
                "error",
                `The owningType of an ViewRenderingMembership must be a CaseDefinition or CaseUsage.`,
                { element: node, code: `validateViewRenderingMembershipOwningType` }
            );
    }

    @validateSysML(ast.ViewUsage)
    validateViewUsageTyping(node: ViewUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.ViewDefinition,
            accept,
            "ViewUsages must be typed by exactly one ViewDefinition.",
            { code: "validateViewUsageTyping" }
        );
    }

    @validateSysML(ast.MetadataUsage)
    validateMetadataUsageTyping(node: MetadataUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.Metaclass,
            accept,
            "MetadataUsages must be typed by exactly one Metaclass.",
            { code: "validateMetadataUsageTyping" }
        );
    }

    @validateSysML(ast.DataType)
    override validateDatatypeSpecialization(
        node: DataTypeMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization)
                .filter((s) => s.element()?.isAny(ast.Class, ast.Association)),
            "An AttributeDefinition must not specialize a Class or an Association.",
            accept,
            { code: "validateDatatypeSpecialization", property: "targetRef" }
        );
    }

    @validateSysML(ast.Class, [ast.AssociationStructure, ast.Interaction])
    override validateClassSpecialization(node: ClassMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization)
                .filter((s) => s.element()?.isAny(ast.DataType, ast.Association)),
            "An ItemDefinition must not specialize a DataType or an Association.",
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateSysML(ast.AssociationStructure)
    @validateSysML(ast.Interaction)
    override validateAssocStructSpecialization(
        node: AssociationStructMeta | InteractionMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization)
                .filter((s) => s.element()?.isAny(ast.DataType)),
            "A ConnectionDefinition must not specialize a DataType.",
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateSysML(ast.OperatorExpression, [
        ast.CollectExpression,
        ast.SelectExpression,
        ast.FeatureChainExpression,
    ])
    validateOperatorExpressionQuantity(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator === OPERATORS.QUANTITY) {
            const arg = node.operands.at(1);
            /* istanbul ignore next */
            if (!arg) return;
            if (!this.resultConforms(arg, "MeasurementReferences::TensorMeasurementReference")) {
                accept(
                    "warning",
                    "Invalid quantity expression, expected a measurement reference unit",
                    {
                        element: node,
                        property: "operands",
                        index: 1,
                        code: "validateOperatorExpressionQuantity",
                    }
                );
            }
        }
    }

    protected resultConforms(expr: ExpressionMeta, type: string | TypeMeta): boolean {
        const result = expr.returnType();
        if (result && this.index.conforms(result, type)) return true;
        if (expr.is(ast.OperatorExpression)) {
            if (!result) {
                const t = this.index.findType(result);
                if (t && !t.types().some((t) => this.index.conforms(type, t))) return false;
            }

            return expr.args
                .filter(BasicMetamodel.is(ast.Expression))
                .some((arg) => this.resultConforms(arg, type));
        }

        return false;
    }

    protected validateAllTypings<T extends FeatureMeta>(
        node: T,
        bound: SysMLType,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): boolean {
        if (node.allTypings().some((t) => !t.is(bound))) {
            accept("error", message, { ...info, element: node });
            return false;
        }

        return true;
    }

    protected validateAtLeastTyping<T extends FeatureMeta>(
        node: T,
        bound: SysMLType,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): boolean {
        if (!node.allTypings().find((t) => t.is(bound))) {
            accept("error", message, { ...info, element: node });
            return false;
        }

        return true;
    }

    protected validateExactlyOneTyping<T extends FeatureMeta>(
        node: T,
        bound: SysMLType,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): boolean {
        const typings = node.allTypings();
        if (typings.length !== 1 || !typings.find((t) => t.is(bound))) {
            accept("error", message, { ...info, element: node });
            return false;
        }

        return true;
    }

    protected checkReferencing(
        node: FeatureMeta,
        accept: ModelValidationAcceptor,
        options: {
            type: SubtypeKeys<ast.Usage>;
            reference: SubtypeKeys<ast.Usage>;
            info?: Omit<ModelDiagnosticInfo<ReferenceSubsettingMeta>, "element">;
        }
    ): void {
        const ref = node.specializations(ast.ReferenceSubsetting).at(0);
        const target = ref?.finalElement();
        if (ref && target && !target.is(options.reference)) {
            accept(
                "error",
                `ReferenceSubsettings owned by ${options.type} must reference ${options.reference}`,
                { ...options.info, element: ref }
            );
        }
    }

    protected checkParameters<
        T extends FeatureMeta,
        K extends string & KeysMatching<T, ParameterMembershipMeta | undefined>,
    >(
        node: T,
        keys: K[],
        accept: ModelValidationAcceptor,
        options: { type: SubtypeKeys<ast.Usage>; info?: Omit<ModelDiagnosticInfo<T>, "element"> }
    ): void {
        // not checking children since grammar doesn't allow parameter members
        // there, all parameter members (except return) have special slots that
        // should be used instead
        keys.forEach((key) => {
            if (!node[key])
                accept("error", `${options.type} must have ${key} parameter.`, {
                    ...options.info,
                    element: node,
                });
        });
    }

    protected checkFirstInput(
        node: TypeMeta,
        expected: FeatureMeta | undefined,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<FeatureMeta>, "element">
    ): void {
        if (!expected) return;
        const first = node.ownedInputParameters()[0];

        if (first !== expected) {
            accept("error", message, { ...info, element: node.ownedInputParameters()[0] });
        }
    }
}
