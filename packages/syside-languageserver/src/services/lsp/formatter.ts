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
    findLeafNodeAtOffset,
    Formatting,
    FormattingAction,
    FormattingContext,
    FormattingMove,
    FormattingRegion,
    LangiumDocument,
    NodeFormatter,
    Properties,
    stream,
    streamAllContents,
} from "langium";
import { TextualAnnotatingMeta, typeIndex, TypeMap } from "../../model";
import * as ast from "../../generated/ast";
import { isProgrammaticNode, SysMLType, SysMLTypeList } from "../sysml-ast-reflection";
import { FormattingOptions, Range, TextEdit } from "vscode-languageserver";
import { KeysMatching, NonNullable } from "../../utils/common";
import { linesDiff } from "../../utils/ast-util";
import { findChildren, getNextNode, getPreviousNode } from "../../utils/cst-util";

type Format<T extends AstNode = AstNode> = (node: T, formatter: NodeFormatter<T>) => void;
type FormatMap = {
    [K in SysMLType]?: Format<SysMLTypeList[K]>;
};

const Formatters: FormatMap = {};

function formatter<K extends SysMLType>(...type: K[]) {
    return function <T, TK extends KeysMatching<T, Format<SysMLTypeList[K]>>>(
        _: T,
        __: TK,
        descriptor: PropertyDescriptor
    ): void {
        type.forEach((t) => {
            Formatters[t] = descriptor.value;
        });
    };
}

// This is more of an idiomatic typescript, but I agree that the type above this one is more readable.
// type PFormatMap<K extends SysMLType> = Partial<Record<K, Format<SysMLTypeList[K]>>>;

/**
 * Cached common formatting options
 */
const Options = {
    noSpace: Formatting.noSpace(),
    oneSpace: Formatting.oneSpace(),
    indent: Formatting.indent(),
    twoIndents: { options: {}, moves: [{ tabs: 2 }] },
    noIndent: Formatting.noIndent(),
    noLines: Formatting.newLines(0),
    newLine: Formatting.newLine(),
    twoLines: Formatting.newLines(2),
    uptoTwoLines: Formatting.fit(Formatting.newLines(1), Formatting.newLines(2)),
    uptoTwoIndents: addIndent(Formatting.fit(Formatting.newLines(1), Formatting.newLines(2)), 1),
    inline: Formatting.oneSpace(),
    spaceOrIndent: Formatting.fit(Formatting.indent(), Formatting.oneSpace()),
    spaceOrLine: Formatting.fit(Formatting.newLine(), Formatting.oneSpace()),
    noSpaceOrIndent: Formatting.fit(Formatting.indent(), Formatting.noSpace()),
    noSpaceOrLine: Formatting.fit(Formatting.indent(), Formatting.noSpace()),
    indentedOneSpace: addIndent(Formatting.oneSpace(), 1),
} satisfies Record<string, FormattingAction>;
// satisfies here so that the type checker can know if the property exists

function highPriority(action: { moves: FormattingMove[] }): FormattingAction {
    return {
        options: { priority: 100 },
        moves: action.moves,
    };
}

