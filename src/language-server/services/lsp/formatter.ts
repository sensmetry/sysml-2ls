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
    AbstractFormatter,
    AstNode,
    CstNode,
    Formatting,
    FormattingAction,
    FormattingContext,
    FormattingMove,
    FormattingRegion,
    getDocument,
    LangiumDocument,
    NodeFormatter,
} from "langium";
import { typeIndex, TypeMap } from "../../model";
import * as ast from "../../generated/ast";
import { SysMLType } from "../sysml-ast-reflection";
import { FormattingOptions, Range, TextEdit } from "vscode-languageserver";
import { KeysMatching } from "../../utils/common";
import { isKeyword } from "langium/lib/grammar/generated/ast";
import { linesDiff } from "../../utils/ast-util";
import { getNextNode, getPreviousNode } from "../../utils/cst-util";

type Format<T extends AstNode = AstNode> = (node: T, formatter: NodeFormatter<T>) => void;
type FormatMap = {
    [K in SysMLType]?: Format<ast.SysMlAstType[K]>;
};

// This is more of an idiomatic typescript, but I agree that the type above this one is more readable.
// type PFormatMap<K extends SysMLType> = Partial<Record<K, Format<ast.SysMlAstType[K]>>>;

/**
 * Cached common formatting options
 */
const Options = {
    noSpace: Formatting.noSpace(),
    oneSpace: Formatting.oneSpace(),
    indent: Formatting.indent(),
    noIndent: Formatting.noIndent(),
    noLines: Formatting.newLines(0),
    newLine: Formatting.newLine(),
    twoLines: Formatting.newLines(2),
    uptoTwoLines: Formatting.fit(Formatting.newLines(1), Formatting.newLines(2)),
    inline: Formatting.oneSpace(),
    spaceOrIndent: Formatting.fit(Formatting.indent(), Formatting.oneSpace()),
    spaceOrLine: Formatting.fit(Formatting.newLine(), Formatting.oneSpace()),
    noSpaceOrIndent: Formatting.fit(Formatting.indent(), Formatting.noSpace()),
    noSpaceOrLine: Formatting.fit(Formatting.indent(), Formatting.noSpace()),
} satisfies Record<string, FormattingAction>;
// satisfies here so that the type checker can know if the property exists

function highPriority(action: { moves: FormattingMove[] }): FormattingAction {
    return {
        options: { priority: 100 },
        moves: action.moves,
    };
}

function addIndent(action: FormattingAction, indent: number): FormattingAction {
    return {
        options: action.options,
        moves: action.moves.map((move) => {
            return {
                ...move,
                tabs: (move.tabs ?? 0) + indent,
            };
        }),
    };
}

export class SysMLFormatter extends AbstractFormatter {
    /**
     * Map of AST node types to formatting functions that apply to that type
     */
    protected readonly formattings;

    constructor() {
        super();

        const functions: FormatMap = {
            Element: this.element,
            ElementReference: this.reference,
            FeatureReference: this.featureReference,
            ConjugatedPortReference: this.conjugatePortReference,
            MetadataFeature: this.metadataFeature,
            MultiplicityRange: this.multiplicityRange,
            NullExpression: this.nullExpression,
            Comment: this.comment,
            Documentation: this.doc,
            TextualRepresentation: this.rep,
            Definition: this.definition,
            Dependency: this.dependency,
            Alias: this.alias,
            Type: this.type,
            AssociationStructure: this.assocStruct,
            Feature: this.feature,
            FeatureValue: this.featureValue,
            ElementFilter: this.elementFilter,
            LibraryPackage: this.libraryPackage,
            Multiplicity: this.multiplicity,
            Import: this.import,
            Specialization: this.specialization,
            FeatureTyping: this.featureTyping,
            Conjugation: this.conjugation,
            Disjoining: this.disjoining,
            MetadataUsage: this.metadataUsage,
            FeatureInverting: this.featureInverting,
            TypeFeaturing: this.typeFeaturing,
            Connector: this.connector,
            BindingConnector: this.bindingConnector,
            Succession: this.succession,
            ItemFlow: this.itemFlow,
            SuccessionItemFlow: this.successionFlow,
            Invariant: this.invariant,
            OperatorExpression: this.operatorExpression,
            MetadataAccessExpression: this.metadataAccessExpression,
            InvocationExpression: this.invocationExpression,
            NamedArgument: this.namedArgument,
            FeatureChainExpression: this.featureChainExpression,
            CollectExpression: this.collectExpression,
            SelectExpression: this.selectExpression,
            Expression: this.expression,
            Usage: this.usage,
            OccurrenceDefinition: this.occurrenceDefinition,
            OccurrenceUsage: this.occurrenceUsage,
            EventOccurrenceUsage: this.eventOccurrenceUsage,
            BindingConnectorAsUsage: this.bindingConnectorAsUsage,
            ConnectionUsage: this.connectionUsage,
            FlowConnectionUsage: this.flowConnectionUsage,
            SuccessionFlowConnectionUsage: this.successionFlowConnectionUsage,
            InterfaceUsage: this.interfaceUsage,
            AllocationUsage: this.allocationUsage,
            PerformActionUsage: this.performActionUsage,
            InitialNode: this.initialNode,
            AcceptActionUsage: this.acceptActionUsage,
            TriggerInvocationExpression: this.triggerInvocationExpression,
            SendActionUsage: this.sendActionUsage,
            AssignmentActionUsage: this.assignmentActionUsage,
            IfActionUsage: this.ifActionUsage,
            WhileLoopActionUsage: this.whileLoopActionUsage,
            ForLoopActionUsage: this.forLoopActionUsage,
            SuccessionAsUsage: this.successionAsUsage,
            TransitionUsage: this.transitionUsage,
            ActionUsage: this.actionUsage,
            AssertConstraintUsage: this.assertConstraintUsage,
            ReferenceUsage: this.referenceUsage,
            ConstraintUsage: this.constraintUsage,
            ConcernUsage: this.concernUsage,
            PartUsage: this.partUsage,
            SatisfyRequirementUsage: this.satisfyRequirementsUsage,
            RequirementUsage: this.requirementUsage,
            UseCaseUsage: this.useCaseUsage,
            UseCaseDefinition: this.useCaseDefinition,
            IncludeUseCaseUsage: this.includeUseCaseUsage,
        };
        this.formattings = typeIndex.expandToDerivedTypes(
            functions as Readonly<TypeMap<ast.SysMlAstType, Format>>
        );
    }

    /**
     * Generic AST node formatting method that simply dispatches to the
     * registered formatting function based on node type
     * @param node AST node to format
     */
    protected format(node: AstNode): void {
        const formatting = this.formattings.get(node.$type);
        if (!formatting) return;
        const formatter = this.getNodeFormatter(node);
        formatting.call(this, node, formatter);
    }

