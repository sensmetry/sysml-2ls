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

// Based on SysML.xtext from the pilot implementation

const DefinitionPrefixes = {
    BasicDefinitionPrefix: "BasicDefinitionPrefix?",
    DefinitionPrefix: "BasicDefinitionPrefix PrefixMetadataMembers?",
    OccurrenceDefinitionPrefix: "BasicDefinitionPrefix Individual? PrefixMetadataMembers?",
    IndividualDefinitionPrefix: "BasicDefinitionPrefix Individual PrefixMetadataMembers?",
    ExtendedDefinitionPrefix: "BasicDefinitionPrefix PrefixMetadataMember",
};

const UsagePrefixes = {
    BasicUsagePrefix: "RefPrefix? Reference?",
    UsagePrefix: "BasicUsagePrefix PrefixMetadataMembers?",
    ExtendedUsagePrefix: "BasicUsagePrefix PrefixMetadataMembers",
    OccurrenceUsagePrefix: "BasicUsagePrefix Individual? Portion? PrefixMetadataMembers?",
    IndividualUsagePrefix: "BasicUsagePrefix Individual PrefixMetadataMembers?",
    PortionUsagePrefix: "BasicUsagePrefix Individual? Portion PrefixMetadataMembers?",
    RefPrefix: "RefPrefix?",
    VariantReferencePrefix: "FeatureChain",
};

// Skipping single token prefixes as they will be dealt with by lookahead
const OtherPrefixes = {
    PrefixMetadata: "PrefixMetadataMembers?",
    MetadataBodyUsage: "'ref'? RedefinesToken? FeatureChain",
    None: "",
    ActionNodePrefix: "OccurrenceUsagePrefix ActionNodeUsageDeclaration?",
    ControlNodePrefix: "BasicUsagePrefix Individual? Portion?",
    ActionNodeUsageDeclaration: "ActionNodeUsageDeclaration?",
};

const PrefixFragments = { ...DefinitionPrefixes, ...UsagePrefixes, ...OtherPrefixes };

const infer =
    <TV>() =>
    <T>(t: { [K in keyof T]: keyof TV | keyof T }) =>
        t;