function addIndent(action: FormattingAction, indent: number): FormattingAction {
    if (indent === 0) return action;
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

function startsWith(node: AstNode, region: FormattingRegion): boolean {
    return region.nodes.at(0)?.offset === node.$cstNode?.offset;
}

function prependIfNotStartsWith(
    keyword: string,
    node: AstNode,
    formatter: NodeFormatter<AstNode>,
    action = Options.indent
): FormattingRegion {
    const region = formatter.keyword(keyword);
    if (!startsWith(node, region)) {
        region.prepend(action);
    }
    return region;
}

export class SysMLFormatter extends AbstractFormatter {
    /**
     * Map of AST node types to formatting functions that apply to that type
     */
    protected readonly formattings;

    constructor() {
        super();

        this.formattings = typeIndex.expandToDerivedTypes(
            Formatters as Readonly<TypeMap<SysMLTypeList, Format>>
        );
    }

    /**
     * Generic AST node formatting method that simply dispatches to the
     * registered formatting function based on node type
     * @param node AST node to format
     */
    protected format(node: AstNode): void {
        if (isProgrammaticNode(node)) return;
        const formatting = this.formattings.get(node.$type);
        if (!formatting) return;
        const formatter = this.getNodeFormatter(node);
        formatting.call(this, node, formatter);
    }

    protected indentChildren(
        node: ast.Element,
        formatter: NodeFormatter<ast.Element>,
        range?: Range
    ): CstNode[] {
        if (!node.$cstNode) return [];
        const children = findChildren(node.$cstNode, range);
        if (children.length === 0) return children;

        formatter.cst([children[0]]).prepend(Options.indent);
        children.slice(1).forEach((node, i) => {
            if (node.hidden) {
                if (node.range.start.line === node.range.end.line) {
                    // inline comment
                    formatter
                        .cst([node])
                        .prepend(
                            node.range.start.line === children[i].range.end.line
                                ? Options.oneSpace
                                : Options.uptoTwoIndents
                        );
                } else {
                    // multiline comment
                    formatter.cst([node]).prepend(Options.uptoTwoIndents);
                }
            } else {
                if (children[i].hidden || /(?:;|\}|\*\/)$/.test(children[i].text)) {
                    // previous cst is a comment or another element, indent this one
                    formatter.cst([node]).prepend(Options.uptoTwoIndents);
                } else {
                    // previous element a kind of prefix
                    formatter.cst([node]).prepend(Options.indentedOneSpace);
                }
            }
        });
        return children;
    }

    /**
     * Format the interior of a node
     */
    protected formatBody(
        node: ast.Element,
        formatter: NodeFormatter<ast.Element>,
        initial = Options.oneSpace
    ): void {
        const bracesOpen = formatter.keyword("{");

        if (bracesOpen.nodes.length === 0) {
            // if no braces were found, assume ;
            formatter.keyword(";").prepend(Options.noSpace);
        } else {
            const bracesClose = formatter.keyword("}");
            bracesOpen.prepend(initial);

            // indent all children
            const children = this.indentChildren(
                node,
                formatter,
                Range.create(bracesOpen.nodes[0].range.end, bracesClose.nodes[0].range.start)
            );
            if (children.length > 0) {
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
    @formatter(ast.Element) element(
        node: ast.Element,
        formatter: NodeFormatter<ast.Element>,
        prependNames = true
    ): void {
        if ("prefixes" in node && (node as ast.Namespace | ast.Dependency).prefixes.length > 0) {
            const prefixes = formatter.nodes(...(node as ast.Namespace | ast.Dependency).prefixes);
            const next = getNextNode(prefixes.nodes[prefixes.nodes.length - 1]);
            if (next && next.text !== ";") formatter.cst([next]).prepend(Options.spaceOrIndent);
        }

        if (node.declaredShortName && !node.$cstNode?.text.startsWith("<")) {
            const region = formatter.keyword("<");
            region.append(Options.noSpace);
            if (prependNames) region.prepend(Options.oneSpace);
            formatter.keyword(">").prepend(Options.noSpace);
        }

        if (node.declaredName && (prependNames || node.declaredShortName)) {
            const region = formatter.property("declaredName");
            if (!startsWith(node, region))
                region.prepend(node.declaredShortName ? Options.spaceOrIndent : Options.oneSpace);
        }

        this.formatBody(node, formatter);
    }

    @formatter(ast.Namespace) namespace(
        node: ast.Namespace,
        formatter: NodeFormatter<ast.Namespace>
    ): void {
        if (!node.$container) {
            // root namespace
            if (!node.$cstNode) return;
            const children = findChildren(node.$cstNode);
            if (children.length === 0) return;

            // also need to collect hidden comments prior to this since they are
            // not actually a part of namespace and won't be returned as
            // children

            const leading: CstNode[] = [children[0]];
            for (;;) {
                const previous = getPreviousNode(leading[leading.length - 1], true);
                if (!previous) break;
                leading.push(previous);
            }

            formatter.cst([leading[leading.length - 1]]).prepend(Options.noSpace);
            formatter.cst(children.slice(1)).prepend(Options.uptoTwoLines);
            formatter.cst(leading.slice(0, leading.length - 1)).prepend(Options.uptoTwoLines);
        } else {
            this.element(node, formatter);
        }
    }

    @formatter(ast.Relationship) relationship<T extends ast.Relationship>(
        node: T,
        formatter: NodeFormatter<T>,
        prefix?: { keyword: string } | { property: Properties<T> }
    ): void {
        this.element(node, formatter);
        if (node.visibility) {
            formatter.property("visibility" as Properties<T>).append(Options.oneSpace);
        }

        if (!prefix) return;
        const region =
            "keyword" in prefix
                ? formatter.keyword(prefix.keyword)
                : formatter.property(prefix.property);

        // if the prefix is also the only cst node in this element, don't add a
        // space
        if (region.nodes.length === 0) return;
        let next = getNextNode(region.nodes.at(-1) as CstNode, true);
        if (next) next = findLeafNodeAtOffset(next, next.offset);
        if (next?.text !== ";") region.append(Options.oneSpace);
    }

    @formatter(ast.StateSubactionMembership) stateSubactionMembership(
        node: ast.StateSubactionMembership,
        formatter: NodeFormatter<ast.StateSubactionMembership>
    ): void {
        this.relationship(node, formatter, { property: "kind" });
    }

    @formatter(ast.TransitionFeatureMembership) transitionFeatureMembership(
        node: ast.TransitionFeatureMembership,
        formatter: NodeFormatter<ast.TransitionFeatureMembership>
    ): void {
        this.relationship(node, formatter, { property: "kind" });
    }

    @formatter(ast.RequirementConstraintMembership) requirementConstraintMembership(
        node: ast.RequirementConstraintMembership,
        formatter: NodeFormatter<ast.RequirementConstraintMembership>
    ): void {
        this.relationship(node, formatter, { property: "kind" });
    }

    @formatter(ast.SubjectMembership) subjectMembership(
        node: ast.SubjectMembership,
        formatter: NodeFormatter<ast.SubjectMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "subject" });
    }

    @formatter(ast.ActorMembership) actorMembership(
        node: ast.ActorMembership,
        formatter: NodeFormatter<ast.ActorMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "actor" });
    }

    @formatter(ast.ReturnParameterMembership) returnParameterMembership(
        node: ast.ReturnParameterMembership,
        formatter: NodeFormatter<ast.ReturnParameterMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "return" });
    }

    @formatter(ast.StakeholderMembership) StakeholderMembership(
        node: ast.StakeholderMembership,
        formatter: NodeFormatter<ast.StakeholderMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "stakeholder" });
    }

    @formatter(ast.RequirementVerificationMembership) RequirementVerificationMembership(
        node: ast.RequirementVerificationMembership,
        formatter: NodeFormatter<ast.RequirementVerificationMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "verify" });
    }

    @formatter(ast.ObjectiveMembership) ObjectiveMembership(
        node: ast.ObjectiveMembership,
        formatter: NodeFormatter<ast.ObjectiveMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "objective" });
    }

    @formatter(ast.VariantMembership) VariantMembership(
        node: ast.VariantMembership,
        formatter: NodeFormatter<ast.VariantMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "variant" });
    }

    @formatter(ast.ViewRenderingMembership) ViewRenderingMembership(
        node: ast.ViewRenderingMembership,
        formatter: NodeFormatter<ast.ViewRenderingMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "render" });
    }

    @formatter(ast.OwningMembership) OwningMembership(
        node: ast.OwningMembership,
        formatter: NodeFormatter<ast.OwningMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "member" });
    }

    @formatter(ast.Membership) Membership(
        node: ast.Membership,
        formatter: NodeFormatter<ast.Membership>
    ): void {
        this.relationship(node, formatter, { keyword: "first" });

        formatter
            .keyword("for")
            .prepend(
                node.declaredName || node.declaredShortName ? Options.indent : Options.oneSpace
            )
            .append(Options.oneSpace);
    }

    @formatter(ast.FramedConcernMembership) FramedConcernMembership(
        node: ast.FramedConcernMembership,
        formatter: NodeFormatter<ast.FramedConcernMembership>
    ): void {
        this.relationship(node, formatter, { keyword: "frame" });
    }

    /**
     * Format {@link ast.ElementReference ElementReference}
     */
    @formatter(ast.ElementReference) reference(
        node: ast.ElementReference,
        formatter: NodeFormatter<ast.ElementReference>
    ): void {
        if (node.parts.length > 1)
            formatter.keywords("::").prepend(Options.noSpace).append(Options.noSpaceOrIndent);
    }

    @formatter(ast.ConjugatedPortReference) conjugatePortReference(
        node: ast.ConjugatedPortReference,
        formatter: NodeFormatter<ast.ConjugatedPortReference>
    ): void {
        this.reference(node, formatter);
        formatter.keyword("~").append(Options.noSpace);
    }

    /**
     * Format {@link ast.MetadataFeature MetadataFeature}
     */
    @formatter(ast.MetadataFeature) metadataFeature(
        node: ast.MetadataFeature,
        formatter: NodeFormatter<ast.MetadataFeature>,
        typed = "typed" // is different in SysML
    ): void {
        this.element(node, formatter, false);
        const isPrefix = node.$container.$containerProperty === "prefixes";
        const keyword = formatter.keyword(isPrefix ? "#" : "@");
        keyword.append(Options.noSpace);

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

    @formatter(ast.MetadataUsage) metadataUsage(
        node: ast.MetadataUsage,
        formatter: NodeFormatter<ast.MetadataUsage>
    ): void {
        formatter.keyword("metadata").append(Options.oneSpace);
        this.metadataFeature(node, formatter, "defined");
    }

    /**
     * Format {@link ast.MultiplicityRange MultiplicityRange}
     */
    @formatter(ast.MultiplicityRange) multiplicityRange(
        node: ast.MultiplicityRange,
        formatter: NodeFormatter<ast.MultiplicityRange>
    ): void {
        const open = formatter.keyword("[");
        if (!node.$cstNode?.text.startsWith("[")) {
            open.prepend(Options.oneSpace);
        }
        open.append(Options.noSpace);
        formatter.keyword("]").prepend(Options.noSpace);
        this.formatBody(node, formatter);
    }

    @formatter(ast.NullExpression) nullExpression(
        node: ast.NullExpression,
        formatter: NodeFormatter<ast.NullExpression>
    ): void {
        formatter.keyword("(").append(Options.noSpace);
    }

    @formatter(ast.Comment) comment(
        node: ast.Comment,
        formatter: NodeFormatter<ast.Comment>
    ): void {
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

    @formatter(ast.Documentation) doc(
        node: ast.Documentation,
        formatter: NodeFormatter<ast.Documentation>
    ): void {
        this.element(node, formatter);
        if (node.declaredName || node.declaredShortName)
            formatter.property("body").prepend(Options.indent);
        else formatter.property("body").prepend(Options.oneSpace);
    }

    @formatter(ast.TextualRepresentation) rep(
        node: ast.TextualRepresentation,
        formatter: NodeFormatter<ast.TextualRepresentation>
    ): void {
        this.element(node, formatter);
        prependIfNotStartsWith("language", node, formatter, Options.spaceOrIndent).append(
            Options.oneSpace
        );
        formatter.property("body").prepend(Options.indent);
    }

    @formatter(ast.Definition) definition(
        node: ast.Definition,
        formatter: NodeFormatter<ast.Definition>
    ): void {
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

    @formatter(ast.Usage) usage(node: ast.Usage, formatter: NodeFormatter<ast.Usage>): void {
        this.feature(node, formatter);

        this.usagePart(node, formatter);
    }

    @formatter(ast.Dependency) dependency(
        node: ast.Dependency,
        formatter: NodeFormatter<ast.Dependency>
    ): void {
        this.element(node, formatter);

        prependIfNotStartsWith("dependency", node, formatter, Options.spaceOrIndent);
        this.formatList(node, "client", formatter, {
            keyword: "from",
            indent: true,
        });

        this.formatList(node, "supplier", formatter, {
            keyword: "to",
            indent: true,
        });
    }

    @formatter(ast.Type) type(node: ast.Type, formatter: NodeFormatter<ast.Type>): void {
        this.element(node, formatter);

        if (node.isAbstract) {
            formatter.keyword("abstract").append(Options.oneSpace);
        }

        if (node.isSufficient) {
            formatter.keyword("all").surround(Options.oneSpace);
        }

        if (node.heritage.length > 0) {
            this.formatList(node, node.heritage, formatter, {
                keyword: [
                    "specializes",
                    ":>",
                    "subsets",
                    "redefines",
                    ":>>",
                    "references",
                    "::>",
                    ":",
                    "by",
                ].concat(ast.isUsage(node) ? ["defined"] : ["conjugates", "~", "typed"]),
            });
        }

        if (node.typeRelationships.length > 0) {
            this.formatList(node, node.typeRelationships, formatter, {
                keyword: [
                    "disjoint",
                    "from",
                    "unions",
                    "intersects",
                    "differences",
                    "inverse",
                    "of",
                    "featured",
                    "by",
                    "chains",
                ],
            });
        }

        if (node.multiplicity) {
            formatter.node(node.multiplicity).prepend(Options.oneSpace);
        }
    }

    @formatter(ast.AssociationStructure) assocStruct(
        node: ast.AssociationStructure,
        formatter: NodeFormatter<ast.AssociationStructure>
    ): void {
        this.type(node, formatter);

        formatter.keyword("assoc").append(Options.oneSpace);
    }

    @formatter(ast.Feature) feature(
        node: ast.Feature,
        formatter: NodeFormatter<ast.Feature>
    ): void {
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

        if (node.isNonunique) {
            formatter.keyword("nonunique").prepend(Options.oneSpace);
        }

        if (node.isOrdered) {
            formatter.keyword("ordered").prepend(Options.oneSpace);
        }

        // feature chainings
        formatter.keywords(".").prepend(Options.noSpace).append(Options.noSpaceOrIndent);

        if (node.value && node.$meta.owner()?.is(ast.InvocationExpression)) {
            // argument
            formatter.keyword("=").surround(Options.noSpace);
        }
    }

    @formatter(ast.FeatureValue) featureValue(
        node: ast.FeatureValue,
        formatter: NodeFormatter<ast.FeatureValue>
    ): void {
        const equal = formatter.keyword(node.isInitial ? ":=" : "=");
        if (!startsWith(node.$container, equal)) equal.prepend(Options.oneSpace);
        if (node.isDefault) {
            formatter.keyword("default").prepend(Options.oneSpace);
        }

        if (startsWith(node.$container, equal)) return;
        if (node.target && node.target.$cstNode?.offset !== node.$cstNode?.offset)
            formatter
                .node(node.target)
                .prepend(
                    addIndent(
                        equal.nodes.length > 0 || node.isDefault
                            ? Options.spaceOrLine
                            : Options.noSpace,
                        1
                    )
                );
    }

    @formatter(ast.ElementFilterMembership) elementFilter(
        node: ast.ElementFilterMembership,
        formatter: NodeFormatter<ast.ElementFilterMembership>
    ): void {
        if (node.$cstNode?.text.startsWith("[")) {
            if (node.target) {
                formatter.node(node).prepend(addIndent(Options.noSpace, 1));
                this.formatBraces(formatter, "[", "]", formatter.node(node.target));
            }
        } else {
            this.relationship(node, formatter, { keyword: "filter" });
            formatter.keyword(";").prepend(Options.noSpace);
        }
    }

    @formatter(ast.LibraryPackage) libraryPackage(
        node: ast.LibraryPackage,
        formatter: NodeFormatter<ast.LibraryPackage>
    ): void {
        this.element(node, formatter);

        if (node.isStandard) formatter.keyword("standard").append(Options.oneSpace);
        formatter.keyword("library").append(Options.oneSpace);
    }

    @formatter(ast.Multiplicity) multiplicity(
        node: ast.Multiplicity,
        formatter: NodeFormatter<ast.Multiplicity>
    ): void {
        this.element(node, formatter);

        if (node.heritage.length > 0) {
            this.formatList(node, "heritage", formatter, { keyword: ["subsets", ":>"] });
        }
    }

    @formatter(ast.Import) import(
        node: ast.Import,
        formatter: NodeFormatter<ast.Import>,
        kw = "import"
    ): void {
        this.relationship(node, formatter, { keyword: kw });
        formatter.keyword(kw).append(Options.oneSpace);
        if (node.importsAll) formatter.keyword("all").append(Options.oneSpace);
        if (node.isRecursive) formatter.keyword("::**").surround(Options.noSpace);
    }

    @formatter(ast.NamespaceImport) namespaceImport(
        node: ast.NamespaceImport,
        formatter: NodeFormatter<ast.NamespaceImport>,
        kw = "import"
    ): void {
        this.import(node, formatter, kw);
        formatter.keywords("::*").surround(Options.noSpace);
    }

    @formatter(ast.MembershipExpose) MembershipExpose(
        node: ast.MembershipExpose,
        formatter: NodeFormatter<ast.MembershipExpose>
    ): void {
        this.import(node, formatter, "expose");
    }

    @formatter(ast.NamespaceExpose) NamespaceExpose(
        node: ast.NamespaceExpose,
        formatter: NodeFormatter<ast.NamespaceExpose>
    ): void {
        this.namespaceImport(node, formatter, "expose");
    }

    protected typeRelationship(
        node: ast.Relationship,
        formatter: NodeFormatter<ast.Relationship>,
        keyword = "specialization"
    ): void {
        const declaration = node.$container.$meta.is(ast.Type);
        if (declaration) return;
        this.relationship(node, formatter, { keyword });

        if (node.declaredName) {
            formatter.property("declaredName").append(Options.spaceOrIndent);
        } else if (node.declaredShortName) {
            formatter.keyword(">").append(Options.spaceOrIndent);
        }

        const source = node.sourceRef ?? node.sourceChain;
        if (source) formatter.node(source).prepend(Options.oneSpace).append(Options.spaceOrIndent);

        const target = node.targetRef ?? node.targetChain;
        if (target) formatter.node(target).prepend(Options.oneSpace);
    }

    @formatter(ast.Specialization) specialization<T extends ast.Specialization | ast.Conjugation>(
        node: T,
        formatter: NodeFormatter<T>,
        keyword = "specialization"
    ): void {
        this.typeRelationship(node, formatter, keyword);
    }

    @formatter(ast.FeatureTyping) featureTyping(
        node: ast.FeatureTyping,
        formatter: NodeFormatter<ast.FeatureTyping>
    ): void {
        this.typeRelationship(node, formatter);
        formatter.keyword("typed").append(Options.oneSpace);
    }

    @formatter(ast.ConjugatedPortTyping) conjugatedPortTyping(
        node: ast.ConjugatedPortTyping,
        formatter: NodeFormatter<ast.ConjugatedPortTyping>
    ): void {
        this.typeRelationship(node, formatter);
        formatter.keyword("~").append(Options.noSpace);
    }

    @formatter(ast.Conjugation) conjugation(
        node: ast.Conjugation,
        formatter: NodeFormatter<ast.Conjugation>
    ): void {
        this.typeRelationship(node, formatter, "conjugation");
    }

    @formatter(ast.Disjoining) disjoining(
        node: ast.Disjoining,
        formatter: NodeFormatter<ast.Disjoining>
    ): void {
        this.typeRelationship(node, formatter, "disjoining");
    }

    @formatter(ast.FeatureInverting) featureInverting(
        node: ast.FeatureInverting,
        formatter: NodeFormatter<ast.FeatureInverting>
    ): void {
        this.typeRelationship(node, formatter, "inverting");
    }

    @formatter(ast.TypeFeaturing) typeFeaturing(
        node: ast.TypeFeaturing,
        formatter: NodeFormatter<ast.TypeFeaturing>
    ): void {
        this.typeRelationship(node, formatter, "featuring");
    }

    @formatter(ast.Unioning) unioning(
        node: ast.Unioning,
        formatter: NodeFormatter<ast.Unioning>
    ): void {
        this.typeRelationship(node, formatter, "unioning");
    }

    @formatter(ast.Intersecting) intersecting(
        node: ast.Intersecting,
        formatter: NodeFormatter<ast.Intersecting>
    ): void {
        this.typeRelationship(node, formatter, "intersecting");
    }

    @formatter(ast.Differencing) differencing(
        node: ast.Differencing,
        formatter: NodeFormatter<ast.Differencing>
    ): void {
        this.typeRelationship(node, formatter, "differencing");
    }

    @formatter(ast.Connector) connector(
        node: ast.Connector,
        formatter: NodeFormatter<ast.Connector>,
        keywords: [string, string] = ["from", "to"]
    ): void {
        this.feature(node, formatter);

        const ends = node.ends;
        const braceOpen = formatter.keyword("(");
        if (braceOpen.nodes.length === 0) {
            // binary
            const from = formatter.keyword(keywords[0]);
            if (from.nodes.length === 0) {
                if (ends.length > 0) formatter.node(ends[0]).prepend(Options.indent);
            } else {
                if (!startsWith(node, from)) from.prepend(Options.indent);
                from.append(Options.oneSpace);
            }
            formatter.keyword(keywords[1]).prepend(Options.indent).append(Options.oneSpace);
            formatter.nodes(...ends).prepend(highPriority(Options.oneSpace));
        } else {
            // nary
            braceOpen.prepend(Options.oneSpace);
            formatter.keyword(")").prepend(Options.indent);
            this.formatList(node, ends, formatter, {
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
        const bind = formatter.keyword(binder);
        if (first.nodes.length === 0 && bind.nodes.length === 0) return;
        let start = 0;
        if (first.nodes.length > 0) {
            if (!startsWith(node, first)) first.prepend(Options.spaceOrIndent);
            first.append(Options.oneSpace);
        } else {
            formatter.node(ends[0]).prepend(highPriority(Options.spaceOrIndent));
            start = 1;
        }
        bind.prepend(Options.spaceOrIndent).append(Options.oneSpace);
        formatter.nodes(...ends.slice(start)).prepend(highPriority(Options.oneSpace));
    }

    @formatter(ast.BindingConnector) bindingConnector(
        node: ast.BindingConnector,
        formatter: NodeFormatter<ast.BindingConnector>
    ): void {
        this.formatBinding(node, formatter, node.ends, "of", "=");
    }

    @formatter(ast.BindingConnectorAsUsage) bindingConnectorAsUsage(
        node: ast.BindingConnectorAsUsage,
        formatter: NodeFormatter<ast.BindingConnectorAsUsage>
    ): void {
        this.formatBinding(node, formatter, node.ends, "bind", "=");
    }

    @formatter(ast.Succession) succession(
        node: ast.Succession,
        formatter: NodeFormatter<ast.Succession>
    ): void {
        this.formatBinding(node, formatter, node.ends, "first", "then");
    }

    @formatter(ast.ItemFlow) itemFlow(
        node: ast.ItemFlow,
        formatter: NodeFormatter<ast.ItemFlow>,
        keyword = /flow/,
        ends: AstNode[] = node.ends
    ): void {
        this.formatBinding(node, formatter, ends, "from", "to");

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

    @formatter(ast.SuccessionItemFlow) successionFlow(
        node: ast.SuccessionItemFlow,
        formatter: NodeFormatter<ast.SuccessionItemFlow>
    ): void {
        this.itemFlow(node, formatter);

        formatter.keyword("succession").append(Options.oneSpace);
    }

    @formatter(ast.Invariant) invariant(
        node: ast.Invariant,
        formatter: NodeFormatter<ast.Invariant>
    ): void {
        this.feature(node, formatter);

        formatter.keyword(node.isNegated ? "false" : "true").prepend(Options.oneSpace);
    }

    @formatter(ast.Expression) expression(
        node: ast.Expression,
        formatter: NodeFormatter<ast.Expression>
    ): void {
        if (!node.$cstNode?.text.startsWith("{")) {
            this.feature(node, formatter);
        } else {
            // expression body
            formatter
                .keyword("{")
                .prepend(
                    node.$cstNode &&
                        getPreviousNode(node.$cstNode)?.element.$meta?.is(ast.FeatureValue)
                        ? Options.oneSpace
                        : Options.noSpace
                );
            formatter
                .keyword("}")
                .prepend(node.$children.length > 0 ? Options.newLine : Options.noSpace);
            this.indentChildren(node, formatter);
        }

        if (node.result && node.result.$cstNode?.offset !== node.$cstNode?.offset) {
            formatter.node(node.result).prepend(Options.indent);
        }
    }

    @formatter(ast.LiteralExpression) literalExpression(): void {
        /* no formatting required */
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

    @formatter(ast.OperatorExpression) operatorExpression(
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
                this.formatBraces(formatter, "[", "]", formatter.node(node.operands[1])).prepend(
                    Options.oneSpace
                );
                break;
            }

            case "#": {
                operator.prepend(Options.noSpace);
                this.formatBraces(formatter, "(", ")", formatter.node(node.operands[1])).prepend(
                    Options.noSpace
                );
                break;
            }

            case "@": {
                const selfRef = isProgrammaticNode(node.operands[0]);
                const op = formatter.keyword("@");
                op.append(selfRef ? Options.noSpace : Options.oneSpace);
                if (!selfRef) op.prepend(Options.spaceOrLine);
                break;
            }

            default: {
                if (!node.operator) break;
                if (node.operands.length + node.children.length <= 1) {
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

        const arrow = formatter.keyword("->");
        if (arrow.nodes.length > 0) {
            arrow.prepend(Options.noSpaceOrIndent).append(Options.noSpace);
            const type = formatter.property("heritage");
            type.append(
                // braces should be formatted with no space
                /\{|\(/.test(getNextNode(type.nodes[0])?.text ?? "")
                    ? Options.noSpace
                    : Options.spaceOrIndent
            );
            this.formatArgList(node, formatter);
        }
    }

    @formatter(ast.MetadataAccessExpression) metadataAccessExpression(
        node: ast.MetadataAccessExpression,
        formatter: NodeFormatter<ast.MetadataAccessExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        const dot = formatter.keyword(".");
        if (dot.nodes.length === 0) return;
        dot.prepend(Options.noSpace).append(Options.noSpace);
    }

    protected formatArgList(
        node: ast.InvocationExpression,
        formatter: NodeFormatter<ast.InvocationExpression>
    ): void {
        const braces = formatter.keyword("(", 1);

        if (braces.nodes.length > 0) {
            // arg list
            braces.prepend(Options.noSpace);
            const closing = formatter.keyword(")", 0);
            if (node.children.length > 0) {
                if ((node.children[0].target as ast.Feature).heritage.length > 0) {
                    // named arguments
                    this.formatList(node, node.children, formatter, {
                        initial: Options.newLine,
                        next: Options.newLine,
                    });
                    closing.prepend(Options.newLine);
                } else {
                    const inline = linesDiff(braces.nodes[0], closing.nodes[0]) === 0;

                    this.formatList(node, node.children, formatter, {
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
    }

    @formatter(ast.InvocationExpression) invocationExpression(
        node: ast.InvocationExpression,
        formatter: NodeFormatter<ast.InvocationExpression>
    ): void {
        if (node.$cstNode?.text.startsWith("(")) {
            this.formatBraces(formatter, "(", ")");
        }

        this.formatArgList(node, formatter);
    }

    @formatter(ast.FeatureChainExpression) featureChainExpression(
        node: ast.FeatureChainExpression,
        formatter: NodeFormatter<ast.FeatureChainExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        formatter.keyword(".").prepend(Options.noSpace).append(Options.noSpaceOrIndent);
    }

    @formatter(ast.CollectExpression) collectExpression(
        node: ast.CollectExpression,
        formatter: NodeFormatter<ast.CollectExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        formatter.keyword(".").prepend(Options.noSpace).append(Options.noSpace);
    }

    @formatter(ast.SelectExpression) selectExpression(
        node: ast.SelectExpression,
        formatter: NodeFormatter<ast.SelectExpression>
    ): void {
        this.formatBraces(formatter, "(", ")");

        formatter.keyword(".?").prepend(Options.noSpace).append(Options.noSpace);
    }

    @formatter(ast.OccurrenceDefinition) occurrenceDefinition(
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
    }

    @formatter(ast.OccurrenceUsage) occurrenceUsage(
        node: ast.OccurrenceUsage,
        formatter: NodeFormatter<ast.OccurrenceUsage>
    ): void {
        this.feature(node, formatter);
        this.occurrenceUsagePart(node, formatter);
    }

    @formatter(ast.EventOccurrenceUsage) eventOccurrenceUsage(
        node: ast.EventOccurrenceUsage,
        formatter: NodeFormatter<ast.EventOccurrenceUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
        const kw = formatter.keyword("occurrence");
        if (kw.nodes.length > 0) kw.prepend(Options.oneSpace);
        else if (node.typeRelationships.length > 0) {
            // references is the first sub element without 'occurrence', format
            // it on the same line
            formatter.node(node.typeRelationships[0]).prepend(Options.oneSpace);
        }
    }

    @formatter(ast.ConnectionUsage) connectionUsage(
        node: ast.ConnectionUsage,
        formatter: NodeFormatter<ast.ConnectionUsage>
    ): void {
        this.connector(node, formatter, ["connect", "to"]);
        this.occurrenceUsagePart(node, formatter);

        const connection = formatter.keyword("connection");
        if (connection.nodes.length > 0) connection.append(Options.oneSpace);
        else {
            // don't add space if connection already starts with `connect`
            prependIfNotStartsWith("connect", node, formatter, Options.oneSpace);
        }
    }

    @formatter(ast.InterfaceUsage) interfaceUsage(
        node: ast.InterfaceUsage,
        formatter: NodeFormatter<ast.InterfaceUsage>
    ): void {
        this.connector(node, formatter, ["connect", "to"]);
        this.occurrenceUsagePart(node, formatter);
        formatter.keyword("interface").append(Options.oneSpace);
    }

    @formatter(ast.AllocationUsage) allocationUsage(
        node: ast.AllocationUsage,
        formatter: NodeFormatter<ast.AllocationUsage>
    ): void {
        this.connector(node, formatter, ["allocate", "to"]);
        this.occurrenceUsagePart(node, formatter);
        formatter.keyword("allocation").append(Options.oneSpace);
    }

    @formatter(ast.FlowConnectionUsage) flowConnectionUsage(
        node: ast.FlowConnectionUsage,
        formatter: NodeFormatter<ast.FlowConnectionUsage>
    ): void {
        this.itemFlow(
            node,
            formatter,
            /message|flow/,
            node.messages.length > 0 ? node.messages : node.ends
        );
        this.occurrenceUsagePart(node, formatter);
    }

    @formatter(ast.SuccessionFlowConnectionUsage) successionFlowConnectionUsage(
        node: ast.SuccessionFlowConnectionUsage,
        formatter: NodeFormatter<ast.SuccessionFlowConnectionUsage>
    ): void {
        this.flowConnectionUsage(node, formatter);
        formatter.keyword("succession").append(Options.oneSpace);
    }

    @formatter(ast.PerformActionUsage) performActionUsage(
        node: ast.PerformActionUsage,
        formatter: NodeFormatter<ast.PerformActionUsage>
    ): void {
        this.actionUsage(node, formatter);
        formatter.keyword("perform").append(Options.oneSpace);
    }

    @formatter(ast.AcceptActionUsage) acceptActionUsage(
        node: ast.AcceptActionUsage,
        formatter: NodeFormatter<ast.AcceptActionUsage>
    ): void {
        this.actionUsage(node, formatter);

        prependIfNotStartsWith("accept", node, formatter).append(Options.oneSpace);
        formatter.keyword("via").prepend(Options.indent).append(Options.oneSpace);
    }

    @formatter(ast.TriggerInvocationExpression) triggerInvocationExpression(
        node: ast.TriggerInvocationExpression,
        formatter: NodeFormatter<ast.TriggerInvocationExpression>
    ): void {
        const kind = formatter.property("kind");
        kind.append(Options.oneSpace);
        // expression -> feature value -> owner
        if (!startsWith(node.$container.$container, kind)) {
            kind.prepend(Options.oneSpace);
        }
    }

    @formatter(ast.SendActionUsage) sendActionUsage(
        node: ast.SendActionUsage,
        formatter: NodeFormatter<ast.SendActionUsage>
    ): void {
        this.actionUsage(node, formatter);
        prependIfNotStartsWith("send", node, formatter).append(Options.oneSpace);
        if (node.sender) {
            formatter.keyword("via").prepend(Options.indent).append(Options.oneSpace);
        }
        if (node.receiver) {
            formatter.keyword("to").prepend(Options.indent).append(Options.oneSpace);
        }
    }

    @formatter(ast.AssignmentActionUsage) assignmentActionUsage(
        node: ast.AssignmentActionUsage,
        formatter: NodeFormatter<ast.AssignmentActionUsage>
    ): void {
        this.actionUsage(node, formatter);
        this.formatBinding(
            node,
            formatter,
            [node.targetMember, node.assignedValue],
            "assign",
            ":="
        );
    }

    protected formatControlFlow(
        node: ast.Namespace,
        formatter: NodeFormatter<ast.Element>,
        children: AstNode[],
        ...keywords: string[]
    ): void {
        const kw = stream(keywords)
            .map((k) => formatter.keyword(k))
            .find((r) => r.nodes.length > 0);
        if (!kw) return;

        // if the node including its parent starts with the keyword, don't add
        // additional indents
        const startsKw = startsWith(node.$container, kw);
        if (!startsKw) kw.prepend(Options.indent);

        formatter
            .nodes(...children)
            .prepend(startsKw ? Options.oneSpace : Options.indentedOneSpace);
    }

    @formatter(ast.IfActionUsage) ifActionUsage(
        node: ast.IfActionUsage,
        formatter: NodeFormatter<ast.IfActionUsage>
    ): void {
        this.usage(node, formatter);

        this.formatControlFlow(
            node,
            formatter,
            [node.condition, node.then, node.else].filter(NonNullable),
            "if"
        );
        if (node.else) formatter.keyword("else").prepend(Options.oneSpace);
    }

    @formatter(ast.WhileLoopActionUsage) whileLoopActionUsage(
        node: ast.WhileLoopActionUsage,
        formatter: NodeFormatter<ast.WhileLoopActionUsage>
    ): void {
        this.usage(node, formatter);

        this.formatControlFlow(
            node,
            formatter,
            [node.condition, node.body, node.until].filter(NonNullable),
            "while",
            "loop"
        );
        if (node.until) formatter.keyword("until").prepend(Options.oneSpace);
    }

    @formatter(ast.ForLoopActionUsage) forLoopActionUsage(
        node: ast.ForLoopActionUsage,
        formatter: NodeFormatter<ast.ForLoopActionUsage>
    ): void {
        this.usage(node, formatter);

        this.formatControlFlow(node, formatter, [node.variable, node.sequence, node.body], "for");
        formatter.keyword("in").prepend(Options.spaceOrIndent);
    }

    @formatter(ast.SuccessionAsUsage) successionAsUsage(
        node: ast.SuccessionAsUsage,
        formatter: NodeFormatter<ast.SuccessionAsUsage>
    ): void {
        if (node.$cstNode?.text.startsWith("then")) {
            formatter.node(node).prepend(Options.uptoTwoIndents);
            const members = node.ends.filter((m) => !isProgrammaticNode(m));
            if (members.length === 0) return;
            formatter.node(members[0]).prepend(Options.oneSpace);
            if (members.length === 1) return;
            formatter.node(members[1]).prepend(Options.spaceOrIndent);
            return;
        }
        this.usagePart(node, formatter);
        this.succession(node, formatter);
    }

    @formatter(ast.TransitionUsage) transitionUsage(
        node: ast.TransitionUsage,
        formatter: NodeFormatter<ast.TransitionUsage>
    ): void {
        this.occurrenceUsage(node, formatter);

        const formatProp = (kw: string): void => {
            const kwRegion = formatter.keyword(kw);
            if (kwRegion.nodes.length === 0) return;
            const child = getNextNode(kwRegion.nodes[0], false)?.element;
            if (!child) return;
            if (!startsWith(node, kwRegion)) kwRegion.prepend(Options.indent);
            formatter.node(child).prepend(highPriority(addIndent(Options.oneSpace, 1)));
        };

        formatProp("first");
        formatProp("then");
        formatProp("else");

        formatter
            .nodes(
                ...[node.accepter, node.guard, node.effect]
                    .filter(NonNullable)
                    .filter((m) => m.$cstNode?.offset !== node.$cstNode?.offset)
            )
            .prepend(Options.indent);

        // indent the member after guard transition member ('if')
        const index = node.guard?.$childIndex;
        if (index === undefined || index < 0 || index >= node.$children.length) return;
        formatter.node(node.$children[index + 1]).prepend(Options.twoIndents);
    }

    @formatter(ast.ActionUsage) actionUsage(
        node: ast.ActionUsage,
        formatter: NodeFormatter<ast.ActionUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
    }

    @formatter(ast.AssertConstraintUsage) assertConstraintUsage(
        node: ast.AssertConstraintUsage,
        formatter: NodeFormatter<ast.AssertConstraintUsage>
    ): void {
        this.occurrenceUsage(node, formatter);

        formatter.keyword("assert").append(Options.oneSpace);
        formatter.keyword("not").append(Options.oneSpace);
    }

    @formatter(ast.ReferenceUsage) referenceUsage(
        node: ast.ReferenceUsage,
        formatter: NodeFormatter<ast.ReferenceUsage>
    ): void {
        this.usage(node, formatter);
    }

    @formatter(ast.ConstraintUsage) constraintUsage(
        node: ast.ConstraintUsage,
        formatter: NodeFormatter<ast.ConstraintUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
    }

    @formatter(ast.ConcernUsage) concernUsage(
        node: ast.ConcernUsage,
        formatter: NodeFormatter<ast.ConcernUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
    }

    @formatter(ast.PartUsage) partUsage(
        node: ast.PartUsage,
        formatter: NodeFormatter<ast.PartUsage>
    ): void {
        this.occurrenceUsage(node, formatter);
    }

    @formatter(ast.SatisfyRequirementUsage) satisfyRequirementsUsage(
        node: ast.SatisfyRequirementUsage,
        formatter: NodeFormatter<ast.SatisfyRequirementUsage>
    ): void {
        this.assertConstraintUsage(node, formatter);
        formatter.keyword("satisfy").append(Options.oneSpace);
        formatter.keyword("by").prepend(Options.indent).append(addIndent(Options.oneSpace, 1));
    }

    @formatter(ast.RequirementUsage) requirementUsage(
        node: ast.RequirementUsage,
        formatter: NodeFormatter<ast.RequirementUsage>
    ): void {
        this.constraintUsage(node, formatter);
    }

    @formatter(ast.UseCaseUsage) useCaseUsage(
        node: ast.UseCaseUsage,
        formatter: NodeFormatter<ast.UseCaseUsage>
    ): void {
        this.occurrenceUsage(node, formatter);

        formatter.keyword("use").append(Options.oneSpace);
    }

    @formatter(ast.UseCaseDefinition) useCaseDefinition(
        node: ast.UseCaseDefinition,
        formatter: NodeFormatter<ast.UseCaseDefinition>
    ): void {
        this.occurrenceDefinition(node, formatter);

        formatter.keyword("use").append(Options.oneSpace);
    }

    @formatter(ast.IncludeUseCaseUsage) includeUseCaseUsage(
        node: ast.IncludeUseCaseUsage,
        formatter: NodeFormatter<ast.IncludeUseCaseUsage>
    ): void {
        this.useCaseUsage(node, formatter);

        formatter.keyword("include").append(Options.oneSpace);
    }

    protected indentSuccessionMembers(
        node: ast.Namespace,
        formatter: NodeFormatter<ast.Namespace>,
        type: SysMLType
    ): void {
        const owner = node.$container.$container;
        let index = node.$container.$childIndex;
        const previous = (owner.$children.at(index - 1) as ast.Relationship).$meta.element();
        if (!previous?.is(ast.SuccessionAsUsage)) return;

        const getNext = (): ast.Element | undefined => {
            return (owner.$children.at(++index) as ast.Relationship)?.$meta.element()?.ast();
        };

        for (;;) {
            let next = getNext();
            if (!next?.$meta.is(type)) return;
            formatter.node(next).prepend(highPriority(Options.twoIndents));

            // While the current AST node is an empty succession, skip the next
            // node since they would be formatted right after the empty
            // succession, no indentation needed. An empty succession doesn't
            // end in either ';' or '}'
            while (next?.$cstNode && !/(\}|;)$/.test(next.$cstNode.text)) {
                next = getNext();
            }
        }
    }

    @formatter(ast.ForkNode) forkNode(
        node: ast.ForkNode,
        formatter: NodeFormatter<ast.ForkNode>
    ): void {
        this.actionUsage(node, formatter);

        // indent all following successions to show more clearly that they can
        // be executed in parallel
        this.indentSuccessionMembers(node, formatter, ast.SuccessionAsUsage);
    }

    @formatter(ast.DecisionNode) decisionNode(
        node: ast.DecisionNode,
        formatter: NodeFormatter<ast.DecisionNode>
    ): void {
        this.actionUsage(node, formatter);

        // indent all following transitions to show more clearly that they are
        // dependent on this decision
        this.indentSuccessionMembers(node, formatter, ast.TransitionUsage);
    }

    protected override isNecessary(): boolean {
        // preserve all edits so that overlapping edits can be properly resolved
        // irrespective of the existing document formatting
        return true;
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

        const text = document.textDocument;
        return (
            super
                .doDocumentFormat(document, options, range)
                // filter out edits matching the document since we have preserved
                // some in `isNecessary`
                .filter((edit) => super.isNecessary(edit, text))
        );
    }

    protected override iterateAstFormatting(document: LangiumDocument, range?: Range): void {
        const root = document.parseResult.value;
        this.format(root);
        const treeIterator = streamAllContents(root).iterator();
        let result: IteratorResult<AstNode>;
        do {
            result = treeIterator.next();
            if (!result.done) {
                const node = result.value;
                // Langium assumes programmatic AST nodes don't exist...
                const current = node.$cstNode?.range;
                if (!current) continue;
                const inside = this.insideRange(current, range);
                if (inside) {
                    this.format(node);
                } else {
                    treeIterator.prune();
                }
            }
        } while (!result.done);
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
            // looks like b.element may not actually refer to the comment, use
            // leaf node instead
            const comment = findLeafNodeAtOffset(b, b.offset);
            if (!comment) return edits;
            const edit = this.rewriteMultilineCommentBody(comment, a, context);
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
        let element: TextualAnnotatingMeta;
        if (!ast.isTextualAnnotatingElement(node.element)) {
            // i.e. the text document is a single comment body
            /* istanbul ignore next (safe-guard and type hint) */
            if (!ast.isNamespace(node.element)) return;
            element = node.element.$meta.comments[0];
        } else {
            element = node.element.$meta;
        }

        const body = element.body;
        let offset = 0;

        if (element.is(ast.Documentation)) {
            if (previous?.text === "doc") {
                // body is on the same line as `doc`
                offset = 4; // offset for "doc "
            }
        } else if (element.is(ast.Comment)) {
            if (previous?.text === "comment") {
                // body is on the same line as `comment`
                offset = 8; // offset for "comment "
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
        let owner = node?.element;
        if (ast.isElementReference(owner)) owner = owner.$container;
        while (owner?.$cstNode?.text === node?.text) {
            owner = owner?.$container;
        }
        return owner;
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
        property: K | AstNode[],
        formatter: NodeFormatter<AstNode>,
        options?:
            | { keyword: string | string[]; indent?: boolean }
            | { initial?: FormattingAction; next?: FormattingAction }
    ): void {
        const commas = formatter.keywords(",");
        commas.prepend(Options.noSpace);
        const items = Array.isArray(property) ? property : (node[property] as AstNode[]);
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

                    // keywords may not be ordered so have to check all
                    // nodes if one starts at the node offset
                    const offset = node.$cstNode?.offset;
                    const index =
                        offset === undefined
                            ? undefined
                            : kw.nodes.findIndex((cst) => cst.offset === offset);
                    if (index !== undefined && index >= 0) {
                        // don't need to prepend anything if the element starts with
                        // a keyword already
                        const nodes = [...kw.nodes.slice(0, index), ...kw.nodes.slice(index + 1)];
                        formatter.cst(nodes).prepend(action);
                    } else {
                        kw.prepend(action);
                    }
                    initial = Options.oneSpace;
                    next = Options.spaceOrIndent;
                } else if (commas.nodes.length === 0) {
                    // not a list
                    return;
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
                if (startsWith(node, region)) {
                    region.prepend(addIndent(Options.noSpace, 1));
                } else if (item.$cstNode?.offset !== node.$cstNode?.offset) {
                    // only prepend if the list doesn't start at the same position as the owning node
                    region.prepend(initial);
                } else {
                    region.prepend(Options.spaceOrIndent);
                }
                return;
            }
            // handle repeated keywords
            const previous = getPreviousNode(region.nodes[0], false);
            if (previous?.text === ".") {
                region.prepend(Options.noSpaceOrIndent);
            } else {
                region.prepend(previous?.text === "," ? next : initial);
            }
        });
    }

    protected getIndent(indentation: number, options: FormattingOptions): string {
        const single = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
        return single.repeat(indentation);
    }
}