    /**
     * Handle the overall indentation/lines of element nodes
     */
    protected formatPrepend(node: AstNode, formatter: NodeFormatter<AstNode>): void {
        const depth = !node.$container ? 0 : !node.$container.$container ? 1 : 2;
        const region = formatter.node(node);

        switch (depth) {
            case 1: {
                // elements inside root namespace
                const start = node.$cstNode?.offset;
                const isFirst = start === node.$container?.$cstNode?.offset;
                if (isFirst) {
                    // comments are not a part of the AST so have to check in the document directly
                    try {
                        const doc = getDocument(node);
                        if (doc.textDocument.getText().substring(0, start).trim().length === 0) {
                            region.prepend(Options.noSpace);
                            return;
                        }
                    } catch {
                        /* empty */
                    }

                    // no empty space to the first element
                    region.prepend(Formatting.fit(Options.noSpace, Options.newLine));
                    return;
                }

                region.prepend(Formatting.fit(Options.noIndent, Options.uptoTwoLines));

                break;
            }
            case 2: {
                // nested elements
                const isFirst = node.$cstNode?.offset === node.$cstNode?.parent?.offset;
                const isLast = node.$cstNode?.end === node.$cstNode?.parent?.end;

                if (isFirst) {
                    if (isLast) {
                        // for some reason a single item is not indented with
                        // interior...
                        region.prepend(Options.indent);
                    }
                } else {
                    // remove any extraneous new lines after 1 empty line
                    region.prepend(Options.uptoTwoLines);
                }
            }
        }
    }

    /**
     * Format the interior of a node
     */
    protected formatBody(formatter: NodeFormatter<ast.Element>, initial = Options.oneSpace): void {
        const bracesOpen = formatter.keyword("{");

        if (bracesOpen.nodes.length === 0) {
            // if no braces were found, assume ;
            formatter.keyword(";").prepend(Options.noSpace);
        } else {
            const bracesClose = formatter.keyword("}");
            bracesOpen.prepend(initial);

            const interior = formatter.interior(bracesOpen, bracesClose);
            if (interior.nodes.length > 0) {
                // indent all children
                interior.prepend(Options.indent);
                // and put the closing brace on a new line
                bracesClose.prepend(Options.newLine);
            } else {
                // no children inside
                bracesClose.prepend(Options.noSpace);
            }
        }
    }

    /**
     * Format {@link ast.Element Element}
     * @param node element to format
     * @param formatter
     * @param prepend if true, also call {@link formatPrepend}
     * @param prependNames if true, prepend a space action to declared names
     */
    protected element(
        node: ast.Element,
        formatter: NodeFormatter<ast.Element>,
        prepend = true,
        prependNames = true
    ): void {
        if (prepend) this.formatPrepend(node, formatter);

        if (node.visibility) {
            formatter.property("visibility").append(Options.oneSpace);
        }

        if (node.prefixes.length > 0) {
            formatter.property("prefixes").append(Options.spaceOrIndent);
        }

        if (node.declaredShortName && !node.$cstNode?.text.startsWith("<")) {
            const region = formatter.keyword("<");
            region.append(Options.noSpace);
            if (prependNames) region.prepend(Options.oneSpace);
            formatter.keyword(">").prepend(Options.noSpace);
        }

        if (
            node.declaredName &&
            (prependNames || node.declaredShortName) &&
            !node.$cstNode?.text.startsWith(node.declaredName)
        ) {
            formatter
                .property("declaredName")
                .prepend(node.declaredShortName ? Options.spaceOrIndent : Options.oneSpace);
        }

        this.formatBody(formatter);
    }

    /**
     * Format {@link ast.ElementReference ElementReference}
     */
    protected reference(
        _: ast.ElementReference,
        formatter: NodeFormatter<ast.ElementReference>
    ): void {
        formatter.keywords("::").prepend(Options.noSpace).append(Options.noSpaceOrIndent);
    }

    protected featureReference(
        node: ast.FeatureReference,
        formatter: NodeFormatter<ast.FeatureReference>
    ): void {
        this.reference(node, formatter);
        formatter.keywords(".").prepend(Options.noSpace).append(Options.noSpaceOrIndent);
    }

    protected conjugatePortReference(
        node: ast.ConjugatedPortReference,
        formatter: NodeFormatter<ast.ConjugatedPortReference>
    ): void {
        this.reference(node, formatter);
        formatter.keyword("~").append(Options.noSpace);
    }

    /**
     * Format {@link ast.MetadataFeature MetadataFeature}
     */
    protected metadataFeature(
        node: ast.MetadataFeature,
        formatter: NodeFormatter<ast.MetadataFeature>,
        typed = "typed" // is different in SysML
    ): void {
        const isPrefix = node.$containerProperty === "prefixes";
        const keyword = formatter.keyword(isPrefix ? "#" : "@");
        keyword.append(Options.noSpace);
        this.element(node, formatter, !isPrefix, keyword.nodes.length === 0);

        if (node.declaredName || node.declaredShortName) {
            let keyword = formatter.keyword(":");
            if (keyword.nodes.length === 0) {
                keyword = formatter.keyword(typed);

                if (keyword.nodes.length > 0) formatter.keyword("by").append(Options.oneSpace);
            }

            keyword.prepend(Options.spaceOrIndent).append(Options.oneSpace);
        }

        if (node.about.length > 0) {
            this.formatList(node, "about", formatter, { keyword: "about", indent: true });
        }
    }

    protected metadataUsage(
        node: ast.MetadataUsage,
        formatter: NodeFormatter<ast.MetadataUsage>
    ): void {
        this.metadataFeature(node, formatter, "defined");
    }

    /**
     * Format {@link ast.MultiplicityRange MultiplicityRange}
     */
    protected multiplicityRange(
        node: ast.MultiplicityRange,
        formatter: NodeFormatter<ast.MultiplicityRange>
    ): void {
        formatter.node(node).prepend(Options.inline);
        formatter.keyword("[").append(Options.noSpace);
        formatter.keyword("]").prepend(Options.noSpace);
    }

    protected nullExpression(
        node: ast.NullExpression,
        formatter: NodeFormatter<ast.NullExpression>
    ): void {
        formatter.keyword("(").append(Options.noSpace);
    }

