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

import { ValidationAcceptor } from "langium";
import * as ast from "../../generated/ast";
import { ElementMeta, ExpressionMeta, StateSubactionMembershipMeta, TypeMeta } from "../../model";
import { SysMLType } from "../sysml-ast-reflection";
import { KerMLValidator } from "./kerml-validator";
import { validateSysML } from "./validation-registry";

/**
 * Implementation of custom validations.
 */
export class SysMLValidator extends KerMLValidator {
    @validateSysML(ast.Usage)
    validateUsage(node: ast.Usage, accept: ValidationAcceptor): void {
        const isVariation = (m: ElementMeta | undefined): boolean => {
            return Boolean(m?.isAny(ast.Definition, ast.Usage) && m.isVariation);
        };

        const meta = node.$meta;
        if (meta.parent()?.is(ast.VariantMembership)) {
            if (!isVariation(meta.owner())) {
                accept("error", "Variant is not owned by a variation", {
                    node: meta.parent()?.ast() ?? node,
                });
            }
        } else if (
            isVariation(meta.owner()) &&
            !meta.parent()?.isAny(ast.ParameterMembership, ast.ObjectiveMembership)
        ) {
            accept("error", "Variation can only own variants, parameters and objectives", {
                node: meta.parent()?.ast() ?? node,
            });
        }
    }

