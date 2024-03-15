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
    emptyDocument,
    ParseOptions,
    parseSysML,
    services,
    TEST_BUILD_OPTIONS,
} from "../../../testing";
import * as ast from "../../../generated/ast";
import { Diagnostic } from "vscode-languageserver";
import {
    ActionUsageMeta,
    ActorMembershipMeta,
    basicIdProvider,
    BasicMetamodel,
    ConjugatedPortDefinitionMeta,
    ConstraintUsageMeta,
    EdgeContainer,
    ElementIDProvider,
    ElementMeta,
    ExpressionMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    LifeClassMeta,
    MembershipExposeMeta,
    MergeNodeMeta,
    ObjectiveMembershipMeta,
    OccurrenceDefinitionMeta,
    OwningMembershipMeta,
    PortDefinitionMeta,
    PortUsageMeta,
    RequirementConstraintMembershipMeta,
    RequirementUsageMeta,
    StakeholderMembershipMeta,
    StateSubactionMembershipMeta,
    SubjectMembershipMeta,
    TransitionFeatureMembershipMeta,
    UsageMeta,
    ViewRenderingMembershipMeta,
} from "../../../model";
import { ModelDiagnostic } from "../validation-registry";
import { LangiumDocument } from "langium";

const BUILD_OPTIONS: ParseOptions = { ...TEST_BUILD_OPTIONS, validationChecks: "all" };

function expectValidations(
    text: string,
    code: string | (string | number | undefined)[],
    buildOptions = BUILD_OPTIONS
): jest.JestMatchers<Promise<Diagnostic[]>> {
    return expect(
        parseSysML(text, { ...BUILD_OPTIONS, ...buildOptions }).then((result) => {
            expect(result.parserErrors).toHaveLength(0);
            if (Array.isArray(code)) return result.diagnostics.filter((d) => code.includes(d.code));
            return result.diagnostics.filter((d) => d.code === code);
        })
    );
}

function expectModelValidations(
    root: ElementMeta,
    code: string | (string | number | undefined)[]
): jest.JestMatchers<ModelDiagnostic[]> {
    return expect(
        services.SysML.validation.DocumentValidator.validateModel(root, root.document).then(
            (ds) => {
                if (Array.isArray(code)) return ds.filter((d) => code.includes(d.info.code));
                return ds.filter((d) => d.info.code === code);
            }
        )
    );
}

function expectOwningType<
    T extends { create(id: ElementIDProvider, doc: LangiumDocument): BasicMetamodel | undefined },
>(meta: T, code: string): jest.JestMatchers<ModelDiagnostic[]> {
    const doc = emptyDocument();
    const id = basicIdProvider();

    const root = meta.create(id, doc);

    expect(root?.is(ast.Element)).toBeTruthy();

    return expectModelValidations(root as ElementMeta, code);
}

describe("Duplicate member names", () => {
    test("initial node member doesn't trigger validation", async () => {
        return expectValidations(
            "action { action a; first a; }",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(0);
    });
});

describe.each([
    ["Usage", ""],
    ["Definition", "def"],
])("%s validation", (type, tok) => {
    test("variations with non-variant members trigger validation", async () => {
        return expectValidations(
            `variation part ${tok} P { /* comment */ part p : P; }`,
            `validate${type}VariationMembership`
        ).resolves.toHaveLength(1);
    });

    test("variations specializing other variations trigger validation", async () => {
        return expectValidations(
            `variation part ${tok} P; variation part ${tok} R :> P;`,
            `validate${type}VariationSpecialization`
        ).resolves.toHaveLength(1);
    });

    test("variants owned by non-variations trigger validation", async () => {
        return expectValidations(
            `part ${tok} P { part P : P; variant P; }`,
            `validateVariantMembershipOwningNamespace`
        ).resolves.toHaveLength(1);
    });
});

describe("Usage validation", () => {
    test.skip("Usages owned by KerML types trigger validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();

        const root = FeatureMeta.create(id, doc, {
            children: EdgeContainer.make([
                FeatureMembershipMeta.create(id, doc),
                UsageMeta.create(id, doc),
            ]),
        });

        expect(root?.is(ast.Element)).toBeTruthy();

        return expectModelValidations(
            root as ElementMeta,
            "validateUsageOwningType"
        ).resolves.toHaveLength(1);
    });
});

describe("Attribute usage validation", () => {
    test("Attribute usages typed by non-datatypes trigger validation", async () => {
        return expectValidations(
            "part def P; attribute a : P;",
            "validateAttributeUsageTyping"
        ).resolves.toHaveLength(1);
    });
});