    protected comment(node: ast.Comment, formatter: NodeFormatter<ast.Comment>): void {
        this.element(node, formatter);

        if (node.about.length > 0) {
            this.formatList(node, "about", formatter, {
                keyword: "about",
                indent: Boolean(node.declaredName || node.declaredShortName),
            });
        }

        if (node.declaredName || node.declaredShortName || node.about.length > 0)
            formatter.property("body").prepend(Options.indent);
        else if (node.$cstNode?.text.startsWith("comment"))
            formatter.property("body").prepend(Options.oneSpace);
    }

    protected doc(node: ast.Documentation, formatter: NodeFormatter<ast.Documentation>): void {
        this.element(node, formatter);
        if (node.declaredName || node.declaredShortName)
            formatter.property("body").prepend(Options.indent);
        else formatter.property("body").prepend(Options.oneSpace);
    }

    protected rep(
        node: ast.TextualRepresentation,
        formatter: NodeFormatter<ast.TextualRepresentation>
    ): void {
        this.element(node, formatter);
        formatter.keyword("language").prepend(Options.spaceOrIndent).append(Options.oneSpace);
        formatter.property("body").prepend(Options.indent);
    }

    protected definition(node: ast.Definition, formatter: NodeFormatter<ast.Definition>): void {
        this.type(node, formatter);
        formatter.keyword("def").prepend(Options.oneSpace);

        if (node.isVariation) {
            formatter.keyword("variation").append(Options.oneSpace);
        }
    }

    protected usagePart(node: ast.Usage, formatter: NodeFormatter<ast.Usage>): void {
        if (node.isVariation) {
            formatter.keyword("variation").append(Options.oneSpace);
        }

        if (node.isReference) {
            formatter.keyword("ref").append(Options.oneSpace);
        }
    }

    protected usage(node: ast.Usage, formatter: NodeFormatter<ast.Usage>): void {
        this.feature(node, formatter);

        this.usagePart(node, formatter);
    }

    protected dependency(node: ast.Dependency, formatter: NodeFormatter<ast.Dependency>): void {
        this.element(node, formatter);

        this.formatList(node, "client", formatter, {
            keyword: "from",
            indent: true,
        });

        this.formatList(node, "supplier", formatter, {
            keyword: "to",
            indent: true,
        });
    }

    protected alias(node: ast.Alias, formatter: NodeFormatter<ast.Alias>): void {
        this.element(node, formatter);

        formatter
            .keyword("for")
            .prepend(
                node.declaredName || node.declaredShortName ? Options.indent : Options.oneSpace
            );
        formatter.property("for").prepend(Options.oneSpace);
    }

    protected type(node: ast.Type, formatter: NodeFormatter<ast.Type>): void {
        this.element(node, formatter);

        if (node.isAbstract) {
            formatter.keyword("abstract").append(Options.oneSpace);
        }

        if (node.isSufficient) {
            formatter.keyword("all").surround(Options.oneSpace);
        }

        if (node.specializes.length > 0) {
            this.formatList(node, "specializes", formatter, {
                keyword: ["specializes", ":>"],
            });
        }

        if (node.conjugates.length > 0) {
            this.formatList(node, "conjugates", formatter, {
                keyword: ast.isUsage(node) ? ["defined", "by", ":"] : ["conjugates", "~"],
            });
        }

        if (node.disjoins.length > 0) {
            this.formatList(node, "disjoins", formatter, {
                keyword: ["disjoint", "from"],
            });
        }

        if (node.unions.length > 0) {
            this.formatList(node, "unions", formatter, {
                keyword: "unions",
            });
        }

        if (node.intersects.length > 0) {
            this.formatList(node, "intersects", formatter, {
                keyword: "intersects",
            });
        }

        if (node.differences.length > 0) {
            this.formatList(node, "differences", formatter, {
                keyword: "differences",
            });
        }
    }

    protected assocStruct(
        node: ast.AssociationStructure,
        formatter: NodeFormatter<ast.AssociationStructure>
    ): void {
        this.type(node, formatter);

        formatter.keyword("assoc").append(Options.oneSpace);
    }

    protected feature(node: ast.Feature, formatter: NodeFormatter<ast.Feature>): void {
        this.type(node, formatter);

        if (node.direction) {
            formatter.property("direction").append(Options.oneSpace);
        }

        let modifiers = 0;
        if (node.isComposite) {
            formatter.property("isComposite").append(Options.oneSpace);
            modifiers++;
        }

        if (node.isPortion) {
            formatter.property("isPortion").append(Options.oneSpace);
            modifiers++;
        }

        if (node.isReadOnly) {
            formatter.property("isReadOnly").append(Options.oneSpace);
            modifiers++;
        }

        if (node.isEnd) {
            formatter.property("isEnd").append(Options.oneSpace);
            modifiers++;
        }

        if (node.isDerived) {
            formatter.property("isDerived").append(Options.oneSpace);
            modifiers++;
        }

        if (node.prefixes.length > 0 && modifiers > 0) {
            formatter.property("prefixes").prepend(Options.spaceOrIndent);
        }

        switch (node.$containerProperty) {
            case "return":
                formatter.keyword("return").append(Options.oneSpace);
                break;
            case "members":
                formatter.keyword("member").append(Options.oneSpace);
                break;
            case "variants":
                formatter.keyword("variant").append(Options.oneSpace);
                break;
        }

        if (node.isNonunique) {
            formatter.keyword("nonunique").prepend(Options.oneSpace);
        }

        if (node.isOrdered) {
            formatter.keyword("ordered").prepend(Options.oneSpace);
        }

        if (node.chains.length > 0) {
            this.formatList(node, "chains", formatter, {
                keyword: "chains",
            });
        }

        if (node.inverseOf.length > 0) {
            this.formatList(node, "inverseOf", formatter, {
                keyword: ["inverse", "of"],
            });
        }

        if (node.featuredBy.length > 0) {
            this.formatList(node, "featuredBy", formatter, {
                keyword: ["featured", "by"],
            });
        }

        if (node.typedBy.length > 0) {
            this.formatList(node, "typedBy", formatter, {
                keyword: [":", ast.isUsage(node) ? "defined" : "typed", "by"],
            });
        }

        if (node.subsets.length > 0) {
            this.formatList(node, "subsets", formatter, {
                keyword: ["subsets", ":>"],
            });
        }

        if (node.redefines.length > 0) {
            this.formatList(node, "redefines", formatter, {
                keyword: ["redefines", ":>>"],
            });
        }

        if (node.references.length > 0) {
            this.formatList(node, "references", formatter, {
                keyword: ["references", "::>"],
            });
        }
    }

    protected featureValue(
        node: ast.FeatureValue,
        formatter: NodeFormatter<ast.FeatureValue>
    ): void {
        const equal = formatter.keyword(node.isInitial ? ":=" : "=");
        equal.prepend(Options.oneSpace);
        if (node.isDefault) {
            formatter.keyword("default").prepend(Options.oneSpace);
        }

        formatter.node(node.expression).prepend(addIndent(Options.spaceOrLine, 1));
    }

