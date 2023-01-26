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
    findCommentNode,
    Formatting,
    NodeFormatter,
} from "langium";
import { typeIndex, TypeMap } from "../../model";
import * as ast from "../../generated/ast";
import { SysMLType } from "../sysml-ast-reflection";

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
} as const;

const COMMENT_RULES = ["SL_NOTE", "ML_NOTE"];

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
            MetadataFeature: this.metadataFeature,
            MultiplicityRange: this.multiplicityRange,
            InterfaceDefinition: this.element,
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
    protected formatPrepend(node: ast.Element, formatter: NodeFormatter<ast.Element>): void {
        const depth = !node.$container ? 0 : !node.$container.$container ? 1 : 2;
        const region = formatter.node(node);

        switch (depth) {
            case 1: {
                // elements inside root namespace
                const isFirst = node.$cstNode?.offset === node.$container.$cstNode?.offset;
                const isLast = node.$cstNode?.end === node.$container.$cstNode?.end;
                if (isFirst) {
                    region.prepend(Options.noSpace);
                }
                // TODO: add trailing new line, the following doesn't work
                // if (isLast) {
                //     region.append(Options.newLine);
                // }
                if (!isFirst && !isLast) {
                    region.prepend(Options.noIndent);
                }

                break;
            }
            case 2: {
                // nested elements
                const isFirst = node.$cstNode?.offset === node.$cstNode?.parent?.offset;
                const isLast = node.$cstNode?.end === node.$cstNode?.parent?.end;

                if (isFirst) {
                    region.prepend(Options.newLine);
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
    protected formatBody(formatter: NodeFormatter<ast.Element>): void {
        const bracesOpen = formatter.keyword("{");

        if (bracesOpen.nodes.length === 0) {
            // if no braces were found, assume ;
            formatter.keyword(";").prepend(Options.noSpace);
        } else {
            const bracesClose = formatter.keyword("}");
            bracesOpen.prepend(Options.oneSpace);

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
     */
    protected element(
        node: ast.Element,
        formatter: NodeFormatter<ast.Element>,
        prepend = true
    ): void {
        if (prepend) this.formatPrepend(node, formatter);

        // TODO: enable when it works
        // this.formatRelatedComments(node.$cstNode, formatter);
        this.formatBody(formatter);
    }

    /**
     * Format {@link ast.ElementReference ElementReference}
     */
    protected reference(
        _: ast.ElementReference,
        formatter: NodeFormatter<ast.ElementReference>
    ): void {
        // TODO: split long references onto multiple lines
        formatter.keywords("::").surround(Options.noSpace);
        formatter.keywords(".").surround(Options.noSpace);
    }

    /**
     * Format {@link ast.MetadataFeature MetadataFeature}
     */
    protected metadataFeature(
        node: ast.MetadataFeature,
        formatter: NodeFormatter<ast.MetadataFeature>
    ): void {
        const isPrefix = node.$containerProperty === "prefixes";
        const keyword = isPrefix ? "#" : "@";
        formatter.keyword(keyword).append(Options.noSpace);
        this.element(node, formatter, !isPrefix);
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

    /**
     * Format comments preceding {@link node} removing extraneous empty lines
     * TODO: doesn't work
     * @param node CST node to look for related comments
     * @param formatter generic formatter
     */
    protected formatRelatedComments(
        node: CstNode | undefined,
        formatter: NodeFormatter<AstNode>
    ): void {
        const nodes: CstNode[] = [];
        for (;;) {
            node = findCommentNode(node, COMMENT_RULES);
            if (!node) break;
            nodes.push(node);
        }

        // TODO: leave only up to 1 empty line before a comment, somehow cst
        // formatting doesn't work
        formatter.cst(nodes).prepend(Options.uptoTwoLines);
    }
}
