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
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Element } from "../../generated/ast";
import { SubtypeKeys, SysMLInterface, SysMLType } from "../../services";
import {
    Doc,
    PrintCommentContext,
    TextComment,
    hardline,
    indent,
    inheritLabel,
    join,
    literals,
    newLineCount,
    printComment,
    printIgnored,
    printKerMLNote,
    streamModel,
    surroundWithComments,
    text,
} from "../../utils";
import { ElementMeta, ElementReferenceMeta } from "../KerML";
import * as ast from "../../generated/ast";
import { SemanticTokenTypes } from "vscode-languageserver";
import { FormatOptions, DefaultFormatOptions } from "./format-options";
import * as expr from "./expressions";
import * as edges from "./edges";
import {
    ElementRange,
    KerMLKeywords,
    SysMLKeywords,
    getElementEnd,
    getElementStart,
    hasFormatIgnore,
    throwError,
} from "./utils";
import { BasicMetamodel } from "../metamodel";
import assert from "assert";
import {
    printDocumentation,
    printCommentElement,
    printTextualRepresentation,
    printMetadataFeature,
} from "./annotating-elements";
import * as nss from "./namespaces";
import * as connectors from "./connectors";
import * as sysml from "./definition-usages";
import * as actions from "./actions";
import * as successions from "./successions";

export interface ModelPrinterContext extends PrintCommentContext {
    /**
     * Printer language mode. Some elements may only be printed in `kerml` mode,
     * others - in `sysml`, and some may use different keywords depending on the
     * mode.
     */
    mode: "sysml" | "kerml";

    /**
     * Set of restricted keywords for the language. This will be used to
     * surround clashing names with quotes.
     */
    keywords: Set<string>;

    /**
     * If true, highlighting information will also be collected. Mainly applies
     * to identifiers and references since modifiers have to be computed for
     * them.
     */
    highlighting?: boolean;

    /**
     * Formatting options.
     */
    format: FormatOptions;

    /**
     * Printer for programmatic references, i.e. those that do not have
     * corresponding AST `ElementReference`. Not used for source text
     * formatting.
     */
    referencePrinter(target: ElementMeta, scope: ElementMeta, context: ModelPrinterContext): Doc;

    /**
     * If true, printer will format elements even they have notes ignoring formatting.
     */
    forceFormatting: boolean;

    /**
     * Cache of already printed notes.
     */
    printed: Set<TextComment>;
}

export function assertSysML(context: ModelPrinterContext, type: string): void {
    assert(context.mode === "sysml", `${type} can only be printed in SysML mode`);
}

export function assertKerML(context: ModelPrinterContext, type: string): void {
    assert(context.mode === "kerml", `${type} can only be printed in KerML mode`);
}

export type ContextOptions = Partial<
    Pick<ModelPrinterContext, "highlighting" | "format" | "forceFormatting">
>;

export function defaultKerMLPrinterContext(options: ContextOptions = {}): ModelPrinterContext {
    return {
        mode: "kerml",
        keywords: KerMLKeywords(),
        format: options.format ?? DefaultFormatOptions,
        referencePrinter: function (): Doc {
            throw new Error("Programmatic reference printing is not implemented.");
        },
        printComment: printKerMLNote,
        printed: new Set(),
        highlighting: Boolean(options.highlighting),
        forceFormatting: Boolean(options.forceFormatting),
    };
}

export function defaultSysMLPrinterContext(options: ContextOptions = {}): ModelPrinterContext {
    return {
        ...defaultKerMLPrinterContext(options),
        keywords: SysMLKeywords(),
        mode: "sysml",
    };
}

type PrintFunction<T extends ElementMeta = ElementMeta> = (
    node: T,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
) => Doc;

/* istanbul ignore next */
const abstractElement = (node: ElementMeta): never =>
    throwError(node, `Cannot print abstract element with type ${node.nodeType()}`);
/* istanbul ignore next */
const typeUnion = (node: ElementMeta): never =>
    throwError(node, `Cannot print type union ${node.nodeType()}`);