describe("Event ocurrence usage validation", () => {
    test("referencing non-occurrence usage triggers validation", () => {
        return expectValidations(
            "attribute P; event P;",
            "validateEventOccurrenceUsageReference"
        ).resolves.toHaveLength(1);
    });

    test("referencing chained occurrence usage does not trigger validation", () => {
        return expectValidations(
            "occurrence P { occurrence P; } event P.P;",
            "validateEventOccurrenceUsageReference"
        ).resolves.toHaveLength(0);
    });
});

describe("Occurrence definition validation", () => {
    test("empty individuals don't trigger life class validation", () => {
        return expectValidations(
            "individual occurrence def P;",
            "validateOccurrenceDefinitionLifeClass"
        ).resolves.toHaveLength(0);
    });

    test("individuals with extra life class member trigger life class validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();

        const root = OccurrenceDefinitionMeta.create(id, doc, {
            isIndividual: true,
            children: EdgeContainer.make([
                OwningMembershipMeta.create(id, doc),
                LifeClassMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(
            root,
            "validateOccurrenceDefinitionLifeClass"
        ).resolves.toHaveLength(2);
    });

    test("non-individuals with extra life class member trigger life class validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();

        const root = OccurrenceDefinitionMeta.create(id, doc, {
            children: EdgeContainer.make([
                OwningMembershipMeta.create(id, doc),
                LifeClassMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(
            root,
            "validateOccurrenceDefinitionLifeClass"
        ).resolves.toHaveLength(1);
    });
});

describe("Individual occurrence usage validation", () => {
    test("usages typed by non-individual occurrence definitions trigger validation", async () => {
        return expectValidations(
            "occurrence def C; individual occurrence p : C;",
            "validateOccurrenceUsageIndividualUsage"
        ).resolves.toHaveLength(1);
    });

    test("usages typed by multiple individual occurrence definitions trigger validation", async () => {
        return expectValidations(
            "individual occurrence def C; individual occurrence def D; individual occurrence p : C, D;",
            "validateOccurrenceUsageIndividualDefinition"
        ).resolves.toHaveLength(1);
    });
});

describe("Conjugated port definition validation", () => {
    test("validateConjugatedPortDefinitionOriginalPortDefinition", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const port = PortDefinitionMeta.create(id, doc);
        port.conjugatedDefinition
            ?.element()
            .specializations(ast.PortConjugation)
            .at(0)
            ?.["setElement"](undefined);

        return expectModelValidations(
            port,
            "validateConjugatedPortDefinitionOriginalPortDefinition"
        ).resolves.toHaveLength(1);
    });

    test("extra conjugated port definition triggers validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const port = PortDefinitionMeta.create(id, doc, {
            children: EdgeContainer.make([
                OwningMembershipMeta.create(id, doc),
                ConjugatedPortDefinitionMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(
            port,
            "validatePortDefinitionConjugatedPortDefinition"
        ).resolves.toHaveLength(2);
    });
});

describe.each([
    ["Usage", "", "validatePortUsageNestedUsagesNotComposite"],
    ["Definition", "def", "validatePortDefinitionOwnedUsagesNotComposite"],
])("Port%s validation", (_, tok, code) => {
    test("composite owned usages trigger validation", () => {
        return expectValidations(`port ${tok} { part x; }`, code).resolves.toHaveLength(1);
    });

    test("parameters don't trigger validation", () => {
        return expectValidations(`port ${tok} { out part x; }`, code).resolves.toHaveLength(0);
    });
});

test("Non-sub ports are referential", () => {
    const doc = emptyDocument();
    const id = basicIdProvider();
    const port = PortUsageMeta.create(id, doc, {});
    expect(port.isReference).toBeTruthy();
});

describe("Flow connection definition ends", () => {
    test("more than 2 ends trigger validation", async () => {
        return expectValidations(
            "flow def F { end item a; end item b; end item c; }",
            "validateFlowConnectionEnd"
        ).resolves.toHaveLength(3);
    });

    test("2 ends don't trigger validation", async () => {
        return expectValidations(
            "flow def F { end item a; end item b; }",
            "validateFlowConnectionEnd"
        ).resolves.toHaveLength(0);
    });
});

describe("Interface ends", () => {
    test.each([
        ["", "validateInterfaceUsageEnd"],
        ["def", "validateInterfaceDefinitionEnd"],
    ])("non-port usage ends trigger validation", async (kw, code) => {
        return expectValidations(`interface ${kw} I { end item a; }`, code).resolves.toHaveLength(
            1
        );
    });
});

describe("Control node", () => {
    test("non-action owners trigger validation", () => {
        return expectOwningType(
            MergeNodeMeta,
            "validateControlNodeOwningType"
        ).resolves.toHaveLength(1);
    });
});

describe("Perform action usage", () => {
    test("referencing non-action usage triggers validation", () => {
        return expectValidations(
            "attribute a; perform a;",
            "validatePerformActionUsageReference"
        ).resolves.toHaveLength(1);
    });
});

describe("Send action usage validation", () => {
    test("no sender and receiver trigger a validation", async () => {
        return expectValidations(
            "action def A { send 1; }",
            "validateSendActionParameters"
        ).resolves.toHaveLength(0);
    });

    test("port receiver triggers a validation", async () => {
        return expectValidations(
            "action def A { port a; send 1 to a; }",
            "validateSendActionReceiver"
        ).resolves.toHaveLength(1);
    });

    test("port receiver triggers a validation (chain)", async () => {
        return expectValidations(
            "action def A { item a { port b; } send 1 to a.b; }",
            "validateSendActionReceiver"
        ).resolves.toHaveLength(1);
    });
});

describe("Exhibit state usage", () => {
    test("referencing non-state usage triggers validation", () => {
        return expectValidations(
            "attribute a; exhibit a;",
            "validateExhibitStateUsageReference"
        ).resolves.toHaveLength(1);
    });
});

describe("State subaction membership", () => {
    test("non-state owners trigger validation", () => {
        return expectOwningType(
            StateSubactionMembershipMeta,
            "validateStateSubactionMembershipOwningType"
        ).resolves.toHaveLength(1);
    });
});

describe("Parallel states", () => {
    test("succession triggers a validation", async () => {
        return expectValidations(
            "state def S parallel { state a; then a; }",
            "validateStateDefinitionParallelSubactions"
        ).resolves.toHaveLength(1);
    });

    test("transition usage triggers a validation", async () => {
        return expectValidations(
            "state S parallel { state a; transition then a; }",
            "validateStateUsageParallelSubactions"
        ).resolves.toHaveLength(1);
    });
});

describe("Transition feature membership", () => {
    test("non-action efffect triggers validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const root = TransitionFeatureMembershipMeta.create(id, doc, {
            target: ExpressionMeta.create(id, doc),
        });
        root["_kind"] = "effect";
        return expectModelValidations(
            root,
            "validateTransitionFeatureMembershipEffectAction"
        ).resolves.toHaveLength(1);
    });

    test("non-expression guard triggers validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const root = TransitionFeatureMembershipMeta.create(id, doc, {
            target: ActionUsageMeta.create(id, doc),
        });
        root["_kind"] = "guard";
        return expectModelValidations(
            root,
            "validateTransitionFeatureMembershipGuardExpression"
        ).resolves.toHaveLength(1);
    });

    test("non-boolean guard expressions triggers a validation", async () => {
        return expectValidations(
            "state def S parallel { state a; if 1 as a then a; }",
            "validateTransitionFeatureMembershipGuardExpression"
        ).resolves.toHaveLength(1);
    });

    test("non-accept action trigger triggers validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const root = TransitionFeatureMembershipMeta.create(id, doc, {
            target: ExpressionMeta.create(id, doc),
        });
        root["_kind"] = "trigger";
        return expectModelValidations(
            root,
            "validateTransitionFeatureMembershipTriggerAction"
        ).resolves.toHaveLength(1);
    });

    test("non-transition owners trigger validation", () => {
        return expectOwningType(
            TransitionFeatureMembershipMeta,
            "validateTransitionFeatureMembershipOwningType"
        ).resolves.toHaveLength(1);
    });
});