    protected elementFilter(
        node: ast.ElementFilter,
        formatter: NodeFormatter<ast.ElementFilter>
    ): void {
        this.formatPrepend(node, formatter);
        if (node.visibility) formatter.property("visibility").append(Options.oneSpace);
        formatter.keyword("filter").append(Options.oneSpace);
        formatter.keyword(";").prepend(Options.noSpace);
    }

    protected libraryPackage(
        node: ast.LibraryPackage,
        formatter: NodeFormatter<ast.LibraryPackage>
    ): void {
        this.element(node, formatter);

        if (node.isStandard) formatter.keyword("standard").append(Options.oneSpace);
        formatter.keyword("library").append(Options.oneSpace);
    }

    protected multiplicity(
        node: ast.Multiplicity,
        formatter: NodeFormatter<ast.Multiplicity>
    ): void {
        this.element(node, formatter);

        if (node.range) {
            this.formatBraces(formatter, "[", "]", formatter.node(node.range)).prepend(
                Options.oneSpace
            );
        }

        if (node.subsets.length > 0) {
            this.formatList(node, "subsets", formatter, { keyword: ["subsets", ":>"] });
        }
    }

    protected import(node: ast.Import, formatter: NodeFormatter<ast.Import>): void {
        this.formatPrepend(node, formatter);
        if (node.visibility) formatter.property("visibility").append(Options.oneSpace);
        if (node.importsAll) formatter.keyword("all").prepend(Options.oneSpace);
        if (node.importedNamespace)
            formatter.property("importedNamespace").prepend(Options.oneSpace);
        if (node.kind)
            formatter
                .property("kind")
                .prepend(node.importedNamespace ? Options.noSpace : Options.oneSpace);
        if (node.conditions.length > 0) {
            node.conditions.forEach((expr, i) =>
                this.formatBraces(formatter, "[", "]", formatter.node(expr), i).prepend(
                    Options.noSpaceOrIndent
                )
            );
        }

        this.formatBody(formatter);
    }

    protected explicitSpecialization(
        node: ast.Element,
        formatter: NodeFormatter<ast.Element>,
        keyword = "specialization"
    ): void {
        this.element(node, formatter);

        formatter.keyword(keyword).append(Options.oneSpace);
        if (node.declaredName) {
            formatter.property("declaredName").append(Options.spaceOrIndent);
        } else if (node.declaredShortName) {
            formatter.keyword(">").append(Options.spaceOrIndent);
        }
    }

    protected specialization(
        node: ast.Specialization,
        formatter: NodeFormatter<ast.Specialization>,
        keyword = "specialization"
    ): void {
        this.explicitSpecialization(node, formatter, keyword);

        formatter.property("specific").prepend(Options.oneSpace).append(Options.spaceOrIndent);
        formatter.property("general").prepend(Options.oneSpace);
    }

    protected featureTyping(
        node: ast.FeatureTyping,
        formatter: NodeFormatter<ast.FeatureTyping>
    ): void {
        this.specialization(node, formatter);
        formatter.keyword("typed").append(Options.oneSpace);
    }

    protected conjugation(node: ast.Conjugation, formatter: NodeFormatter<ast.Conjugation>): void {
        this.specialization(node, formatter, "conjugation");
    }

    protected disjoining(node: ast.Disjoining, formatter: NodeFormatter<ast.Disjoining>): void {
        this.explicitSpecialization(node, formatter, "disjoining");
        formatter.property("disjoined").prepend(Options.oneSpace).append(Options.spaceOrIndent);
        formatter.property("disjoining").prepend(Options.oneSpace);
    }

    protected featureInverting(
        node: ast.FeatureInverting,
        formatter: NodeFormatter<ast.FeatureInverting>
    ): void {
        this.explicitSpecialization(node, formatter, "inverting");
        formatter
            .property("featureInverted")
            .prepend(Options.oneSpace)
            .append(Options.spaceOrIndent);
        formatter.property("invertingFeature").prepend(Options.oneSpace);
    }

    protected typeFeaturing(
        node: ast.TypeFeaturing,
        formatter: NodeFormatter<ast.TypeFeaturing>
    ): void {
        this.explicitSpecialization(node, formatter, "featuring");
        formatter.property("feature").prepend(Options.oneSpace).append(Options.spaceOrIndent);
        formatter.property("featuringType").prepend(Options.oneSpace);
    }

    protected connector(
        node: ast.Connector,
        formatter: NodeFormatter<ast.Connector>,
        keywords: [string, string] = ["from", "to"]
    ): void {
        this.feature(node, formatter);

        const braceOpen = formatter.keyword("(");
        if (braceOpen.nodes.length === 0) {
            // binary
            const from = formatter.keyword(keywords[0]);
            if (from.nodes.length === 0) formatter.node(node.ends[0]).prepend(Options.indent);
            else from.prepend(Options.indent).append(Options.oneSpace);
            formatter.keyword(keywords[1]).prepend(Options.indent).append(Options.oneSpace);
            formatter.nodes(...node.ends).prepend(highPriority(Options.oneSpace));
        } else {
            // nary
            braceOpen.prepend(Options.oneSpace);
            formatter.keyword(")").prepend(Options.indent);
            this.formatList(node, "ends", formatter, {
                // using priority > 0 so that if ends are references only they
                // don't end up overwriting these moves
                initial: highPriority(Options.indent),
                next: highPriority(Options.spaceOrIndent),
            });
        }
    }

    protected formatBinding(
        node: ast.Feature,
        formatter: NodeFormatter<ast.Feature>,
        ends: AstNode[],
        prefix: string,
        binder: string
    ): void {
        this.feature(node, formatter);
        if (ends.length === 0) return;

        const first = formatter.keyword(prefix);
        let start = 0;
        if (first.nodes.length > 0) {
            if (node.$cstNode?.offset !== first.nodes[0].offset)
                first.prepend(Options.spaceOrIndent);
            first.append(Options.oneSpace);
        } else {
            formatter.node(ends[0]).prepend(highPriority(Options.spaceOrIndent));
            start = 1;
        }
        formatter.keyword(binder).prepend(Options.spaceOrIndent).append(Options.oneSpace);
        formatter.nodes(...ends.slice(start)).prepend(highPriority(Options.oneSpace));
    }

    protected bindingConnector(
        node: ast.BindingConnector,
        formatter: NodeFormatter<ast.BindingConnector>
    ): void {
        this.formatBinding(node, formatter, node.ends, "of", "=");
    }