/* istanbul ignore next */
const directPrint = (node: ElementMeta): never =>
    throwError(node, `Cannot print element with  type ${node.nodeType()} directly`);

const ModelPrinter: Omit<
    {
        [K in SysMLType]: SysMLInterface<K> extends Element
            ? PrintFunction<SysMLInterface<K>["$meta"]>
            : never;
    },
    // TS complains about missing `never` properties so omit them
    SubtypeKeys<ast.ElementReference>
> = {
    // Expressions
    [ast.CollectExpression](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.FeatureChainExpression](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.FeatureReferenceExpression](node, context) {
        return expr.printFeatureReferenceExpression(node, context);
    },
    [ast.InvocationExpression](node, context) {
        return expr.printInvocationExpr(node, context);
    },
    [ast.MetadataAccessExpression](node, context) {
        return expr.printMetadataAccessExpression(node, context);
    },
    [ast.OperatorExpression](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.SelectExpression](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.TriggerInvocationExpression](node, context) {
        return expr.printTriggerInvocationExpression(node, context);
    },
    [ast.LiteralBoolean](node) {
        return node.literal ? literals.true : literals.false;
    },
    [ast.LiteralInfinity]() {
        return text("*");
    },
    [ast.LiteralNumber](node, context) {
        return expr.printLiteralNumber(node, context);
    },
    [ast.LiteralString](node) {
        // TODO: unescape on assignment and escape here
        return text(JSON.stringify(node.literal), { type: SemanticTokenTypes.string });
    },
    [ast.NullExpression](node, context) {
        return expr.printNullExpression(node, context);
    },

    // Memberships
    [ast.ActorMembership](node, context, previousSibling) {
        return edges.printActorMembership(node, context, previousSibling);
    },
    [ast.ElementFilterMembership](node, context) {
        return edges.printElementFilterMembership(node, context);
    },
    [ast.FeatureMembership](node, context, previousSibling) {
        return edges.printGenericMembership(undefined, node, context, { previousSibling });
    },
    [ast.FramedConcernMembership](node, context, previousSibling) {
        return edges.printFramedConcernMembership(node, context, previousSibling);
    },
    [ast.Membership](node, context, previousSibling) {
        return edges.printMembership(node, context, { previousSibling });
    },
    [ast.ObjectiveMembership](node, context, previousSibling) {
        return edges.printObjectiveMembership(node, context, previousSibling);
    },
    [ast.OwningMembership](node, context, previousSibling) {
        return edges.printOwningMembership(node, context, previousSibling);
    },
    [ast.RequirementConstraintMembership](node, context, previousSibling) {
        return edges.printRequirementConstraintMembership(node, context, previousSibling);
    },
    [ast.RequirementVerificationMembership](node, context, previousSibling) {
        return edges.printRequirementVerificationMembership(node, context, previousSibling);
    },
    [ast.ResultExpressionMembership](node, context, previousSibling) {
        return edges.printGenericMembership(undefined, node, context, { previousSibling });
    },
    [ast.ReturnParameterMembership](node, context, previousSibling) {
        return edges.printGenericMembership("return", node, context, { previousSibling });
    },
    [ast.StakeholderMembership](node, context, previousSibling) {
        return edges.printStakeholderMembership(node, context, previousSibling);
    },
    [ast.StateSubactionMembership](node, context) {
        return actions.printStateSubactionMembership(node, context);
    },
    [ast.SubjectMembership](node, context, previousSibling) {
        return edges.printSubjectMembership(node, context, previousSibling);
    },
    [ast.VariantMembership](node, context, previousSibling) {
        return edges.printVariantMembership(node, context, previousSibling);
    },
    [ast.ViewRenderingMembership](node, context, previousSibling) {
        return edges.printViewRenderingMembership(node, context, previousSibling);
    },

    // Other Relationships
    [ast.Annotation](node, context) {
        const source = node.source();
        if (source?.parent() === node) return printModelElement(source, context);

        /* istanbul ignore next */ // printed directly
        return edges.printTarget(node, context);
    },
    [ast.Conjugation](node, context) {
        return edges.printConjugation(node, context);
    },
    [ast.Dependency](node, context) {
        return edges.printDependency(node, context);
    },
    [ast.Disjoining](node, context) {
        return edges.printDisjoining(node, context);
    },
    [ast.FeatureInverting](node, context) {
        return edges.printFeatureInverting(node, context);
    },
    [ast.FeatureTyping](node, context) {
        return edges.printFeatureTyping(node, context);
    },
    [ast.FeatureValue](node, context) {
        return edges.printFeatureValue(node, context);
    },
    [ast.NamespaceExpose](node, context) {
        assertSysML(context, node.nodeType());
        return edges.printNamespaceImport("expose", node, context);
    },
    [ast.NamespaceImport](node, context) {
        return edges.printNamespaceImport(node.importsAll ? "import all" : "import", node, context);
    },
    [ast.MembershipExpose](node, context) {
        assertSysML(context, node.nodeType());
        return edges.printMembershipImport("expose", node, context);
    },
    [ast.MembershipImport](node, context) {
        return edges.printMembershipImport(
            node.importsAll ? "import all" : "import",
            node,
            context
        );
    },
    [ast.Redefinition](node, context) {
        return edges.printRedefinition(node, context);
    },
    [ast.Specialization](node, context) {
        return edges.printSpecialization(node, context);
    },
    [ast.Subclassification](node, context) {
        return edges.printSubclassification(node, context);
    },
    [ast.Subsetting](node, context) {
        return edges.printSubsetting(node, context);
    },
    [ast.TypeFeaturing](node, context) {
        return edges.printTypeFeaturing(node, context);
    },

    // Annotating Elements
    [ast.Comment]: printCommentElement,
    [ast.Documentation]: printDocumentation,
    [ast.MetadataFeature]: printMetadataFeature,
    [ast.TextualRepresentation]: printTextualRepresentation,

    // Connectors
    [ast.AllocationUsage](node, context) {
        return connectors.printAllocationUsage(node, context);
    },
    [ast.BindingConnector](node, context) {
        return connectors.printBindingConnector(node, context);
    },
    [ast.BindingConnectorAsUsage](node, context) {
        return connectors.printBindingConnectorAsUsage(node, context);
    },
    [ast.ConnectionUsage](node, context) {
        return connectors.printConnectionUsage(node, context);
    },
    [ast.Connector](node, context) {
        return connectors.printConnector(node, context);
    },
    [ast.FlowConnectionUsage](node, context) {
        return connectors.printFlowConnectionUsage(node, context);
    },
    [ast.ItemFlow](node, context) {
        return connectors.printItemFlow("flow", node, context, {
            sourceFormat: context.format.item_flow_from_keyword,
        });
    },
    [ast.ItemFlowEnd](node, context) {
        return connectors.printItemFlowEnd(node, context);
    },
    [ast.ItemFeature](node, context) {
        return connectors.printItemFeature(node, context);
    },
    [ast.Succession](node, context) {
        return connectors.printSuccession(node, context);
    },
    [ast.SuccessionAsUsage](node, context, previousSibling) {
        return successions.printSuccessionAsUsage(node, context, previousSibling);
    },
    [ast.SuccessionFlowConnectionUsage](node, context) {
        return connectors.printGenericFlowConnectionUsage("succession flow", node, context, {
            sourceFormat: context.format.succession_flow_connection_usage_from_keyword,
        });
    },
    [ast.SuccessionItemFlow](node, context) {
        return connectors.printItemFlow("succession flow", node, context, {
            sourceFormat: context.format.item_flow_from_keyword,
        });
    },
    [ast.TransitionUsage](node, context, previousSibling) {
        return successions.printTransitionUsage(node, context, previousSibling);
    },
    [ast.InterfaceUsage](node, context) {
        return connectors.printInterfaceUsage(node, context);
    },

    // KerML
    [ast.Association](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "assoc", node, context);
    },
    [ast.AssociationStructure](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "assoc struct", node, context);
    },
    [ast.Behavior](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "behavior", node, context);
    },
    [ast.BooleanExpression](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printKerMLFeature("bool", node, context);
    },
    [ast.Class](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "class", node, context);
    },
    [ast.Classifier](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "classifier", node, context);
    },
    [ast.DataType](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "datatype", node, context);
    },
    [ast.Expression](node, context) {
        return expr.printExpression(node, context);
    },
    [ast.Feature](node, context) {
        return nss.printFeature(node, context);
    },
    [ast.Interaction](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "interaction", node, context);
    },
    [ast.Invariant](node, context) {
        return nss.printInvariant(node, context);
    },
    [ast.LibraryPackage](node, context) {
        return nss.printNonTypeNamespace(
            node.isStandard ? "standard library" : "library",
            "package",
            node,
            context
        );
    },
    [ast.Metaclass](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "metaclass", node, context);
    },
    [ast.Multiplicity](node, context) {
        return nss.printMultiplicity(node, context);
    },
    [ast.MultiplicityRange](node, context) {
        return nss.printMultiplicityRange(node, context);
    },
    [ast.Namespace](node, context) {
        return nss.printNamespace(node, context);
    },
    [ast.Package](node, context) {
        return nss.printNonTypeNamespace(undefined, "package", node, context);
    },
    [ast.Predicate](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "predicate", node, context);
    },
    [ast.Step](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printKerMLFeature("step", node, context);
    },
    [ast.Structure](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "struct", node, context);
    },
    [ast.SysMLFunction](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "function", node, context);
    },
    [ast.Type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "type", node, context);
    },

    // SysML
    [ast.AcceptActionUsage](node, context) {
        return actions.printAcceptActionUsage(node, context);
    },
    [ast.ActionDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "action def", node, context, {
            join: actions.actionBodyJoiner(),
        });
    },
    [ast.ActionUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "action", node, context, {
            join: actions.actionBodyJoiner(),
        });
    },
    [ast.AllocationDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "allocation def", node, context);
    },
    [ast.AnalysisCaseDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "analysis def", node, context);
    },
    [ast.AnalysisCaseUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "analysis", node, context);
    },
    [ast.AssertConstraintUsage](node, context) {
        return sysml.printAssertConstraint(node, context);
    },
    [ast.AssignmentActionUsage](node, context) {
        return actions.printAssignmentAction(node, context);
    },
    [ast.AttributeDefinition](node, context) {
        return sysml.printGenericDefinition("auto", "attribute def", node, context);
    },
    [ast.AttributeUsage](node, context) {
        return sysml.printAttributeUsage(node, context);
    },
    [ast.CalculationDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "calc def", node, context);
    },
    [ast.CalculationUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "calc", node, context);
    },
    [ast.CaseDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "case def", node, context);
    },
    [ast.CaseUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "case", node, context);
    },
    [ast.ConcernDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "concern def", node, context);
    },
    [ast.ConcernUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "concern", node, context);
    },
    [ast.ConnectionDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "connection def", node, context);
    },
    [ast.ConstraintDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "constraint def", node, context);
    },
    [ast.ConstraintUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "constraint", node, context);
    },
    [ast.Definition](node, context) {
        // assuming extended definition with at least one prefix
        return sysml.printGenericDefinition("auto", "def", node, context);
    },
    [ast.EnumerationDefinition](node, context) {
        return sysml.printGenericDefinition([], "enum def", node, context);
    },
    [ast.EnumerationUsage](node, context) {
        return sysml.printEnumerationUsage(node, context);
    },
    [ast.EventOccurrenceUsage](node, context) {
        return sysml.printEventOccurrence(node, context);
    },
    [ast.ExhibitStateUsage](node, context) {
        return sysml.printExhibitState(node, context);
    },
    [ast.FlowConnectionDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "flow def", node, context);
    },
    [ast.IncludeUseCaseUsage](node, context) {
        return sysml.printIncludeUseCase(node, context);
    },
    [ast.InterfaceDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "interface def", node, context);
    },
    [ast.ItemDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "item def", node, context);
    },
    [ast.ItemUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "item", node, context);
    },
    /* istanbul ignore next */ // matches empty string so not parsed as AST
    [ast.LifeClass]() {
        return literals.emptytext;
    },
    [ast.MetadataDefinition](node, context) {
        return sysml.printGenericDefinition("auto", "metadata def", node, context);
    },
    [ast.MetadataUsage]: printMetadataFeature,
    [ast.OccurrenceDefinition](node, context) {
        return sysml.printOccurrenceDefinition(node, context);
    },
    [ast.OccurrenceUsage](node, context) {
        return sysml.printOccurrenceUsage(node, context);
    },
    [ast.PartDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "part def", node, context);
    },
    [ast.PartUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "part", node, context);
    },
    [ast.PerformActionUsage](node, context) {
        return sysml.printPerformAction(node, context);
    },
    [ast.PortDefinition](node, context) {
        return sysml.printGenericDefinition("auto", "port def", node, context);
    },
    [ast.PortUsage](node, context) {
        return sysml.printPortUsage(node, context);
    },
    [ast.ReferenceUsage](node, context) {
        return sysml.printReferenceUsage(node, context);
    },
    [ast.RenderingDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "rendering def", node, context);
    },
    [ast.RenderingUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "rendering", node, context);
    },
    [ast.RequirementDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "requirement def", node, context);
    },
    [ast.RequirementUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "requirement", node, context);
    },
    [ast.SatisfyRequirementUsage](node, context) {
        return sysml.printSatisfyRequirement(node, context);
    },
    [ast.SendActionUsage](node, context) {
        return actions.printSendAction(node, context);
    },
    [ast.StateDefinition](node, context) {
        return actions.printStateDefinition(node, context);
    },
    [ast.StateUsage](node, context) {
        return actions.printStateUsage(node, context);
    },
    [ast.Usage](node, context) {
        // assuming extended usage with at least one prefix
        return sysml.printGenericUsage("auto", undefined, node, context);
    },
    [ast.UseCaseDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "use case def", node, context);
    },
    [ast.UseCaseUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "use case", node, context);
    },
    [ast.VerificationCaseDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "verification def", node, context);
    },
    [ast.VerificationCaseUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "verification", node, context);
    },
    [ast.ViewDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "view def", node, context);
    },
    [ast.ViewUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "view", node, context);
    },
    [ast.ViewpointDefinition](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "viewpoint def", node, context);
    },
    [ast.ViewpointUsage](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "viewpoint", node, context);
    },

    // SysML Control Flow
    [ast.DecisionNode](node, context) {
        return actions.printControlNode("decide", node, context);
    },
    [ast.ForLoopActionUsage](node, context) {
        return actions.printForLoop(node, context);
    },
    [ast.ForkNode](node, context) {
        return actions.printControlNode("fork", node, context);
    },
    [ast.IfActionUsage](node, context) {
        return actions.printIfAction(node, context);
    },
    [ast.JoinNode](node, context) {
        return actions.printControlNode("join", node, context);
    },
    [ast.MergeNode](node, context) {
        return actions.printControlNode("merge", node, context);
    },
    [ast.WhileLoopActionUsage](node, context) {
        return actions.printWhileLoop(node, context);
    },

    [ast.AnnotatingElement]: abstractElement,
    [ast.ConnectorAsUsage]: abstractElement,
    [ast.ControlNode]: abstractElement,
    [ast.Element]: abstractElement,
    [ast.Expose]: abstractElement,
    [ast.Featuring]: abstractElement,
    [ast.Import]: abstractElement,
    [ast.Inheritance]: abstractElement,
    [ast.LiteralExpression]: abstractElement,
    [ast.LoopActionUsage]: abstractElement,
    [ast.Relationship]: abstractElement,
    [ast.TextualAnnotatingElement]: abstractElement,

    [ast.InlineExpression]: typeUnion,
    [ast.FeatureRelationship]: typeUnion,
    [ast.NonOwnerType]: typeUnion,
    [ast.TransparentElement]: typeUnion,
    [ast.TypeRelationship]: typeUnion,

    // these elements can't appear on their own in textual syntax
    [ast.ConjugatedPortDefinition]: directPrint,
    [ast.ConjugatedPortTyping]: directPrint,
    [ast.Differencing]: directPrint,
    [ast.EndFeatureMembership]: directPrint,
    [ast.FeatureChaining]: directPrint,
    [ast.Intersecting]: directPrint,
    [ast.ParameterMembership]: directPrint,
    [ast.PortConjugation]: directPrint,
    [ast.ReferenceSubsetting]: directPrint,
    [ast.TransitionFeatureMembership]: directPrint,
    [ast.Unioning]: directPrint,
};