describe("Transition usage", () => {
    test("transition after non-action triggers validation", () => {
        return expectValidations(
            "state S { attribute a; transition then a; }",
            "validateTransitionUsageSuccession"
        ).resolves.toHaveLength(1);
    });

    test("transition after action does not trigger validation", () => {
        return expectValidations(
            "state S { action a; transition then a; }",
            "validateTransitionUsageSuccession"
        ).resolves.toHaveLength(0);
    });
});

describe("AssertConstraintUsage", () => {
    test("referencing non-constraint usage triggers validation", () => {
        return expectValidations(
            "attribute a; assert a;",
            "validateAssertConstraintUsageReference"
        ).resolves.toHaveLength(1);
    });
});

describe.each([
    ["Actor", ActorMembershipMeta, "validateActorMembershipOwningType"],
    ["Subject", SubjectMembershipMeta, "validateSubjectMembershipOwningType"],
])("%s membership", (_, meta, code) => {
    test("invalid owning type triggers validation", () => {
        return expectOwningType(meta, code).resolves.toHaveLength(1);
    });
});

describe.each([
    [
        "Requirement constraint",
        RequirementConstraintMembershipMeta,
        ConstraintUsageMeta,
        "validateRequirementConstraintMembershipIsComposite",
        "validateRequirementConstraintMembershipOwningType",
    ],
    [
        "Objective",
        ObjectiveMembershipMeta,
        RequirementUsageMeta,
        "validateObjectiveMembershipIsComposite",
        "validateObjectiveMembershipOwningType",
    ],
])("%s membership", (_, meta, target, composite, owning) => {
    test("referential elements trigger validation", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const root = (meta as typeof FeatureMembershipMeta).create(id, doc, {
            target: target.create(id, doc, { isReference: true, direction: "in" }),
        });
        return expectModelValidations(root, composite).resolves.toHaveLength(1);
    });

    test("invalid owner triggers validation", () => {
        return expectOwningType(meta, owning).resolves.toHaveLength(1);
    });
});