const RulePrefixes = infer<typeof PrefixFragments>()({
    Comment: "None",
    Documentation: "None",
    TextualRepresentation: "None",
    MetadataDefinition: "None",
    MetadataUsage: "None",
    MetadataBodyUsage: "MetadataBodyUsage",
    Package: "PrefixMetadata",
    LibraryPackage: "None",
    ElementFilter: "None",
    Alias: "None",
    Import: "None",
    Dependency: "PrefixMetadata",
    FeatureValue: "None",
    DefaultReferenceUsage: "RefPrefix",
    ReferenceUsage: "RefPrefix",
    VariantReference: "VariantReferencePrefix",
    ExtendedDefinition: "BasicDefinitionPrefix",
    ExtendedUsage: "BasicUsagePrefix",
    AttributeDefinition: "DefinitionPrefix",
    AttributeUsage: "UsagePrefix",
    EnumerationDefinition: "None",
    EnumerationUsage: "UsagePrefix",
    EnumeratedValue: "None",
    OccurrenceDefinition: "OccurrenceDefinitionPrefix",
    IndividualDefinition: "IndividualDefinitionPrefix",
    OccurrenceUsage: "OccurrenceUsagePrefix",
    IndividualUsage: "IndividualUsagePrefix",
    PortionUsage: "PortionUsagePrefix",
    EventOccurrenceUsage: "OccurrenceUsagePrefix",
    ItemDefinition: "OccurrenceDefinitionPrefix",
    ItemUsage: "OccurrenceUsagePrefix",
    PartDefinition: "OccurrenceDefinitionPrefix",
    PartUsage: "OccurrenceUsagePrefix",
    PortDefinition: "DefinitionPrefix",
    PortUsage: "OccurrenceUsagePrefix",
    BindingConnector: "UsagePrefix",
    Succession: "UsagePrefix",
    ConnectionDefinition: "OccurrenceDefinitionPrefix",
    ConnectionUsage: "OccurrenceUsagePrefix",
    FlowConnectionDefinition: "OccurrenceDefinitionPrefix",
    Message: "OccurrenceUsagePrefix",
    FlowConnectionUsage: "OccurrenceUsagePrefix",
    SuccessionFlowConnectionUsage: "OccurrenceUsagePrefix",
    InterfaceDefinition: "OccurrenceDefinitionPrefix",
    EmptySuccession: "None",
    DefaultInterfaceEnd: "RefPrefix", // some are disallowed but largely identical
    InterfaceUsage: "OccurrenceUsagePrefix",
    AllocationDefinition: "OccurrenceDefinitionPrefix",
    AllocationUsage: "OccurrenceUsagePrefix",
    ActionDefinition: "OccurrenceDefinitionPrefix",
    InitialNodeMember: "None",
    GuardedSuccession: "None",
    ActionUsage: "OccurrenceUsagePrefix",
    PerformActionUsage: "OccurrenceUsagePrefix",
    AcceptNode: "OccurrenceUsagePrefix",
    SendNode: "OccurrenceUsagePrefix",
    AssignmentNode: "OccurrenceUsagePrefix",
    IfNode: "ActionNodePrefix",
    WhileLoopNode: "ActionNodePrefix",
    ForLoopNode: "ActionNodePrefix",
    MergeNode: "ControlNodePrefix",
    DecisionNode: "ControlNodePrefix",
    JoinNode: "ControlNodePrefix",
    ForkNode: "ControlNodePrefix",
    TargetSuccession: "None",
    GuardedTargetSuccession: "None",
    DefaultTargetSuccession: "None",
    StateDefinition: "OccurrenceDefinitionPrefix",
    EntryActionMember: "None",
    DoActionMember: "None",
    ExitActionMember: "None",
    EntryTransitionMember: "None",
    PerformActionUsageDeclaration: "ActionNodeUsageDeclaration",
    AcceptNodeDeclaration: "ActionNodeUsageDeclaration",
    SendNodeDeclaration: "ActionNodeUsageDeclaration",
    AssignmentNodeDeclaration: "ActionNodeUsageDeclaration",
    StateUsage: "OccurrenceUsagePrefix",
    ExhibitStateUsage: "OccurrenceUsagePrefix",
    TransitionUsage: "None",
    TriggerActionMember: "None",
    GuardExpressionMember: "None",
    EffectBehaviorMember: "None",
    EmptyActionUsage: "None",
    TransitionSuccession: "ConnectorEnd",
    ConnectorEnd: "None",
    CalculationDefinition: "OccurrenceDefinitionPrefix",
    ReturnParameterMember: "None",
    ResultExpressionMember: "None",
    CalculationUsage: "OccurrenceUsagePrefix",
    ConstraintDefinition: "OccurrenceDefinitionPrefix",
    ConstraintUsage: "OccurrenceUsagePrefix",
    AssertConstraintUsage: "OccurrenceUsagePrefix",
    RequirementDefinition: "OccurrenceDefinitionPrefix",
    SubjectMember: "None",
    RequirementConstraintMember: "None",
    FramedConcernMember: "None",
    ActorMember: "None",
    StakeholderMember: "None",
    RequirementVerificationMember: "None",
    RequirementUsage: "OccurrenceUsagePrefix",
    SatisfyRequirementUsage: "OccurrenceUsagePrefix",
    ConcernDefinition: "OccurrenceDefinitionPrefix",
    ConcernUsage: "OccurrenceUsagePrefix",
    CaseDefinition: "OccurrenceDefinitionPrefix",
    ObjectiveMember: "None",
    CaseUsage: "OccurrenceUsagePrefix",
    AnalysisCaseDefinition: "OccurrenceDefinitionPrefix",
    AnalysisCaseUsage: "OccurrenceUsagePrefix",
    VerificationCaseDefinition: "OccurrenceDefinitionPrefix",
    VerificationCaseUsage: "OccurrenceUsagePrefix",
    UseCaseDefinition: "OccurrenceDefinitionPrefix",
    UseCaseUsage: "OccurrenceUsagePrefix",
    IncludeUseCaseUsage: "OccurrenceUsagePrefix",
    ViewDefinition: "OccurrenceDefinitionPrefix",
    ViewUsage: "OccurrenceUsagePrefix",
    ViewRenderingMember: "None",
    Expose: "None",
    ViewpointDefinition: "OccurrenceDefinitionPrefix",
    ViewpointUsage: "OccurrenceUsagePrefix",
    RenderingDefinition: "OccurrenceDefinitionPrefix",
    RenderingUsage: "OccurrenceUsagePrefix",
});