    protected bindingConnectorAsUsage(
        node: ast.BindingConnectorAsUsage,
        formatter: NodeFormatter<ast.BindingConnectorAsUsage>
    ): void {
        this.formatBinding(node, formatter, node.ends, "bind", "=");
    }

    protected succession(node: ast.Succession, formatter: NodeFormatter<ast.Succession>): void {
        this.formatBinding(node, formatter, node.ends, "first", "then");
    }

    protected itemFlow(
        node: ast.ItemFlow,
        formatter: NodeFormatter<ast.ItemFlow>,
        keyword = /flow/
    ): void {
        this.formatBinding(node, formatter, node.ends, "from", "to");

        const of = formatter.keyword("of");
        if (of.nodes.length === 0) return;
        const previous = getPreviousNode(of.nodes[0]);
        if (previous?.text && keyword.test(previous.text)) {
            of.prepend(Options.oneSpace);
        } else {
            of.prepend(Options.indent);
        }

        of.append(Options.oneSpace);
    }

    protected successionFlow(
        node: ast.SuccessionItemFlow,
        formatter: NodeFormatter<ast.SuccessionItemFlow>
    ): void {
        this.itemFlow(node, formatter);

        formatter.keyword("succession").append(Options.oneSpace);
    }

    protected invariant(node: ast.Invariant, formatter: NodeFormatter<ast.Invariant>): void {
        this.feature(node, formatter);

        formatter.keyword(node.isNegated ? "false" : "true").prepend(Options.oneSpace);
    }

    protected expression(node: ast.Expression, formatter: NodeFormatter<ast.Expression>): void {
        if (!node.$cstNode?.text.startsWith("{")) {
            this.feature(node, formatter);
        } else {
            // expression body
            this.formatBody(
                formatter,
                // first parent is FeatureReferenceExpression
                ast.isInvocationExpression(node.$container.$container)
                    ? Options.noSpace
                    : Options.oneSpace
            );
        }

        if (node.result) {
            formatter.node(node.result).prepend(Options.newLine);
        }
    }

    protected formatBraces(
        formatter: NodeFormatter<AstNode>,
        open: string,
        close: string,
        interior?: FormattingRegion,
        index?: number
    ): FormattingRegion {
        let left = formatter.keywords(open);
        if (left.nodes.length === 0) return left;

        index ??= 0;
        index = Math.min(index, left.nodes.length - 1);
        const right = formatter.keyword(close, left.nodes.length - index - 1);
        left = formatter.cst([left.nodes[index]]);
        interior ??= formatter.interior(left, right);
        const arg = interior.nodes.at(-1) ?? left.nodes[0];
        const inline = linesDiff(arg, left.nodes[0]) === 0;
        if (inline) {
            left.append(Options.noSpace);
            right.prepend(Options.noSpace);
        } else {
            interior.prepend(Options.indent);
            right.prepend(Options.newLine);
        }

        return left;
    }

    protected operatorExpression(
        node: ast.OperatorExpression,
        formatter: NodeFormatter<ast.OperatorExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        const operator = formatter.property("operator");

        switch (node.operator) {
            case "..":
            case "**":
            case "^": {
                operator.prepend(Options.noSpace).append(Options.noSpaceOrIndent);
                break;
            }

            case ",": {
                operator.prepend(Options.noSpace).append(Options.spaceOrLine);
                break;
            }

            case "if": {
                operator.append(Options.oneSpace);
                formatter.keyword("?").prepend(Options.indent).append(Options.oneSpace);
                formatter.keyword("else").prepend(Options.indent).append(Options.oneSpace);
                break;
            }

            case "[": {
                this.formatBraces(formatter, "[", "]", formatter.node(node.args[1])).prepend(
                    Options.noSpace
                );
                break;
            }

            default: {
                if (!node.operator) break;
                if (node.args.length === 1) {
                    operator.append(
                        /not|all/.test(node.operator) ? Options.oneSpace : Options.noSpace
                    );
                } else {
                    if (!node.$cstNode?.text.startsWith(node.operator)) {
                        operator.prepend(Options.spaceOrLine);
                    }
                    operator.append(Options.oneSpace);
                }
                break;
            }
        }
    }

    protected metadataAccessExpression(
        node: ast.MetadataAccessExpression,
        formatter: NodeFormatter<ast.MetadataAccessExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        const dot = formatter.keyword(".");
        if (dot.nodes.length === 0) return;
        dot.prepend(Options.noSpace).append(Options.noSpace);
    }

    protected invocationExpression(
        node: ast.InvocationExpression,
        formatter: NodeFormatter<ast.InvocationExpression>
    ): void {
        if (node.$cstNode?.text.startsWith("(")) {
            this.formatBraces(formatter, "(", ")").append(Options.newLine);
        }

        const braces = formatter.keyword("(", 1);

        if (braces.nodes.length > 0) {
            // arg list
            braces.prepend(Options.noSpace);
            const closing = formatter.keyword(")", 0);
            if (node.args.length > 0) {
                if (ast.isNamedArgument(node.args[0])) {
                    this.formatList(node, "args", formatter, {
                        initial: Options.newLine,
                        next: Options.newLine,
                    });
                    closing.prepend(Options.newLine);
                } else {
                    const inline = linesDiff(braces.nodes[0], closing.nodes[0]) === 0;

                    this.formatList(node, "args", formatter, {
                        initial: inline ? Options.noSpace : Options.newLine,
                        next: inline ? Options.oneSpace : Options.spaceOrLine,
                    });

                    closing.prepend(inline ? Options.noSpace : Options.newLine);
                }
            } else {
                // empty list
                braces.append(Options.noSpace);
            }
        }

        const arrow = formatter.keyword("->");
        if (arrow.nodes.length > 0) {
            arrow.prepend(Options.noSpaceOrIndent).append(Options.noSpace);
            formatter.property("type").append(Options.spaceOrIndent);
        }
    }

    protected namedArgument(
        node: ast.NamedArgument,
        formatter: NodeFormatter<ast.NamedArgument>
    ): void {
        formatter.keyword("=").prepend(Options.noSpace).append(Options.noSpace);
    }

    protected featureChainExpression(
        node: ast.FeatureChainExpression,
        formatter: NodeFormatter<ast.FeatureChainExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        formatter.keyword(".").prepend(Options.noSpace).append(Options.noSpaceOrIndent);
    }

    protected collectExpression(
        node: ast.CollectExpression,
        formatter: NodeFormatter<ast.CollectExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        formatter.keyword(".").prepend(Options.noSpace).append(Options.noSpace);
    }