const UnprintedWarnings: Partial<Record<SysMLType, boolean>> = {
    // The only way for namespace notes to not be printed is if the root node
    // had no children, only some notes. This is safe to ignore since such notes
    // have no way of interfering with any other elements.
    Namespace: true,
};

function printMissedInnerNotes<T extends Doc>(
    doc: T,
    notes: readonly TextComment[],
    context: ModelPrinterContext,
    debugType: SysMLType
): Doc[] | T {
    const unprintedTrailingNotes = notes.filter(
        (note) => note.localPlacement === "inner" && !context.printed.has(note)
    );
    if (unprintedTrailingNotes.length === 0) return doc;

    // print all remaining inner comments as a catch all in case specific
    // printers have missed them
    if (unprintedTrailingNotes.some((note) => note.$cstNode) && !UnprintedWarnings[debugType]) {
        // there are no limits what can be attached programmatically so only
        // report if notes in the source file have not been printed yet
        console.warn(`${debugType} printer did not print some inner comments, please FIX ME.`);
        // only emit warnings once per type
        UnprintedWarnings[debugType] = true;
    }

    return inheritLabel(doc, (contents) => [
        join(
            hardline,
            // already filtered so don't have to use `printInnerComments`
            unprintedTrailingNotes.map((note) => printComment(note, context)),
            true
        ),
        contents,
    ]);
}

