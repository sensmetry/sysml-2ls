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

import { findNodeForKeyword } from "langium";
import { FeatureMembership, FeatureTyping, Redefinition } from "../../generated/ast";
import {
    Doc,
    text,
    literals,
    printInnerComments,
    hardline,
    line,
    indent,
    group,
    join,
    literalline,
    markAsRoot,
    keyword,
    getPreviousNode,
} from "../../utils";
import {
    AnnotationMeta,
    CommentMeta,
    DocumentationMeta,
    FeatureMembershipMeta,
    MetadataFeatureMeta,
    TextualRepresentationMeta,
} from "../KerML";
import { SysMLSemanticTokenTypes } from "../semantic-tokens";
import { printTarget } from "./edges";
import { printChildrenBlock, printDeclaredRelationships } from "./namespaces";
import {
    ElementPrinter,
    ModelPrinterContext,
    DefaultElementPrinter,
    printModelElement,
} from "./print";
import { formatPreserved, printIdentifiers, throwError } from "./utils";

/**
 * Returns pretty-printed annotating element body
 */
function printBody(body: string, preserveTrailingWhitespace: boolean): Doc {
    const linebreak = preserveTrailingWhitespace ? literalline : hardline;

    // need to use `markAsRoot` to get correct indentation with
    // `literalline`
    return markAsRoot([
        text("/*", { type: SysMLSemanticTokenTypes.annotationBody }),
        linebreak,
        body.split("\n").map((line) => {
            if (line.length === 0) {
                return [text(" *", { type: SysMLSemanticTokenTypes.annotationBody }), linebreak];
            }
            return [
                text(" * ", { type: SysMLSemanticTokenTypes.annotationBody }),
                text(line, { type: SysMLSemanticTokenTypes.annotationBody }),
                linebreak,
            ];
        }),
        text(" */", { type: SysMLSemanticTokenTypes.annotationBody }),
    ]);
}

/**
 * Returns a fully formatted `about` list with a leading line break.
 */
function printAbout(
    about: readonly AnnotationMeta[],
    context: ModelPrinterContext,
    mustBreak = false
): Doc[] {
    if (about.length === 0) return [];

    return [
        indent(mustBreak || context.format.comment_about_break === "always" ? hardline : line),
        group(
            indent([
                keyword("about"),
                indent([
                    line,
                    ...join(
                        [literals.comma, line],
                        about.map((a) => printTarget(a, context))
                    ),
                ]),
            ])
        ),
    ];
}

/**
 * Default printer for comment elements.
 */
export function printCommentElement(node: CommentMeta, context: ModelPrinterContext): Doc {
    const parts: Doc[] = [];
    const { comment_keyword, markdown_comments } = context.format;
    const about = node.annotations().filter((a) => !a.isImplied);
    const identifiers = printIdentifiers(node, context, { leading: literals.space });
    const cst = node.cst()?.text;
    if (
        comment_keyword.default === "always" ||
        (comment_keyword.default === "preserve" &&
            ((!cst && comment_keyword.fallback === "always") || cst?.startsWith("comment"))) ||
        identifiers.length > 0 ||
        about.length > 0
    ) {
        parts.push(keyword("comment"), indent(identifiers));
    }

    let mustBreak = false;
    const innerNotes = printInnerComments(node.notes, { ...context, indent: true }, (note) => {
        mustBreak = note.kind === "line";
        return undefined;
    });
    if (innerNotes !== literals.emptytext) {
        parts.push(literals.space, innerNotes);
    }

    parts.push(...printAbout(about, context, mustBreak));

    return [
        group(parts),
        parts.length > 0 ? hardline : literals.emptytext,
        printBody(node.body, markdown_comments),
    ];
}
/**
 * Default printer for documentation.
 */
export function printDocumentation(node: DocumentationMeta, context: ModelPrinterContext): Doc {
    const parts: Doc[] = [
        keyword("doc"),
        indent(printIdentifiers(node, context, { leading: literals.space })),
    ];

    const inner = printInnerComments(node.notes, { ...context, indent: true });
    if (inner !== literals.emptytext) {
        parts.push(line, inner);
    }

    return [group(parts), hardline, printBody(node.body, context.format.markdown_comments)];
}

/**
 * Default printer for textual representation. Currently prints bodies as is but
 * eventually it should format bodies based on language as well.
 */
