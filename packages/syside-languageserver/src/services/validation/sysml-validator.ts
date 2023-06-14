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

import * as ast from "../../generated/ast";
import {
    ActionUsageMeta,
    AllocationUsageMeta,
    AnalysisCaseUsageMeta,
    AttributeUsageMeta,
    BasicMetamodel,
    CalculationUsageMeta,
    CaseUsageMeta,
    ConnectionUsageMeta,
    ConstraintUsageMeta,
    ElementMeta,
    EnumerationUsageMeta,
    ExpressionMeta,
    FeatureMeta,
    FlowConnectionDefinitionMeta,
    FlowConnectionUsageMeta,
    InterfaceDefinitionMeta,
    InterfaceUsageMeta,
    ItemUsageMeta,
    MetadataUsageMeta,
    ObjectiveMembershipMeta,
    OccurrenceUsageMeta,
    OperatorExpressionMeta,
    PartUsageMeta,
    PortUsageMeta,
    RenderingUsageMeta,
    RequirementUsageMeta,
    RequirementVerificationMembershipMeta,
    SendActionUsageMeta,
    StateDefinitionMeta,
    StateUsageMeta,
    SubjectMembershipMeta,
    SuccessionAsUsageMeta,
    TransitionUsageMeta,
    TypeMeta,
    UsageMeta,
    UseCaseUsageMeta,
    VerificationCaseUsageMeta,
    ViewDefinitionMeta,
    ViewUsageMeta,
    ViewpointUsageMeta,
} from "../../model";
import { SysMLType } from "../sysml-ast-reflection";
import { KerMLValidator } from "./kerml-validator";
import { ModelValidationAcceptor, validateSysML } from "./validation-registry";

/**
 * Implementation of custom validations.
 */
export class SysMLValidator extends KerMLValidator {
    @validateSysML(ast.Usage)
    validateUsage(node: UsageMeta, accept: ModelValidationAcceptor): void {
        const isVariation = (m: ElementMeta | undefined): boolean => {
            return Boolean(m?.isAny(ast.Definition, ast.Usage) && m.isVariation);
        };

        const parent = node.parent();
        if (parent?.is(ast.VariantMembership)) {
            if (!isVariation(node.owner())) {
                accept("error", "Variant is not owned by a variation", {
                    element: parent,
                });
            }
        } else if (
            isVariation(node.owner()) &&
            !node.parent()?.isAny(ast.ParameterMembership, ast.ObjectiveMembership)
        ) {
            accept("error", "Variation can only own variants, parameters and objectives", {
                element: node.parent() ?? node,
            });
        }
    }