    protected selectExpression(
        node: ast.SelectExpression,
        formatter: NodeFormatter<ast.SelectExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        formatter.keyword(".?").prepend(Options.noSpace).append(highPriority(Options.noSpace));
    }

    protected occurrenceDefinition(
        node: ast.OccurrenceDefinition,
        formatter: NodeFormatter<ast.OccurrenceDefinition>
    ): void {
        this.definition(node, formatter);
        if (node.isIndividual) formatter.keyword("individual").append(Options.oneSpace);
    }

    protected occurrenceUsagePart(
        node: ast.OccurrenceUsage,
        formatter: NodeFormatter<ast.OccurrenceUsage>
    ): void {
        this.usagePart(node, formatter);
        if (node.isIndividual) formatter.keyword("individual").append(Options.oneSpace);
        if (node.portionKind) formatter.property("portionKind").append(Options.oneSpace);

        // handle empty succession usages that start with 'then' and have no ends
        if (!node.$containerIndex || !("features" in node.$container)) return;
        const prev = node.$container.features[node.$containerIndex - 1];
        if (
            prev?.$type === ast.SuccessionAsUsage &&
            (prev as ast.SuccessionAsUsage).ends.length === 0
        )
            formatter.node(node).prepend(Options.oneSpace);
    }

    protected occurrenceUsage(
        node: ast.OccurrenceUsage,
        formatter: NodeFormatter<ast.OccurrenceUsage>
    ): void {
        this.feature(node, formatter);
        this.occurrenceUsagePart(node, formatter);
    }

    protected eventOccurrenceUsage(
        node: ast.EventOccurrenceUsage,
        formatter: NodeFormatter<ast.EventOccurrenceUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
        const kw = formatter.keyword("occurrence");
        if (kw.nodes.length > 0) kw.prepend(Options.oneSpace);
        else if (node.references.length > 0) {
            // references is the first sub element without 'occurrence', format
            // it on the same line
            formatter.node(node.references[0]).prepend(Options.oneSpace);
        }
    }

    protected connectionUsage(
        node: ast.ConnectionUsage,
        formatter: NodeFormatter<ast.ConnectionUsage>
    ): void {
        this.connector(node, formatter, ["connect", "to"]);
        this.occurrenceUsagePart(node, formatter);

        const connection = formatter.keyword("connection");
        if (connection.nodes.length > 0) connection.append(Options.oneSpace);
        else formatter.keyword("connect").prepend(Options.oneSpace);
    }

    protected interfaceUsage(
        node: ast.InterfaceUsage,
        formatter: NodeFormatter<ast.InterfaceUsage>
    ): void {
        this.connector(node, formatter, ["connect", "to"]);
        this.occurrenceUsagePart(node, formatter);
        formatter.keyword("interface").append(Options.oneSpace);
    }

    protected allocationUsage(
        node: ast.AllocationUsage,
        formatter: NodeFormatter<ast.AllocationUsage>
    ): void {
        this.connector(node, formatter, ["allocate", "to"]);
        this.occurrenceUsagePart(node, formatter);
        formatter.keyword("allocation").append(Options.oneSpace);
    }

    protected flowConnectionUsage(
        node: ast.FlowConnectionUsage,
        formatter: NodeFormatter<ast.FlowConnectionUsage>
    ): void {
        this.itemFlow(node, formatter, /message|flow/);
        this.occurrenceUsagePart(node, formatter);
    }

    protected successionFlowConnectionUsage(
        node: ast.SuccessionFlowConnectionUsage,
        formatter: NodeFormatter<ast.SuccessionFlowConnectionUsage>
    ): void {
        this.flowConnectionUsage(node, formatter);
        formatter.keyword("succession").append(Options.oneSpace);
    }

    protected performActionUsage(
        node: ast.PerformActionUsage,
        formatter: NodeFormatter<ast.PerformActionUsage>
    ): void {
        this.actionUsage(node, formatter);
        formatter.keyword("perform").append(Options.oneSpace);
    }

    protected initialNode(node: ast.InitialNode, formatter: NodeFormatter<ast.InitialNode>): void {
        this.element(node, formatter);
        formatter.keyword("first").append(Options.oneSpace);
    }

    protected acceptActionUsage(
        node: ast.AcceptActionUsage,
        formatter: NodeFormatter<ast.AcceptActionUsage>
    ): void {
        this.actionUsage(node, formatter);
        formatter.keyword("accept").prepend(Options.indent).append(Options.oneSpace);
        if (node.via) formatter.keyword("via").prepend(Options.indent).append(Options.oneSpace);
    }

    protected triggerInvocationExpression(
        node: ast.TriggerInvocationExpression,
        formatter: NodeFormatter<ast.TriggerInvocationExpression>
    ): void {
        formatter.property("kind").prepend(Options.oneSpace).append(Options.oneSpace);
    }

    protected sendActionUsage(
        node: ast.SendActionUsage,
        formatter: NodeFormatter<ast.SendActionUsage>
    ): void {
        this.actionUsage(node, formatter);
        formatter.keyword("send").prepend(Options.indent).append(Options.oneSpace);
        if (node.via) formatter.keyword("via").prepend(Options.indent).append(Options.oneSpace);
        if (node.to) formatter.keyword("to").prepend(Options.indent).append(Options.oneSpace);
    }

    protected assignmentActionUsage(
        node: ast.AssignmentActionUsage,
        formatter: NodeFormatter<ast.AssignmentActionUsage>
    ): void {
        this.actionUsage(node, formatter);
        this.formatBinding(node, formatter, [node.left, node.right], "assign", ":=");
    }

    protected ifActionUsage(
        node: ast.IfActionUsage,
        formatter: NodeFormatter<ast.IfActionUsage>
    ): void {
        this.usage(node, formatter);
        formatter.keyword("if").prepend(Options.indent).append(Options.oneSpace);
        formatter.node(node.body).prepend(highPriority(addIndent(Options.indent, 1)));
        if (node.else) {
            formatter.keyword("else").prepend(Options.indent);
            formatter.node(node.else).prepend(highPriority(addIndent(Options.oneSpace, 2)));
        }
    }

    protected whileLoopActionUsage(
        node: ast.WhileLoopActionUsage,
        formatter: NodeFormatter<ast.WhileLoopActionUsage>
    ): void {
        this.usage(node, formatter);

        if (node.expression) {
            formatter.keyword("while").prepend(Options.indent);
            formatter.node(node.expression).prepend(addIndent(Options.oneSpace, 1));
        } else {
            formatter.keyword("loop").prepend(Options.indent);
        }
        formatter.node(node.body).prepend(highPriority(addIndent(Options.indent, 1)));
        if (node.until) {
            formatter.keyword("until").prepend(Options.indent);
            formatter.node(node.until).prepend(highPriority(addIndent(Options.oneSpace, 2)));
        }
    }