export function printTextualRepresentation(
    node: TextualRepresentationMeta,
    context: ModelPrinterContext
): Doc {
    const parts: Doc[] = [];
    const { textual_representation_keyword, textual_representation_language_break } =
        context.format;

    const identifiers = printIdentifiers(node, context, { leading: literals.space });
    const cst = node.cst()?.text;
    if (
        identifiers.length > 0 ||
        textual_representation_keyword.default === "always" ||
        (textual_representation_keyword.default === "preserve" &&
            ((!cst && textual_representation_keyword.fallback === "always") ||
                cst?.startsWith("rep")))
    ) {
        parts.push(keyword("rep"));
        parts.push(indent(identifiers));
    }

    const declaration: Doc[] = [
        group(parts),
        indent([
            parts.length > 0
                ? textual_representation_language_break === "always"
                    ? hardline
                    : line
                : literals.emptytext,
            keyword("language "),
            text(JSON.stringify(node.language), { type: SysMLSemanticTokenTypes.string }),
        ]),
    ];

    const inner = printInnerComments(node.notes, { ...context, indent: true });
    if (inner !== literals.emptytext) {
        declaration.push(line, inner);
    }

    return [
        group(declaration),
        hardline,
        // we can't be certain that the code is not whitespace sensitive so
        // preserve all trailing whitespace
        printBody(node.body, true),
    ];
}

/**
 * Default printer for metadata features.
 */
export function printMetadataFeature(node: MetadataFeatureMeta, context: ModelPrinterContext): Doc {
    const prefix: Doc[] = [
        formatPreserved(node, context.format.metadata_feature_keyword, {
            find: (node) => findNodeForKeyword(node, "metadata"),
            choose: {
                "@": () => text("@"),
                metadata: () => keyword("metadata "),
                preserve: (found) => (found ? "metadata" : "@"),
            },
        }),
    ];

    const heritage: Doc[] = [];
    const identifier = printIdentifiers(node, context, { trailing: indent(line) });
    if (identifier.length > 0) {
        prefix.push(...identifier);
        heritage.push(
            formatPreserved(node, context.format.declaration_feature_typing, {
                find: (node) => findNodeForKeyword(node, ":"),
                choose: {
                    keyword: () => keyword(context.mode === "kerml" ? "typed by " : "defined by "),
                    token: () => text(": "),
                    preserve: (found) => (found ? "token" : "keyword"),
                },
            })
        );
    }

    const typing = node.specializations(FeatureTyping).at(0);

    /* istanbul ignore next */
    if (!typing) throwError(node, "Invalid MetadataFeature - missing FeatureTyping");
    heritage.push(printTarget(typing, context));

    return [
        group([
            group([group(prefix), indent(group(heritage))]),
            ...printAbout(
                node.annotations().filter((a) => !a.isImplied),
                context
            ),
        ]),
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
            printer: MetadataBodyElementPrinter,
        }),
    ];
}

/**
 * Printer for directly and indirectly owned feature members inside metadata
 * feature bodies.
 */
const MetadataBodyElementPrinter: ElementPrinter = (node, context) => {
    if (node.nodeType() !== FeatureMembership) return DefaultElementPrinter(node, context);

    const kw = context.mode === "kerml" ? "feature" : "ref";
    const target = (node as FeatureMembershipMeta).element();

    /* istanbul ignore next */
    if (!target) throwError(node, "Invalid FeatureMembership - missing owned feature");
    const heritage = target.specializations().filter((s) => !s.isImplied);
    const redef = heritage.at(0);

    /* istanbul ignore next */
    if (redef?.nodeType() !== Redefinition)
        throwError(target, "Invalid MetadataFeature body feature - should start with redefinition");

    const relationships: Doc[] = [
        [
            formatPreserved(redef, context.format.metadata_body_feature_redefines, {
                find: (node) => getPreviousNode(node, false),
                choose: {
                    keyword: () => keyword("redefines "),
                    token: () => text(":>> "),
                    none: () => literals.emptytext,
                    preserve: (node) => {
                        /* istanbul ignore next */
                        if (!node) return "none";
                        if (node.text === ":>>") return "token";
                        return node.text === "redefines" ? "keyword" : "none";
                    },
                },
            }),
            printTarget(redef, context),
        ],
    ];

    relationships.push(...printDeclaredRelationships(target, heritage.slice(1), context));

    return [
        group([
            formatPreserved(target, context.format.metadata_body_feature_keyword, {
                find: (node) => findNodeForKeyword(node, kw),
                choose: {
                    always: (): Doc => [keyword(kw), literals.space],
                    never: () => literals.emptytext,
                    preserve: (found) => (found ? "always" : "never"),
                },
            }),
            group(indent(join(line, relationships))),
            target.value
                ? [literals.space, printModelElement(target.value, context)]
                : literals.emptytext,
        ]),

        printChildrenBlock(target, target.children, context, {
            insertSpaceBeforeBrackets: true,
            printer: MetadataBodyElementPrinter,
        }),
    ];
};