const inferArray =
    <TV>() =>
    <T>(t: { [K in keyof T]: Array<keyof TV | keyof T> }) =>
        t;

const Groups = inferArray<typeof RulePrefixes>()({
    AnnotatingElement: ["Comment", "Documentation", "TextualRepresentation", "MetadataUsage"],
    PackageBodyElement: ["PackageMember", "ElementFilter", "Alias", "Import"],
    PackageMember: ["DefinitionElement", "UsageElement"],
    DefinitionBodyItem: [
        "DefinitionElement",
        "VariantUsageElement",
        "NonOccurrenceUsageElement",
        "EmptySuccession",
        "OccurrenceUsageElement",
        "Alias",
        "Import",
    ],
    DefinitionElement: [
        "Package",
        "LibraryPackage",
        "AnnotatingElement",
        "Dependency",
        "AttributeDefinition",
        "EnumerationDefinition",
        "OccurrenceDefinition",
        "IndividualDefinition",
        "ItemDefinition",
        "MetadataDefinition",
        "PartDefinition",
        "ConnectionDefinition",
        "FlowConnectionDefinition",
        "InterfaceDefinition",
        "AllocationDefinition",
        "PortDefinition",
        "ActionDefinition",
        "CalculationDefinition",
        "StateDefinition",
        "ConstraintDefinition",
        "RequirementDefinition",
        "ConcernDefinition",
        "CaseDefinition",
        "AnalysisCaseDefinition",
        "VerificationCaseDefinition",
        "UseCaseDefinition",
        "ViewDefinition",
        "ViewpointDefinition",
        "RenderingDefinition",
        "ExtendedDefinition",
    ],
    UsageElement: ["NonOccurrenceUsageElement", "OccurrenceUsageElement"],
    NonOccurrenceUsageElement: [
        "DefaultReferenceUsage",
        "ReferenceUsage",
        "AttributeUsage",
        "EnumerationUsage",
        "BindingConnector",
        "Succession",
        "ExtendedUsage",
    ],
    OccurrenceUsageElement: ["StructureUsageElement", "BehaviorUsageElement"],
    StructureUsageElement: [
        "OccurrenceUsage",
        "IndividualUsage",
        "PortionUsage",
        "EventOccurrenceUsage",
        "ItemUsage",
        "PartUsage",
        "ViewUsage",
        "RenderingUsage",
        "PortUsage",
        "ConnectionUsage",
        "InterfaceUsage",
        "AllocationUsage",
        "Message",
        "FlowConnectionUsage",
        "SuccessionFlowConnectionUsage",
    ],
    BehaviorUsageElement: [
        "ActionUsage",
        "CalculationUsage",
        "StateUsage",
        "ConstraintUsage",
        "RequirementUsage",
        "ConcernUsage",
        "CaseUsage",
        "AnalysisCaseUsage",
        "VerificationCaseUsage",
        "UseCaseUsage",
        "ViewpointUsage",
        "PerformActionUsage",
        "ExhibitStateUsage",
        "IncludeUseCaseUsage",
        "AssertConstraintUsage",
        "SatisfyRequirementUsage",
    ],
    VariantUsageElement: [
        "VariantReference",
        "ReferenceUsage",
        "AttributeUsage",
        "BindingConnector",
        "Succession",
        "OccurrenceUsage",
        "IndividualUsage",
        "PortionUsage",
        "EventOccurrenceUsage",
        "ItemUsage",
        "PartUsage",
        "ViewUsage",
        "RenderingUsage",
        "PortUsage",
        "ConnectionUsage",
        "InterfaceUsage",
        "AllocationUsage",
        "Message",
        "FlowConnectionUsage",
        "SuccessionFlowConnectionUsage",
        "BehaviorUsageElement",
    ],
    EnumerationElement: ["AnnotatingElement", "EnumeratedValue"],
    InterfaceBodyItem: [
        "DefinitionElement",
        "VariantUsageElement",
        "InterfaceNonOccurrenceUsageElement",
        "EmptySuccession",
        "InterfaceOccurrenceUsageElement",
        "Alias",
        "Import",
    ],
    InterfaceNonOccurrenceUsageElement: [
        "ReferenceUsage",
        "AttributeUsage",
        "EnumerationUsage",
        "Succession",
    ],
    InterfaceOccurrenceUsageElement: [
        "DefaultInterfaceEnd",
        "StructureUsageElement",
        "BehaviorUsageElement",
    ],
    ActionBodyItem: [
        "Import",
        "Alias",
        "DefinitionElement",
        "VariantUsageElement",
        "NonOccurrenceUsageElement",
        "EmptySuccession",
        "StructureUsageElement",
        "InitialNodeMember",
        "ActionTargetSuccession",
        "BehaviorUsageElement",
        "ActionNode",
        "GuardedSuccession",
    ],
    ActionNode: [
        "SendNode",
        "AcceptNode",
        "AssignmentNode",
        "IfNode",
        "WhileLoopNode",
        "ForLoopNode",
        "ControlNode",
    ],
    ActionTargetSuccession: [
        "TargetSuccession",
        "GuardedTargetSuccession",
        "DefaultTargetSuccession",
    ],
    ControlNode: ["MergeNode", "DecisionNode", "JoinNode", "ForkNode"],
    StateBodyItem: [
        "Import",
        "Alias",
        "DefinitionElement",
        "VariantUsageElement",
        "NonOccurrenceUsageElement",
        "EmptySuccession",
        "StructureUsageElement",
        "BehaviorUsageElement",
        "TargetTransitionUsage",
        "TransitionUsage",
        "EntryActionMember",
        "EntryTransitionMember",
        "DoActionMember",
        "ExitActionMember",
    ],
    PerformedActionUsage: [
        "PerformActionUsageDeclaration",
        "AcceptNodeDeclaration",
        "SendNodeDeclaration",
        "AssignmentNodeDeclaration",
    ],
    TargetTransitionUsage: ["TransitionUsage", "TriggerActionMember", "GuardExpressionMember"],
    EffectBehaviorUsage: ["EmptyActionUsage", "PerformedActionUsage"],
    RequirementBodyItem: [
        "DefinitionBodyItem",
        "SubjectMember",
        "RequirementConstraintMember",
        "FramedConcernMember",
        "RequirementVerificationMember",
        "ActorMember",
        "StakeholderMember",
    ],
    CaseBodyItem: ["CalculationBodyItem", "SubjectMember", "ActorMember", "ObjectiveMember"],
    CalculationBodyItem: ["ActionBodyItem", "ReturnParameterMember"],
    ViewBodyItem: ["DefinitionBodyItem", "ElementFilter", "Expose", "ViewRenderingMember"],
});

import { Command } from "commander";
import { generateGrammarGroups, outputGroups, processGroups } from "./grouping-utils";

const program = new Command();

program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require("../package.json").version);

program
    .command("dump")
    .option("-o, --output <file>", "JSON file name")
    .description("Dump rule groupings as JSON")
    .action((args) => outputGroups(Groups, RulePrefixes, PrefixFragments, args[3]?.file));

program
    .command("generate")
    .description("Generate Langium grammar groups")
    .action(() =>
        console.log(
            generateGrammarGroups(processGroups(Groups, RulePrefixes, PrefixFragments)).join("\n")
        )
    );

// 0: ts-node
// 1: script file
// 2: command
// 3...: args
program.parse(process.argv);