describe("Stakeholder membership", () => {
    test("non-requirement owner triggers validation", () => {
        return expectOwningType(
            StakeholderMembershipMeta,
            "validateStakeholderMembershipOwningType"
        ).resolves.toHaveLength(1);
    });
});

describe.each([
    ["requirement def", "validateRequirementDefinitionSubjectParameterPosition"],
    ["requirement", "validateRequirementUsageSubjectParameterPosition"],
    ["case def", "validateCaseDefinitionSubjectParameterPosition"],
    ["case", "validateCaseUsageSubjectParameterPosition"],
])("Subject parameter position in %s", (tok, code) => {
    test("not-first triggers validation", () => {
        return expectValidations(
            `${tok} { in attribute a; subject sub; }`,
            code
        ).resolves.toHaveLength(1);
    });

    test("first does not trigger validation", () => {
        return expectValidations(
            `${tok} { attribute a; subject sub; }`,
            code
        ).resolves.toHaveLength(0);
    });
});

describe("Requirement verification membership", () => {
    test("triggers validation if it is not owned by the objective of a verification case", async () => {
        return expectValidations(
            "requirement def R { verify requirement r; }",
            "validateRequirementVerificationMembershipOwningType"
        ).resolves.toHaveLength(1);
    });
});

describe("Include use case usage", () => {
    test("referencing non-use case triggers validation", () => {
        return expectValidations(
            "attribute a; include a;",
            "validateIncludeUseCaseUsageReference"
        ).resolves.toHaveLength(1);
    });
});

describe("Expose", () => {
    test("invalid owning namespace triggers validation", () => {
        return expectOwningType(
            MembershipExposeMeta,
            "validateExposeOwningNamespace"
        ).resolves.toHaveLength(1);
    });
});

describe("View rendering membership", () => {
    test("invalid owning type triggers validation", () => {
        return expectOwningType(
            ViewRenderingMembershipMeta,
            "validateViewRenderingMembershipOwningType"
        ).resolves.toHaveLength(1);
    });
});

describe("Attribute definition", () => {
    test.each(["occurrence def", "connection def"])(
        "specializing %s triggers validation",
        (tok) => {
            return expectValidations(
                `${tok} A; attribute def B :> A;`,
                "validateDatatypeSpecialization"
            ).resolves.toHaveLength(1);
        }
    );
});