    protected forLoopActionUsage(
        node: ast.ForLoopActionUsage,
        formatter: NodeFormatter<ast.ForLoopActionUsage>
    ): void {
        this.usage(node, formatter);

        formatter.keyword("for").prepend(Options.indent);
        formatter.node(node.for).prepend(highPriority(addIndent(Options.oneSpace, 1)));
        formatter.keyword("in").prepend(Options.spaceOrIndent);
        formatter.node(node.expression).prepend(addIndent(Options.oneSpace, 1));
        formatter.node(node.body).prepend(highPriority(addIndent(Options.indent, 1)));
    }

    protected successionAsUsage(
        node: ast.SuccessionAsUsage,
        formatter: NodeFormatter<ast.SuccessionAsUsage>
    ): void {
        this.usagePart(node, formatter);
        this.succession(node, formatter);
    }

    protected transitionUsage(
        node: ast.TransitionUsage,
        formatter: NodeFormatter<ast.TransitionUsage>
    ): void {
        this.occurrenceUsage(node, formatter);

        const formatProp = <K extends KeysMatching<ast.TransitionUsage, AstNode | undefined>>(
            kw: string,
            p: K
        ): void => {
            const child = node[p];
            if (child) {
                const kwRegion = formatter.keyword(kw);
                kwRegion.prepend(Options.indent);
                const action =
                    kwRegion.nodes.length > 0 ? addIndent(Options.oneSpace, 1) : Options.indent;
                formatter.node(child).prepend(highPriority(action));
            }
        };

        formatProp("first", "source");
        formatProp("if", "guard");
        formatProp("then", "then");
        formatProp("else", "else");
        formatProp("do", "effect");

        if (node.trigger) {
            formatter
                .keyword("accept")
                .prepend(Options.indent)
                .append(addIndent(Options.oneSpace, 1));
        }
    }

    protected actionUsage(node: ast.ActionUsage, formatter: NodeFormatter<ast.ActionUsage>): void {
        this.occurrenceUsage(node, formatter);

        if (node.actionKind) {
            formatter.property("actionKind").append(Options.oneSpace);
        }
    }

    protected assertConstraintUsage(
        node: ast.AssertConstraintUsage,
        formatter: NodeFormatter<ast.AssertConstraintUsage>
    ): void {
        this.occurrenceUsage(node, formatter);

        formatter.keyword("assert").append(Options.oneSpace);
        formatter.keyword("not").append(Options.oneSpace);
    }

    protected referenceUsage(
        node: ast.ReferenceUsage,
        formatter: NodeFormatter<ast.ReferenceUsage>
    ): void {
        this.usage(node, formatter);
        if (node.isSubject) formatter.keyword("subject").append(Options.oneSpace);
    }

    protected constraintUsage(
        node: ast.ConstraintUsage,
        formatter: NodeFormatter<ast.ConstraintUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
        formatter.property("constraintKind").append(Options.oneSpace);
    }

    protected concernUsage(
        node: ast.ConcernUsage,
        formatter: NodeFormatter<ast.ConcernUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
        if (node.isFramed) formatter.keyword("frame").append(Options.oneSpace);
    }

    protected partUsage(node: ast.PartUsage, formatter: NodeFormatter<ast.PartUsage>): void {
        this.occurrenceUsage(node, formatter);
        if (node.parameterKind) formatter.property("parameterKind").append(Options.oneSpace);
    }

    protected satisfyRequirementsUsage(
        node: ast.SatisfyRequirementUsage,
        formatter: NodeFormatter<ast.SatisfyRequirementUsage>
    ): void {
        this.assertConstraintUsage(node, formatter);
        formatter.keyword("satisfy").append(Options.oneSpace);
        if (node.by) {
            formatter.keyword("by").prepend(Options.indent).append(addIndent(Options.oneSpace, 1));
        }
    }

    protected requirementUsage(
        node: ast.RequirementUsage,
        formatter: NodeFormatter<ast.RequirementUsage>
    ): void {
        this.constraintUsage(node, formatter);
        if (node.requirementKind) formatter.property("requirementKind").append(Options.oneSpace);
    }

    protected useCaseUsage(
        node: ast.UseCaseUsage,
        formatter: NodeFormatter<ast.UseCaseUsage>
    ): void {
        this.occurrenceUsage(node, formatter);

        formatter.keyword("use").append(Options.oneSpace);
    }

    protected useCaseDefinition(
        node: ast.UseCaseDefinition,
        formatter: NodeFormatter<ast.UseCaseDefinition>
    ): void {
        this.occurrenceDefinition(node, formatter);

        formatter.keyword("use").append(Options.oneSpace);
    }

    protected includeUseCaseUsage(
        node: ast.IncludeUseCaseUsage,
        formatter: NodeFormatter<ast.IncludeUseCaseUsage>
    ): void {
        this.useCaseUsage(node, formatter);

        formatter.keyword("include").append(Options.oneSpace);
    }

    protected override doDocumentFormat(
        document: LangiumDocument,
        options: FormattingOptions,
        range?: Range
    ): TextEdit[] {
        if (
            document.parseResult.lexerErrors.length > 0 ||
            document.parseResult.parserErrors.length > 0
        ) {
            // do not format invalid documents
            return [];
        }

        return super.doDocumentFormat(document, options, range);
    }

    protected override createHiddenTextEdits(
        previous: CstNode | undefined,
        hidden: CstNode,
        formatting: FormattingAction | undefined,
        context: FormattingContext
    ): TextEdit[] {
        const edits: TextEdit[] = [];

        // remove any extraneous empty lines before comments
        const line = hidden.range.start.line;
        const prevLine = previous?.range.end.line ?? -1;
        const prevText = previous?.text ?? "";

        const emptyLines = line - prevLine;
        if (emptyLines > 1) {
            const isFirst = !/(;|\})$/.test(prevText);
            edits.push({
                newText: isFirst ? "" : "\n",
                range: {
                    start: {
                        line: prevLine + 1,
                        character: 0,
                    },
                    end: {
                        line: hidden.range.start.line,
                        character: 0,
                    },
                },
            });
        }

        edits.push(...super.createHiddenTextEdits(previous, hidden, formatting, context));

        if (formatting) {
            // we are here from an AST formatting append action, don't compute
            // any append formatting for this hidden comment yet to avoid
            // overlapping edits. This will be called through CST traversal
            // later
            return edits;
        }

        // ensure a single space between previous CST node and this comment if
        // they are on the same line
        if (previous) {
            const edit = this.addSpaceBetween(previous, hidden, context);
            if (edit) edits.push(edit);
        }