/**
 * Default handler for all remaining owned unprinted notes. Leading notes will
 * be printed leading to the element, while any missed inner and trailing notes
 * -- trailing the element. Labels will be propagated.
 */
export function defaultPrintNotes<T extends Doc>(
    doc: T | Doc[],
    element: BasicMetamodel,
    context: ModelPrinterContext
): T | Doc[] {
    doc = printMissedInnerNotes(doc, element.notes, context, element.nodeType());
    doc = surroundWithComments(doc, element.notes, context);
    return doc;
}

export type ElementPrinter<T = ElementMeta, R extends Doc = Doc> = (
    node: T,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
) => R;

/**
 * Default element printer for all valid element types. Note that some elements
 * cannot be printed directly, others assume that special variants, such as
 * relationships inside declarations, are printed directly so may not result in
 * expected behavior in all cases.
 */
export const DefaultElementPrinter: ElementPrinter = (node, context, previousSibling?) => {
    const type = node.nodeType();
    return (ModelPrinter as unknown as Record<SysMLType, PrintFunction>)[type].call(
        ModelPrinter,
        node,
        context,
        previousSibling
    );
};

export interface PrintModelElementOptions<T = ElementMeta, R extends Doc = Doc> {
    /**
     * Previous sibling in the current scope used to preserve empty lines
     * between siblings.
     */
    previousSibling?: ElementMeta;