    @validateSysML(ast.AttributeUsage)
    validateAttributeTypes(node: AttributeUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.DataType, accept);
    }

    @validateSysML(ast.EnumerationUsage)
    validateEnumerationUsage(node: EnumerationUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.EnumerationDefinition, accept);
    }

    @validateSysML(ast.OccurrenceUsage, [ast.ItemUsage, ast.PortUsage, ast.Step])
    validateOccurrenceUsage(node: OccurrenceUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.Class, accept);
    }

    @validateSysML(ast.ItemUsage, [ast.PartUsage, ast.PortUsage, ast.MetadataUsage])
    validateItemUsage(node: ItemUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.Structure, accept);
    }

    @validateSysML(ast.PartUsage, [ast.ConnectionUsage, ast.ViewUsage, ast.RenderingUsage])
    validatePartUsage(node: PartUsageMeta, accept: ModelValidationAcceptor): void {
        if (this.validateAllTypings(node, ast.Structure, accept)) {
            this.validateAtLeastTyping(node, ast.PartDefinition, accept);
        }
    }

    @validateSysML(ast.ActionUsage, [ast.StateUsage, ast.CalculationUsage, ast.FlowConnectionUsage])
    validateActionUsage(node: ActionUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.Behavior, accept);
    }

    @validateSysML(ast.ConstraintUsage, [ast.RequirementUsage])
    validateConstraintUsage(node: ConstraintUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.Predicate, accept);
    }

    @validateSysML(ast.CalculationUsage, [ast.CaseUsage])
    validateCalculationUsage(node: CalculationUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.SysMLFunction, accept);
    }

    @validateSysML(ast.CaseUsage, [
        ast.AnalysisCaseUsage,
        ast.VerificationCaseUsage,
        ast.UseCaseUsage,
    ])
    validateCaseUsage(node: CaseUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.CaseDefinition, accept);
    }

    @validateSysML(ast.AnalysisCaseUsage)
    validateAnalysisCaseUsage(node: AnalysisCaseUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.AnalysisCaseDefinition, accept);
    }

    @validateSysML(ast.VerificationCaseUsage)
    validateVerificationCaseUsage(
        node: VerificationCaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(node, ast.VerificationCaseDefinition, accept);
    }

    @validateSysML(ast.UseCaseUsage)
    validateUseCaseUsage(node: UseCaseUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.UseCaseDefinition, accept);
    }

    @validateSysML(ast.OccurrenceUsage)
    validateIndividualUsage(node: OccurrenceUsageMeta, accept: ModelValidationAcceptor): void {
        if (!node.isIndividual) return;
        if (
            node.allTypings().filter((t) => t.is(ast.OccurrenceDefinition) && t.isIndividual)
                .length !== 1
        ) {
            accept(
                "error",
                "Individual OccurrenceUsage must be typed by exactly one individual OccurrenceDefinition",
                { element: node }
            );
        }
    }

    @validateSysML(ast.ConnectionUsage, [
        ast.FlowConnectionUsage,
        ast.InterfaceUsage,
        ast.AllocationUsage,
    ])
    validateConnectionUsage(node: ConnectionUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.Association, accept);
    }

    @validateSysML(ast.FlowConnectionUsage)
    validateFlowConnectionUsage(
        node: FlowConnectionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(node, ast.Interaction, accept);
    }

    @validateSysML(ast.InterfaceUsage)
    validateInterfaceUsage(node: InterfaceUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.InterfaceDefinition, accept);
    }

    @validateSysML(ast.AllocationUsage)
    validateAllocationUsage(node: AllocationUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.AllocationDefinition, accept);
    }

    @validateSysML(ast.PortUsage)
    validatePortUsage(node: PortUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.PortDefinition, accept);
    }

    @validateSysML(ast.RequirementUsage, [ast.ViewpointUsage])
    validateRequirementUsage(node: RequirementUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.RequirementDefinition, accept);
    }

    @validateSysML(ast.StateUsage)
    validateStateUsage(node: StateUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(node, ast.Behavior, accept);
    }

    @validateSysML(ast.ViewUsage)
    validateViewUsage(node: ViewUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.ViewDefinition, accept);
    }

    @validateSysML(ast.ViewpointUsage)
    validateViewpointUsage(node: ViewpointUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.ViewpointDefinition, accept);
    }

    @validateSysML(ast.RenderingUsage)
    validateRenderingUsage(node: RenderingUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.RenderingDefinition, accept);
    }

    @validateSysML(ast.MetadataUsage)
    /* istanbul ignore next (maybe impossible to trigger since grammar disallows
        non-metaclass references) */
    validateMetadataUsage(node: MetadataUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.Metaclass, accept);
    }

    @validateSysML(ast.ViewDefinition)
    @validateSysML(ast.ViewUsage)
    validateViewRenderings(
        node: ViewDefinitionMeta | ViewUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.atMostOneFeature(node, ast.RenderingUsage, accept);
    }

    @validateSysML(ast.StateDefinition)
    @validateSysML(ast.StateUsage)
    validateStateSubactions(
        node: StateDefinitionMeta | StateUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const subactions = node
            .featureMembers()
            .filter(BasicMetamodel.is(ast.StateSubactionMembership));
        for (const kind of ["do", "entry", "exit"])
            this.atMostOne(
                subactions.filter((m) => m.kind === kind),
                accept,
                `At most one ${kind} subaction is allowed`
            );
    }

    @validateSysML(ast.FlowConnectionDefinition)
    validateFlowConnectionDefinitionEnds(
        node: FlowConnectionDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const ends = node.ownedEnds();
        if (ends.length <= 2) return;
        this.apply(ends, "At most 2 end features are allowed in FlowConnectionDefinition", accept);
    }

    @validateSysML(ast.InterfaceDefinition)
    @validateSysML(ast.InterfaceUsage)
    validateInterfaceEnds(
        node: InterfaceDefinitionMeta | InterfaceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            node.ownedEnds().filter((f) => !f.is(ast.PortUsage)),
            "An interface definition end must be a port",
            accept
        );
    }

    @validateSysML(ast.SubjectMembership)
    validateSubjectMembers(node: SubjectMembershipMeta, accept: ModelValidationAcceptor): void {
        this.atMostOneMember(node, ast.SubjectMembership, accept);
    }

    @validateSysML(ast.ObjectiveMembership)
    validateObjectiveMembers(node: ObjectiveMembershipMeta, accept: ModelValidationAcceptor): void {
        this.atMostOneMember(node, ast.ObjectiveMembership, accept);
    }

    @validateSysML(ast.RequirementVerificationMembership)
    validateRequirementVerificationMembership(
        node: RequirementVerificationMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.isLegalVerification())
            accept(
                "error",
                "A requirement verification must be owned by the objective of a verification case",
                { element: node }
            );
    }

    @validateSysML(ast.SendActionUsage)
    validateSendActionUsage(node: SendActionUsageMeta, accept: ModelValidationAcceptor): void {
        if (!node.sender?.element() && !node.receiver?.element())
            accept(
                "error",
                "Send action usage must have at least either a sender ('via') or receiver ('to')",
                { element: node }
            );
        else {
            const receiver = node.receiver?.element()?.value?.element();
            if (
                (receiver?.is(ast.FeatureReferenceExpression) &&
                    receiver.expression?.element()?.is(ast.PortUsage)) ||
                (receiver?.is(ast.FeatureChainExpression) &&
                    receiver.featureMembers()[0].element()?.basicFeature().is(ast.PortUsage))
            ) {
                accept(
                    "warning",
                    "Sending to a port should be done through 'via' instead of 'to'",
                    { element: node }
                );
            }
        }
    }

    @validateSysML(ast.SuccessionAsUsage)
    @validateSysML(ast.TransitionUsage)
    validateNotParallel(
        node: SuccessionAsUsageMeta | TransitionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.owner();
        if (owner?.isAny(ast.StateDefinition, ast.StateUsage) && owner.isParallel) {
            accept("error", "Parallel state cannot have successions or transitions", {
                element: node,
            });
        }
    }

    @validateSysML(ast.OperatorExpression, [
        ast.CollectExpression,
        ast.SelectExpression,
        ast.FeatureChainExpression,
    ])
    validateQuantityExpression(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator === "'['") {
            const arg = node.operands.at(1);
            if (!arg) return;
            if (!this.resultConforms(arg, "MeasurementReferences::TensorMeasurementReference")) {
                accept(
                    "warning",
                    "Invalid quantity expression, expected a measurement reference unit",
                    { element: node, property: "operands", index: 1 }
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

    protected validateAllTypings(
        node: FeatureMeta,
        bound: SysMLType,
        accept: ModelValidationAcceptor
    ): boolean {
        if (node.allTypings().some((t) => !t.is(bound))) {
            accept("error", `${node.nodeType()} must be typed by ${bound}`, { element: node });
            return false;
        }

        return true;
    }

    protected validateAtLeastTyping(
        node: FeatureMeta,
        bound: SysMLType,
        accept: ModelValidationAcceptor
    ): boolean {
        if (!node.allTypings().find((t) => t.is(bound))) {
            accept("error", `${node.nodeType()} must be typed by at least one ${bound}`, {
                element: node,
            });
            return false;
        }

        return true;
    }

    protected validateExactlyOneTyping(
        node: FeatureMeta,
        bound: SysMLType,
        accept: ModelValidationAcceptor
    ): boolean {
        const typings = node.allTypings();
        if (typings.length !== 1 || !typings.find((t) => t.is(bound))) {
            accept("error", `${node.nodeType()} must be typed by exactly one ${bound}`, {
                element: node,
            });
            return false;
        }

        return true;
    }
}