        const nextNode = getNextNode(hidden);
        if (!nextNode) {
            // nothing to do since there is no next node
            return edits;
        }

        if (hidden.range.end.line === nextNode.range.start.line) {
            const edit = this.addSpaceBetween(hidden, nextNode, context);
            if (edit) {
                edits.push(edit);
            }
            // next node is continued on the same line so nothing more to do
            return edits;
        }

        const nextElem = this.owningElement(nextNode);
        const prevElem = this.owningElement(previous);
        if (nextElem != prevElem) {
            return edits;
        }

        // this hidden node intersects a rule and the next CST node
        // starts on another line -> indent the next CST node by an additional
        // level

        // remove any empty lines between the comment and the rule continuation
        const lineDiff = nextNode.range.start.line - hidden.range.end.line;
        if (lineDiff > 1) {
            edits.push({
                newText: "",
                range: {
                    start: {
                        line: hidden.range.end.line + 1,
                        character: 0,
                    },
                    end: {
                        line: nextNode.range.start.line,
                        character: 0,
                    },
                },
            });
        }

        // add an indentation level for the rule continuation
        const nextRange: Range = {
            start: {
                character: 0,
                line: nextNode.range.start.line,
            },
            end: nextNode.range.start,
        };
        const nextText = context.document.getText(nextRange);
        const nextStartChar = this.getExistingIndentationCharacterCount(nextText, context);
        const expectedStartChar = this.getIndentationCharacterCount(context, {
            tabs: context.indentation + 1,
        });

        const characterIncrease = expectedStartChar - nextStartChar;

        if (characterIncrease !== 0) {
            edits.push({
                newText: (context.options.insertSpaces ? " " : "\t").repeat(expectedStartChar),
                range: nextRange,
            });
        }

        return edits;
    }

    protected override createTextEdit(
        a: CstNode | undefined,
        b: CstNode,
        formatting: FormattingAction,
        context: FormattingContext
    ): TextEdit[] {
        const edits = super.createTextEdit(a, b, formatting, context);

        if (b.text.startsWith("/*") && b.range.start.line !== b.range.end.line) {
            const edit = this.rewriteMultilineCommentBody(b, a, context);
            if (edit) edits.push(edit);
        }

        return edits;
    }

    /**
     *
     * @param node CST node to multiline comment
     * @param previous previous CST node
     * @param context formatting context
     * @returns edit with the rewritten body if one is needed
     */
    protected rewriteMultilineCommentBody(
        node: CstNode,
        previous: CstNode | undefined,
        context: FormattingContext
    ): TextEdit | undefined {
        let element: ast.TextualAnnotatingElement;
        if (!ast.isTextualAnnotatingElement(node.element)) {
            // i.e. the text document is a single comment body
            /* istanbul ignore next (safe-guard and type hint) */
            if (!ast.isNamespace(node.element)) return;
            element = node.element.$meta.comments[0];
        } else {
            element = node.element;
        }

        const body = element.$meta.body;
        let offset = 0;

        if (element.$type === ast.Comment) {
            if (previous?.text === "comment") {
                // body is on the same line as `comment`
                offset = 8; // offset for "comment "
            }
        } else if (element.$type === ast.Documentation) {
            if (previous?.text === "doc") {
                // body is on the same line as `doc`
                offset = 4; // offset for "doc "
            }
        }

        const prefix = this.getIndent(context.indentation, context.options) + " ".repeat(offset);
        const separator = "\n" + prefix;
        return TextEdit.replace(
            node.range,
            "/*" +
                separator +
                body
                    .split("\n")
                    .map((line) => (line.length === 0 ? " *" : " * " + line))
                    .join(separator) +
                (separator + " */")
        );
    }

    /**
     * Get the CST node owning AST node
     */
    protected owningElement(node: CstNode | undefined): AstNode | undefined {
        // have to skip reference elements when comparing AST nodes as they are
        // always a part of some other AST element
        if (ast.isElementReference(node?.element)) return node?.element.$container;
        return node?.element;
    }

    /**
     * Create a text edit for a single space between `left` and `right` if applicable
     */
    protected addSpaceBetween(
        left: CstNode,
        right: CstNode,
        context: FormattingContext
    ): TextEdit | undefined {
        if (left.range.end.line !== right.range.start.line) return;

        const spaceRange: Range = {
            start: left.range.end,
            end: right.range.start,
        };
        const space = context.document.getText(spaceRange);
        if (space !== " ") {
            return {
                newText: " ",
                range: spaceRange,
            };
        }

        return;
    }

    protected formatList<T extends AstNode, K extends KeysMatching<T, AstNode[]>>(
        node: T,
        property: K,
        formatter: NodeFormatter<AstNode>,
        options?:
            | { keyword: string | string[]; indent?: boolean }
            | { initial?: FormattingAction; next?: FormattingAction }
    ): void {
        formatter.keywords(",").prepend(Options.noSpace);
        const items = node[property] as AstNode[];
        let initial = Options.spaceOrIndent;
        let next = Options.spaceOrIndent;
        if (options) {
            if ("keyword" in options) {
                const kw =
                    typeof options.keyword === "string"
                        ? formatter.keywords(options.keyword)
                        : formatter.keywords(...options.keyword);
                if (kw.nodes.length > 0) {
                    const action = options.indent
                        ? Options.indent
                        : options.indent === undefined
                        ? Options.spaceOrIndent
                        : Options.oneSpace;
                    if (node.$cstNode?.text.startsWith(kw.nodes[0].text)) {
                        // don't need to prepend anything if the element starts with
                        // the keyword already
                        kw.slice(1).prepend(action);
                    } else {
                        kw.prepend(action);
                    }
                    initial = Options.oneSpace;
                    next = Options.spaceOrIndent;
                }
            } else {
                if (options.initial) initial = options.initial;
                if (options.next) next = options.next;
            }
        }

        initial = addIndent(initial, 1);
        next = addIndent(next, 1);

        items.forEach((item, i) => {
            const region = formatter.node(item);
            if (i === 0) {
                if (item.$cstNode?.offset !== node.$cstNode?.offset) {
                    // only prepend if the list doesn't start at the same position as the owning node
                    region.prepend(initial);
                } else {
                    region.prepend(Options.spaceOrLine);
                }
                return;
            }
            // handle repeated keywords
            const previous = getPreviousNode(region.nodes[0], false);
            region.prepend(
                isKeyword(previous?.feature) && previous?.feature.value === "," ? next : initial
            );
        });
    }

    protected getIndent(indentation: number, options: FormattingOptions): string {
        const single = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
        return single.repeat(indentation);
    }
}
