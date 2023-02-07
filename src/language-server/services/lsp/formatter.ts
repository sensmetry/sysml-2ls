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
    getDocument,
    getNextNode,
    LangiumDocument,
    NodeFormatter,
} from "langium";
import { typeIndex, TypeMap } from "../../model";
import * as ast from "../../generated/ast";
import { SysMLType } from "../sysml-ast-reflection";
import { FormattingOptions, Range, TextEdit } from "vscode-languageserver";

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
                const start = node.$cstNode?.offset;
                const isFirst = start === node.$container.$cstNode?.offset;
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
}