    /**
     * Override for default element printer. The printer can skip printing
     * leading and trailing notes.
     */
    printer?: ElementPrinter<T, R>;
}

/**
 * Prints a model element to document, handles leading and trailing notes and
 * inserts an empty line if the current `element` is separated by more than one
 * empty line to the `previousSibling`.
 */
export function printModelReference<T extends ElementReferenceMeta>(
    element: T,
    context: ModelPrinterContext,
    options: Required<Omit<PrintModelElementOptions<T>, "previousSibling">>
): Doc {
    const cst = element.cst();
    let doc =
        !context.forceFormatting && hasFormatIgnore(element) && cst
            ? printIgnored(
                  element.document.textDocument.getText(),
                  cst,
                  element.notes,
                  context.printed
              )
            : undefined;
    doc ??= options.printer(element, context);
    return defaultPrintNotes(doc, element, context);
}

export function printModelElement(
    element: ElementMeta,
    context: ModelPrinterContext,
    options?: Omit<PrintModelElementOptions<ElementMeta, Doc>, "printer">
): Doc;
export function printModelElement<T extends ElementMeta, R extends Doc>(
    element: T,
    context: ModelPrinterContext,
    options: PrintModelElementOptions<T, R> &
        Required<Pick<PrintModelElementOptions<T, R>, "printer">>
): R | Doc[];
export function printModelElement<T extends ElementMeta, R extends Doc>(
    element: T,
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<T, R>
): R | Doc[] | Doc;