    @validateSysML(ast.AttributeUsage)
    validateAttributeTypes(node: ast.AttributeUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.DataType, accept);
    }

    @validateSysML(ast.EnumerationUsage)
    validateEnumerationUsage(node: ast.EnumerationUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.EnumerationDefinition, accept);
    }

    @validateSysML(ast.OccurrenceUsage, [ast.ItemUsage, ast.PortUsage, ast.Step])
    validateOccurrenceUsage(node: ast.OccurrenceUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.Class, accept);
    }

    @validateSysML(ast.ItemUsage, [ast.PartUsage, ast.PortUsage, ast.MetadataUsage])
    validateItemUsage(node: ast.ItemUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.Structure, accept);
    }

    @validateSysML(ast.PartUsage, [ast.ConnectionUsage, ast.ViewUsage, ast.RenderingUsage])
    validatePartUsage(node: ast.PartUsage, accept: ValidationAcceptor): void {
        if (this.validateAllTypings(node, ast.Structure, accept)) {
            this.validateAtLeastTyping(node, ast.PartDefinition, accept);
        }
    }

    @validateSysML(ast.ActionUsage, [ast.StateUsage, ast.CalculationUsage, ast.FlowConnectionUsage])
    validateActionUsage(node: ast.ActionUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.Behavior, accept);
    }

    @validateSysML(ast.ConstraintUsage, [ast.RequirementUsage])
    validateConstraintUsage(node: ast.ConstraintUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.Predicate, accept);
    }

    @validateSysML(ast.CalculationUsage, [ast.CaseUsage])
    validateCalculationUsage(node: ast.CalculationUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.SysMLFunction, accept);
    }

    @validateSysML(ast.CaseUsage, [
        ast.AnalysisCaseUsage,
        ast.VerificationCaseUsage,
        ast.UseCaseUsage,
    ])
    validateCaseUsage(node: ast.CaseUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.CaseDefinition, accept);
    }

    @validateSysML(ast.AnalysisCaseUsage)
    validateAnalysisCaseUsage(node: ast.AnalysisCaseUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.AnalysisCaseDefinition, accept);
    }

    @validateSysML(ast.VerificationCaseUsage)
    validateVerificationCaseUsage(
        node: ast.VerificationCaseUsage,
        accept: ValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(node, ast.VerificationCaseDefinition, accept);
    }

    @validateSysML(ast.UseCaseUsage)
    validateUseCaseUsage(node: ast.UseCaseUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.UseCaseDefinition, accept);
    }

    @validateSysML(ast.OccurrenceUsage)
    validateIndividualUsage(node: ast.OccurrenceUsage, accept: ValidationAcceptor): void {
        if (!node.isIndividual) return;
        if (
            node.$meta.allTypings().filter((t) => t.is(ast.OccurrenceDefinition) && t.isIndividual)
                .length !== 1
        ) {
            accept(
                "error",
                "Individual OccurrenceUsage must be typed by exactly one individual OccurrenceDefinition",
                { node }
            );
        }
    }

    @validateSysML(ast.ConnectionUsage, [
        ast.FlowConnectionUsage,
        ast.InterfaceUsage,
        ast.AllocationUsage,
    ])
    validateConnectionUsage(node: ast.ConnectionUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.Association, accept);
    }

    @validateSysML(ast.FlowConnectionUsage)
    validateFlowConnectionUsage(node: ast.FlowConnectionUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.Interaction, accept);
    }

    @validateSysML(ast.InterfaceUsage)
    validateInterfaceUsage(node: ast.InterfaceUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.InterfaceDefinition, accept);
    }

    @validateSysML(ast.AllocationUsage)
    validateAllocationUsage(node: ast.AllocationUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.AllocationDefinition, accept);
    }

    @validateSysML(ast.PortUsage)
    validatePortUsage(node: ast.PortUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.PortDefinition, accept);
    }

    @validateSysML(ast.RequirementUsage, [ast.ViewpointUsage])
    validateRequirementUsage(node: ast.RequirementUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.RequirementDefinition, accept);
    }

    @validateSysML(ast.StateUsage)
    validateStateUsage(node: ast.StateUsage, accept: ValidationAcceptor): void {
        this.validateAllTypings(node, ast.Behavior, accept);
    }

    @validateSysML(ast.ViewUsage)
    validateViewUsage(node: ast.ViewUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.ViewDefinition, accept);
    }

    @validateSysML(ast.ViewpointUsage)
    validateViewpointUsage(node: ast.ViewpointUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.ViewpointDefinition, accept);
    }

    @validateSysML(ast.RenderingUsage)
    validateRenderingUsage(node: ast.RenderingUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.RenderingDefinition, accept);
    }

    @validateSysML(ast.MetadataUsage)
    /* istanbul ignore next (maybe impossible to trigger since grammar disallows
        non-metaclass references) */
    validateMetadataUsage(node: ast.MetadataUsage, accept: ValidationAcceptor): void {
        this.validateExactlyOneTyping(node, ast.Metaclass, accept);
    }

    @validateSysML(ast.ViewDefinition)
    @validateSysML(ast.ViewUsage)
    validateViewRenderings(
        node: ast.ViewDefinition | ast.ViewUsage,
        accept: ValidationAcceptor
    ): void {
        this.atMostOneFeature(node, ast.RenderingUsage, accept);
    }

    @validateSysML(ast.StateDefinition)
    @validateSysML(ast.StateUsage)
    validateStateSubactions(
        node: ast.StateDefinition | ast.StateUsage,
        accept: ValidationAcceptor
    ): void {
        const subactions = node.$meta
            .featureMembers()
            .filter((m) => m.is(ast.StateSubactionMembership)) as StateSubactionMembershipMeta[];
        for (const kind of ["do", "entry", "exit"])
            this.atMostOne(
                subactions.filter((m) => m.kind === kind),
                accept,
                `At most one ${kind} subaction is allowed`
            );
    }

    @validateSysML(ast.FlowConnectionDefinition)
    validateFlowConnectionDefinitionEnds(
        node: ast.FlowConnectionDefinition,
        accept: ValidationAcceptor
    ): void {
        const ends = node.$meta.ownedEnds();
        if (ends.length <= 2) return;
        this.apply(ends, "At most 2 end features are allowed in FlowConnectionDefinition", accept);
    }

    @validateSysML(ast.InterfaceDefinition)
    @validateSysML(ast.InterfaceUsage)
    validateInterfaceEnds(
        node: ast.InterfaceDefinition | ast.InterfaceUsage,
        accept: ValidationAcceptor
    ): void {
        this.apply(
            node.$meta.ownedEnds().filter((f) => !f.is(ast.PortUsage)),
            "An interface definition end must be a port",
            accept
        );
    }

    @validateSysML(ast.SubjectMembership)
    validateSubjectMembers(node: ast.SubjectMembership, accept: ValidationAcceptor): void {
        this.atMostOneMember(node, ast.SubjectMembership, accept);
    }

    @validateSysML(ast.ObjectiveMembership)
    validateObjectiveMembers(node: ast.ObjectiveMembership, accept: ValidationAcceptor): void {
        this.atMostOneMember(node, ast.ObjectiveMembership, accept);
    }

    @validateSysML(ast.RequirementVerificationMembership)
    validateRequirementVerificationMembership(
        node: ast.RequirementVerificationMembership,
        accept: ValidationAcceptor
    ): void {
        if (!node.$meta.isLegalVerification())
            accept(
                "error",
                "A requirement verification must be owned by the objective of a verification case",
                { node }
            );
    }

    @validateSysML(ast.SendActionUsage)
    validateSendActionUsage(node: ast.SendActionUsage, accept: ValidationAcceptor): void {
        if (!node.$meta.sender?.element() && !node.$meta.receiver?.element())
            accept(
                "error",
                "Send action usage must have at least either a sender ('via') or receiver ('to')",
                { node }
            );
        else {
            const receiver = node.$meta.receiver?.element()?.value?.element();
            if (
                (receiver?.is(ast.FeatureReferenceExpression) &&
                    receiver.expression?.element()?.is(ast.PortUsage)) ||
                (receiver?.is(ast.FeatureChainExpression) &&
                    receiver.featureMembers()[0].element()?.basicFeature().is(ast.PortUsage))
            ) {
                accept(
                    "warning",
                    "Sending to a port should be done through 'via' instead of 'to'",
                    { node }
                );
            }
        }
    }

    @validateSysML(ast.SuccessionAsUsage)
    @validateSysML(ast.TransitionUsage)
    validateNotParallel(
        node: ast.SuccessionAsUsage | ast.TransitionUsage,
        accept: ValidationAcceptor
    ): void {
        const owner = node.$meta.owner();
        if (owner?.isAny(ast.StateDefinition, ast.StateUsage) && owner.isParallel) {
            accept("error", "Parallel state cannot have successions or transitions", { node });
        }
    }

    @validateSysML(ast.OperatorExpression, [
        ast.CollectExpression,
        ast.SelectExpression,
        ast.FeatureChainExpression,
    ])
    validateQuantityExpression(node: ast.OperatorExpression, accept: ValidationAcceptor): void {
        if (node.operator === "[") {
            const arg = node.operands.at(1);
            if (!arg) return;
            if (
                !this.resultConforms(arg.$meta, "MeasurementReferences::TensorMeasurementReference")
            ) {
                accept(
                    "warning",
                    "Invalid quantity expression, expected a measurement reference unit",
                    { node, property: "operands", index: 1 }
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
                .filter((arg): arg is ExpressionMeta => Boolean(arg?.is(ast.Expression)))
                .some((arg) => this.resultConforms(arg, type));
        }

        return false;
    }

    protected validateAllTypings(
        node: ast.Feature,
        bound: SysMLType,
        accept: ValidationAcceptor
    ): boolean {
        if (node.$meta.allTypings().some((t) => !t.is(bound))) {
            accept("error", `${node.$type} must be typed by ${bound}`, { node });
            return false;
        }

        return true;
    }

    protected validateAtLeastTyping(
        node: ast.Feature,
        bound: SysMLType,
        accept: ValidationAcceptor
    ): boolean {
        if (!node.$meta.allTypings().find((t) => t.is(bound))) {
            accept("error", `${node.$type} must be typed by at least one ${bound}`, { node });
            return false;
        }

        return true;
    }

    protected validateExactlyOneTyping(
        node: ast.Feature,
        bound: SysMLType,
        accept: ValidationAcceptor
    ): boolean {
        const typings = node.$meta.allTypings();
        if (typings.length !== 1 || !typings.find((t) => t.is(bound))) {
            accept("error", `${node.$type} must be typed by exactly one ${bound}`, { node });
            return false;
        }

        return true;
    }
}