describe("Item definition", () => {
    test.each(["attribute def", "connection def"])("specializing %s triggers validation", (tok) => {
        return expectValidations(
            `${tok} A; item def B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(1);
    });
});

describe("Connection definition", () => {
    test("specializing attribute definition triggers validation", () => {
        return expectValidations(
            `attribute def A; connection def B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(1);
    });

    test("specializing connection definition does not trigger validation", () => {
        return expectValidations(
            `connection def A; connection def B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(0);
    });
});

describe("Quantity expressions", () => {
    test("non-measurement references trigger validation", async () => {
        return expectValidations(
            "attribute a = 1 [0];",
            "validateOperatorExpressionQuantity"
        ).resolves.toHaveLength(1);
    });

    test("measurement reference expressions don't trigger validation", async () => {
        return expectValidations(
            `
            package MeasurementReferences {
                attribute def TensorMeasurementReference;
                attribute def VectorMeasurementReference :> TensorMeasurementReference;
                abstract attribute def ScalarMeasurementReference :> VectorMeasurementReference;
            }
            abstract attribute def MeasurementUnit :> MeasurementReferences::ScalarMeasurementReference;
            abstract attribute def SimpleUnit :> MeasurementUnit;
            attribute def LengthUnit :> SimpleUnit;
            attribute <m> metre : LengthUnit;
            attribute a = 1 [metre**2];`,
            "validateOperatorExpressionQuantity",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });
});

describe.each([
    [ast.OccurrenceUsage, "occurrence", ast.Class, "validateOccurrenceUsageTyping"],
    [ast.ItemUsage, "item", ast.Structure, "validateItemUsageTyping"],
    [ast.PartUsage, "part", ast.Structure, "validatePartUsageTyping"],
    [ast.ActionUsage, "action", ast.Behavior, "validateActionUsageTyping"],
    [ast.ConnectionUsage, "connection", ast.Association, "validateConnectionUsageTyping"],
    [ast.FlowConnectionUsage, "flow", ast.Interaction, "validateFlowConnectionUsageTyping"],
    [ast.InterfaceUsage, "interface", ast.InterfaceDefinition, "validateInterfaceUsageTyping"],
    [ast.AllocationUsage, "allocation", ast.AllocationDefinition, "validateAllocationUsageTyping"],
    [ast.PortUsage, "port", ast.PortDefinition, "validatePortUsageTyping"],
    [ast.StateUsage, "state", ast.Behavior, "validateStateUsageTyping"],
])("%s validation", (_, kw, supertype, code) => {
    test(`usages typed by non-${supertype} trigger validation`, async () => {
        return expectValidations(`attribute def C; ${kw} p : C;`, code).resolves.toHaveLength(1);
    });
});

describe("TriggerInvocationExpression validation", () => {
    it("at should trigger validation for non time values", async () => {
        return expectValidations(
            `action A {
                accept at 0;
            }
            `,
            "validateTriggerInvocationActionAtArgument"
        ).resolves.toHaveLength(1);
    });

    it("when should trigger validation for non boolean values", async () => {
        return expectValidations(
            `action A {
                accept when 0;
            }
            `,
            "validateTriggerInvocationActionWhenArgument"
        ).resolves.toHaveLength(1);
    });

    it("when should not trigger validation for boolean values", async () => {
        return expectValidations(
            `action A {
                accept when true;
            }
            `,
            "validateTriggerInvocationActionWhenArgument"
        ).resolves.toHaveLength(0);
    });

    it("after should trigger validation for non time values", async () => {
        return expectValidations(
            `action A {
                accept after 0;
            }
            `,
            "validateTriggerInvocationActionAfterArgument"
        ).resolves.toHaveLength(1);
    });

    it("after should not trigger validation for duration literals", async () => {
        return expectValidations(
            `package ISQBase {
                item def DurationUnit;
            }
            item ms : ISQBase::DurationUnit;
            action A {
                accept after 1 [ms];
            }
            `,
            "validateTriggerInvocationActionAfterArgument"
        ).resolves.toHaveLength(0);
    });
});

describe("PartUsage validation", () => {
    test("usages not typed by part defs trigger validation", async () => {
        return expectValidations(
            "item def C; part p : C;",
            "validatePartUsagePartDefinition"
        ).resolves.toHaveLength(1);
    });
});

describe.each([
    [ast.ConstraintUsage, "constraint", ast.Predicate, "validateConstraintUsageTyping"],
    [ast.CalculationUsage, "calc", ast.SysMLFunction, "validateCalculationUsageTyping"],
    [ast.CaseUsage, "case", ast.CaseDefinition, "validateCaseUsageTyping"],
    [
        ast.AnalysisCaseUsage,
        "analysis",
        ast.AnalysisCaseDefinition,
        "validateAnalysisCaseUsageTyping",
    ],
    [
        ast.VerificationCaseUsage,
        "verification",
        ast.VerificationCaseDefinition,
        "validateVerificationCaseUsageTyping",
    ],
    [ast.UseCaseUsage, "use case", ast.UseCaseDefinition, "validateUseCaseUsageTyping"],
    [
        ast.RequirementUsage,
        "requirement",
        ast.RequirementDefinition,
        "validateRequirementUsageTyping",
    ],
    [ast.ViewUsage, "view", ast.ViewDefinition, "validateViewUsageTyping"],
    [ast.ViewpointUsage, "viewpoint", ast.ViewpointDefinition, "validateViewpointUsageTyping"],
    [ast.RenderingUsage, "rendering", ast.RenderingDefinition, "validateRenderingUsageTyping"],
])("%s validation", (_, kw, supertype, code) => {
    test(`usages typed by non-${supertype} trigger validation`, async () => {
        return expectValidations(`attribute def C; ${kw} p : C;`, code).resolves.toHaveLength(1);
    });

    test(`usages typed by multiple ${supertype} trigger validation`, async () => {
        return expectValidations(
            `${kw} def C; ${kw} def D; ${kw} p : C, D;`,
            code
        ).resolves.toHaveLength(1);
    });
});

describe("SatisfyRequirementUsage", () => {
    test("referencing non-requirement usage triggers validation", () => {
        return expectValidations(
            "attribute a; satisfy a;",
            "validateSatisfyRequirementUsageReference"
        ).resolves.toHaveLength(1);
    });
});

describe("Metadata validation", () => {
    test("typing by non-metaclass triggers validation", () => {
        return expectValidations(
            `attribute def C; metadata p : C;`,
            "validateMetadataUsageTyping"
        ).resolves.toHaveLength(1);
    });
});

describe.each([
    [
        ast.ViewDefinition,
        "view def",
        "render",
        ast.RenderingUsage,
        "validateViewDefinitionOnlyOneViewRendering",
    ],
    [ast.ViewUsage, "view", "render", ast.RenderingUsage, "validateViewUsageOnlyOneViewRendering"],
    [
        ast.CaseDefinition,
        "case def",
        "subject",
        ast.SubjectMembership,
        "validateCaseDefinitionOnlyOneSubject",
    ],
    [ast.CaseUsage, "case", "subject", ast.SubjectMembership, "validateCaseUsageOnlyOneSubject"],
    [
        ast.CaseDefinition,
        "case def",
        "objective",
        ast.ObjectiveMembership,
        "validateCaseDefinitionOnlyOneObjective",
    ],
    [
        ast.CaseUsage,
        "case",
        "objective",
        ast.ObjectiveMembership,
        "validateCaseUsageOnlyOneObjective",
    ],
    [ast.StateUsage, "state", "do action", "do subaction", "validateStateUsageStateSubactionKind"],
    [
        ast.StateUsage,
        "state",
        "entry action",
        "entry subaction",
        "validateStateUsageStateSubactionKind",
    ],
    [
        ast.StateUsage,
        "state",
        "exit action",
        "exit subaction",
        "validateStateUsageStateSubactionKind",
    ],
    [
        ast.StateDefinition,
        "state def",
        "do action",
        "do subaction",
        "validateStateDefinitionStateSubactionKind",
    ],
    [
        ast.StateDefinition,
        "state def",
        "entry action",
        "entry subaction",
        "validateStateDefinitionStateSubactionKind",
    ],
    [
        ast.StateDefinition,
        "state def",
        "exit action",
        "exit subaction",
        "validateStateDefinitionStateSubactionKind",
    ],
])("%s member validations", (_, owner, member, msg, code) => {
    test(`multiple ${msg} members trigger validation`, () => {
        return expectValidations(
            `${owner} A {
        ${member} a;
        ${member} b;
    }`,
            code
        ).resolves.toHaveLength(2);
    });
});

describe("Enumeration usage validation", () => {
    test("implicit typing doesn't trigger validation", async () => {
        return expectValidations(
            `
            attribute def Color;
            enum def ColorKind :> Color {           
                enum red;
            }`,
            "validateEnumerationUsageTyping"
        ).resolves.toHaveLength(0);
    });

    test("implicit typing from value doesn't trigger validation", async () => {
        return expectValidations(
            `
            attribute def Color;
            enum def ColorKind :> Color {           
                enum red;
            }
            enum color = ColorKind::red;`,
            "validateEnumerationUsageTyping"
        ).resolves.toHaveLength(0);
    });

    test("more than one typing triggers validation", async () => {
        return expectValidations(
            "enum def E; part def P; enum e : E, P;",
            "validateEnumerationUsageTyping"
        ).resolves.toHaveLength(1);
    });

    test("usages typed by non-enum defs trigger validation", async () => {
        return expectValidations(
            "attribute def P; enum e : P;",
            "validateEnumerationUsageTyping"
        ).resolves.toHaveLength(1);
    });
});