/**
 * Prints a model element to document, handles leading and trailing notes and
 * inserts an empty line if the current `element` is separated by more than one
 * empty line to the `previousSibling`.
 */
export function printModelElement<T extends ElementMeta>(
    element: T,
    context: ModelPrinterContext,
    options: PrintModelElementOptions<T> = {}
): Doc {
    let doc =
        !context.forceFormatting && hasFormatIgnore(element)
            ? printElementIgnored(element, context)
            : undefined;
    doc ??= (options.printer ?? DefaultElementPrinter)(element, context, options.previousSibling);
    doc = defaultPrintNotes(doc, element, context);

    const { previousSibling } = options;
    // don't need to duplicate work as owning memberships will forward their
    // previous siblings here
    if (!previousSibling || element.parent()?.is(ast.OwningMembership)) return doc;

    const start = getElementStart(element);
    const end = getElementEnd(previousSibling);

    doc = newLineCount(end, start) > 1 ? inheritLabel(doc, (doc) => [hardline, doc]) : doc;
    return doc;
}

/**
 * Prints an array of elements to document, assuming `elements` is an array of
 * siblings in that specific order without any other siblings skipped.
 */
export function printModelElements<T extends ElementMeta>(
    elements: readonly T[],
    context: ModelPrinterContext,
    options: PrintModelElementOptions<T> = {}
): Doc[] {
    return elements.map((e, i) =>
        printModelElement(e, context, {
            ...options,
            previousSibling: i > 0 ? elements[i - 1] : options.previousSibling,
        })
    );
}

/**
 * Collects all unprinted notes from `root` subtree, useful for debugging in
 * case some notes have not been printed, i.e. when printing some elements
 * directly.
 */
export function collectUnprintedNotes(root: ElementMeta, printed: Set<TextComment>): TextComment[] {
    return streamModel(root)
        .flatMap((e) => e.notes)
        .filter((note) => !printed.has(note))
        .toArray();
}

export function printElementIgnored(
    node: ElementMeta,
    context: ModelPrinterContext
): Doc | undefined {
    const cst = node.cst();
    /* istanbul ignore next */
    if (!cst) return;
    return printIgnored(
        node.document.textDocument.getText(),
        cst,
        streamModel(node).flatMap((e) => e.notes),
        context.printed
    );
}

/**
 * Prints a model range to `Doc`
 *
 * @see {@link collectPrintRange}
 */
export function printModelRange(range: ElementRange, context: ModelPrinterContext): Doc {
    const printed = printModelElements(range.elements, context, range.options);
    let doc: Doc;
    if (context.mode === "kerml") doc = join(hardline, printed);
    else {
        doc = actions.actionBodyJoiner()(range.elements, printed, range.leading);
    }
    for (let i = 0; i < range.level; ++i) doc = indent(doc);

    return doc;
}
