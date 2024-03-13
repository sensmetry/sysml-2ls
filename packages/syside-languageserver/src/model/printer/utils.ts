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

import { SemanticTokenModifiers } from "vscode-languageserver";
import type { LangiumDocument } from "langium";
import { ElementMeta, FeatureMeta, NamespaceMeta } from "../KerML";
import {
    HighlightCommand,
    Text,
    text,
    Doc,
    group,
    softline,
    indent,
    ifBreak,
    hardlineWithoutBreakParent,
    brackets,
    literals,
    fill,
    printInnerComments,
    hardline,
    line,
    TextComment,
    label,
    NonNullable,
} from "../../utils";
import { tokenType, tokenModifiers } from "../semantic-tokens";
import { sanitizeName, unsanitizeName } from "../naming";
import {
    ElementReference,
    InlineExpression,
    Membership,
    MembershipReference,
    Namespace,
    OwningMembership,
    Relationship,
} from "../../generated/ast";
import { BasicMetamodel } from "../metamodel";
import {
    DefaultElementPrinter,
    ElementPrinter,
    ModelPrinterContext,
    PrintModelElementOptions,
    defaultPrintNotes,
    printElementIgnored,
    printModelElement,
} from "./print";
import { CstNode, DocumentSegment, Grammar, findNodeForKeyword, stream, streamAst } from "langium";
import { isKeyword } from "langium/lib/grammar/generated/ast";
import { KerMLGrammar, SysMLGrammar } from "../../generated/grammar";
import { PreservableFormatting } from "./format-options";
import assert from "assert";
import { UsageMeta } from "../SysML";

/**
 * Computes semantic highlighting for `element` that can be used with `text` and
 * `printIdentifier`.
 */
export function computeHighlighting(element: ElementMeta): HighlightCommand {
    return {
        type: tokenType(element),
        modifiers: tokenModifiers(element),
    };
}

/**
 * Prints and identifier, escaping name string and applying qoutes when needed.
 * @param name identifier string
 * @param semantic semantic highlighting information
 * @param restricted set of restricted language keywords
 */
export function printIdentifier(
    name: string,
    options: {
        semantic?: HighlightCommand;
        restricted?: Set<string>;
        forceQuotes?: boolean;
    } = {}
): Text {
    if (options.forceQuotes || options.restricted?.has(name))
        return text(`'${name}'`, options.semantic);
    return text(unsanitizeName(name), options.semantic);
}

/**
 * Prints `element` names to document as valid KerML/SysML syntax.
 */
export function printIdentifiers(
    element: ElementMeta,
    context?: ModelPrinterContext,
    separators: { trailing?: Doc; leading?: Doc } = {}
): Doc[] {
    const doc: Doc[] = [];

    if (!element.declaredShortName && !element.declaredName) return doc;

    const semantic: HighlightCommand = context?.highlighting ? computeHighlighting(element) : {};
    semantic.modifiers?.push(SemanticTokenModifiers.declaration);
    if (separators.leading) doc.push(separators.leading);

    if (element.declaredShortName) {
        doc.push(
            group([
                brackets.angle.open,
                indent([
                    softline,
                    printIdentifier(element.declaredShortName, {
                        semantic,
                        restricted: context?.keywords,
                        forceQuotes:
                            context?.format.strip_unnecessary_quotes === false &&
                            element.ast()?.declaredShortName?.startsWith("'"),
                    }),
                ]),
                // if this group is broken, put the bracket on a new line
                ifBreak(hardlineWithoutBreakParent, literals.emptytext),
                brackets.angle.close,
            ])
        );

        if (element.declaredName) {
            doc.push(literals.space);
        }
    }

    if (element.declaredName) {
        doc.push(
            printIdentifier(element.declaredName, {
                semantic,
                restricted: context?.keywords,
                forceQuotes:
                    context?.format.strip_unnecessary_quotes === false &&
                    element.ast()?.declaredName?.startsWith("'"),
            })
        );
    }

    if (separators.trailing && doc.length > 0) doc.push(separators.trailing);

    return doc;
}

/**
 * Concats reference parts as they appeared in the source text with line
 * separators.
 */
export function printAstReference(reference: ElementReference, context: ModelPrinterContext): Doc {
    let innerNotes = reference.$meta.notes.filter(
        (note) => note.localPlacement === "inner" && note.label !== undefined
    );

    let linebreak: Doc = softline;
    const printed = fill(
        reference.parts
            .map((ref, index) => {
                let part: Doc = printIdentifier(sanitizeName(ref.$refText), {
                    semantic:
                        context.highlighting && ref.ref ? computeHighlighting(ref.ref.$meta) : {},
                    restricted: context.keywords,
                    forceQuotes:
                        !context.format.strip_unnecessary_quotes && ref.$refText.startsWith("'"),
                });

                if (innerNotes.length === 0)
                    return index === 0
                        ? part
                        : [indent(linebreak), indent([literals.doublecolon, part])];

                const leadingLabel = `${index}-leading`;
                const trailingLabel = `${index}-trailing`;

                const leading: TextComment[] = [];
                const trailing: TextComment[] = [];
                innerNotes = innerNotes.filter((note) => {
                    switch (note.label) {
                        case leadingLabel:
                            leading.push(note);
                            return false;
                        case trailingLabel:
                            trailing.push(note);
                            return false;
                        default:
                            return true;
                    }
                });

                if (leading.length > 0) {
                    part = [
                        index !== 0 ? line : literals.emptytext,
                        printInnerComments(
                            leading,
                            {
                                ...context,
                                label: leadingLabel,
                            },
                            (note) => (note.kind === "line" ? hardline : undefined)
                        ),
                        line,
                        part,
                    ];
                }

                if (trailing.length > 0) {
                    part = [
                        part,
                        line,
                        printInnerComments(trailing, { ...context, label: trailingLabel }),
                    ];
                }

                part = group(part);
                if (index !== 0) part = [indent(linebreak), indent([literals.doublecolon, part])];

                const lastNote = trailing.at(-1);
                if (lastNote) {
                    if (lastNote.kind === "line") linebreak = hardline;
                    else linebreak = softline;
                }

                return part;
            })
            .flat(1)
    );

    const doc = defaultPrintNotes(printed, reference.$meta, context);
    if (reference.$meta.notes.some((note) => note.localPlacement === "leading"))
        return label("with-leading-notes", doc);
    return doc;
}

/**
 * Convenience error function for element printers. Adds text location to the
 * error message if the element has corresponding CST node.
 */
export function throwError(element: BasicMetamodel, message: string): never {
    const range = element.cst()?.range;
    // zero-based indexing range, add 1 to match editor display
    if (range)
        message += ` on line ${range.start.line + 1}, character: ${range.start.character + 1}`;
    throw new Error(message);
}

export function assertMember(
    owner: ElementMeta,
    member: unknown,
    kind: string,
    name: string
): asserts member {
    /* istanbul ignore next */
    if (!member) throwError(owner, `Invalid ${kind} - missing ${name} member`);
}

/**
 * Default printer for references. Prioritizes matching AST `ElementReference`
 * if it exists and points to the same target or the reference has not been or
 * failed to resolve. `options.context.referencePrinter` is onlyny used as a
 * fallback which makes this printed suitable for source text formatting and
 * printing programmatic models.
 */
export function printReference(
    target: ElementMeta | undefined,
    options: {
        scope: ElementMeta;
        context: ModelPrinterContext;
        astNode?: ElementReference;
        errorMessage?: string;
    }
): Doc {
    if (!target) {
        /* istanbul ignore next */
        if (!options.astNode) {
            throwError(
                options.scope,
                options.errorMessage ?? `Missing reference in ${options.scope.nodeType()}`
            );
        }

        return printAstReference(options.astNode, options.context);
    }

    if (options.astNode) {
        const to = options.astNode?.$meta.to;
        // need to unwrap membership targets if ast requires a type
        const targetRef =
            options.astNode.$type !== MembershipReference && target.is(Membership)
                ? target.element()
                : target;
        if (!to?.cached || to.target === targetRef)
            return printAstReference(options.astNode, options.context);
    }

    return options.context.referencePrinter(target, options.scope, options.context);
}

function collectKeywords(grammar: Grammar): Set<string> {
    return stream(grammar.rules)
        .flatMap(streamAst)
        .filter(isKeyword)
        .map((rule) => rule.value)
        .toSet();
}

const CACHED_KEYWORDS: Partial<Record<symbol, Set<string>>> = {};

export function getKeywordsFor(id: symbol, grammar: Grammar): Set<string> {
    return (CACHED_KEYWORDS[id] ??= collectKeywords(grammar));
}

/**
 * Returns all reserved keywords for KerML.
 */
export function KerMLKeywords(): Set<string> {
    return getKeywordsFor(Symbol.for("KerML"), KerMLGrammar());
}

/**
 * Returns all reserved keywords for SysML.
 */
export function SysMLKeywords(): Set<string> {
    return getKeywordsFor(Symbol.for("SysML"), SysMLGrammar());
}

export interface FormatPreservedOptions<T extends string, R> {
    /**
     * Function that finds an appropriate CST nodes for preservation. Usually,
     * this will be `findNodeForKeyword(node, "<my keyword>")`.
     */
    find: (node: CstNode) => CstNode | undefined;

    // nested object so that type inference works for R
    /**
     * Alternatives for the printer.
     */
    choose: {
        /**
         * Returns an alternative based on the node found in `find`.
         */
        preserve: (found: CstNode | undefined) => T;
    } & Record<T, () => R>;
}

/**
 * Selects appropriate alternative based on the source text for formatting
 * options that allow preserving source text formatting.
 */
export function formatPreserved<T extends string, R>(
    node: ElementMeta,
    option: Required<PreservableFormatting<T>>,
    config: FormatPreservedOptions<T, R>
): R {
    const { choose } = config;
    if (option.default !== "preserve") return choose[option.default]();
    const cst = node.cst();
    if (!cst) return choose[option.fallback]();

    const alt = choose.preserve(config.find(cst));
    return choose[alt]();
}

/**
 * Checks if the `node` was or would have been parsed with `FeatureDeclaration`
 * rule. Useful for feature printers that may print differently if there was no
 * feature declaration.
 */
export function hasFeatureDeclaration(node: FeatureMeta): boolean {
    return Boolean(
        node.specializations().some((s) => !s.isImplied) ||
            node.typeRelationships.some((r) => !r.isImplied) ||
            node.declaredName ||
            node.declaredShortName ||
            node.multiplicity ||
            node.isOrdered ||
            node.isNonUnique
    );
}

export function selectDeclarationKeyword(
    node: FeatureMeta,
    kw: string,
    option: PreservableFormatting<"always" | "as_needed">
): string | undefined {
    const token = formatPreserved(node, option, {
        find: (node) => findNodeForKeyword(node, kw),
        choose: {
            always: () => kw,
            as_needed: () => (hasFeatureDeclaration(node) ? kw : undefined),
            preserve: (found) => (found ? "always" : "as_needed"),
        },
    });

    return token;
}

export function shouldIgnoreRef(
    node: UsageMeta,
    option: PreservableFormatting<"always" | "never">
): boolean {
    return formatPreserved(node, option, {
        find: (node) => findNodeForKeyword(node, "ref"),
        choose: {
            always: () => false,
            never: () => true,
            preserve: (found) => (found ? "always" : "never"),
        },
    });
}

export function hasFormatIgnore(node: BasicMetamodel): boolean {
    // if an element doesn't have a CST, formatting for it cannot be ignored,
    // otherwise information would be lost
    return Boolean(
        node.cst() &&
            node.notes.some(
                (note) =>
                    note.localPlacement === "leading" && /syside-format ignore/.test(note.text)
            )
    );
}

export function getElementStart(node: ElementMeta): DocumentSegment | undefined {
    return (
        node.notes.filter((note) => note.localPlacement === "leading").find((note) => note.segment)
            ?.segment ?? node.cst()
    );
}

export function getElementEnd(node: ElementMeta): DocumentSegment | undefined {
    return (
        node.notes
            .filter((note) => note.localPlacement === "trailing")
            .findLast((note) => note.segment)?.segment ?? node.cst()
    );
}

class DescendantPrinterImpl<
    T extends ElementMeta = ElementMeta,
    S extends ElementMeta = ElementMeta,
> {
    protected stack: ElementMeta[] = [];

    constructor(
        public root: T,
        public context: ModelPrinterContext,
        public kind: string
    ) {}

    /**
     * Descend one element at a time. Descending more risks losing attached
     * notes.
     */
    descend<E extends ElementMeta>(
        selector: (node: S) => E | undefined
    ): DescendantPrinterImpl<T, E> {
        const parent = this.descendant;
        const child = selector(parent);
        /* istanbul ignore next */
        if (!child)
            throwError(parent, `Interrupted ${this.kind} chain at ${this.stack.length} link`);

        this.stack.push(child);
        return this as unknown as DescendantPrinterImpl<T, E>;
    }

    /**
     * Print the final descendant with all notes on the intermediate nodes
     * preserved.
     */
    print(options?: Omit<PrintModelElementOptions<S, Doc>, "printer">): Doc;
    print<R extends Doc>(
        options: PrintModelElementOptions<S, R> &
            Required<Pick<PrintModelElementOptions<S, R>, "printer">>
    ): R | Doc[];
    print<R extends Doc>(options?: PrintModelElementOptions<S, R>): R | Doc[] | Doc;

    print(options?: PrintModelElementOptions<S>): Doc {
        assert(this.stack.length > 0, "Cannot print empty descendant chain");

        let printed = printModelElement(this.stack[this.stack.length - 1], this.context, options);
        for (let i = this.stack.length - 2; i >= 0; --i)
            printed = printModelElement(this.stack[i], this.context, { printer: () => printed });

        return printed;
    }

    get descendant(): S {
        return (this.stack.at(-1) ?? this.root) as S;
    }
}

export type DescendantPrinter<
    T extends ElementMeta = ElementMeta,
    S extends ElementMeta = ElementMeta,
> = {
    [K in keyof DescendantPrinterImpl<T, S>]: DescendantPrinterImpl<T, S>[K];
};

/**
 * A builder-pattern-like descendant printer, use `.descend` to descend one
 * element at a time and `print` to print the final descendant. This way any
 * notes attached on the intermediate nodes will be preserved when printing.
 */
export function printDescendant<T extends ElementMeta>(
    root: T,
    context: ModelPrinterContext,
    kind: string
): DescendantPrinter<T, T> {
    return new DescendantPrinterImpl(root, context, kind);
}

export interface PrintRange {
    offset: number;
    end: number;
}

function rangesIntersect(a: PrintRange, b: PrintRange): boolean {
    return (a.offset > b.offset && a.offset < b.end) || (a.end < b.end && a.end > b.offset);
}

function rangesIntersectSym(a: PrintRange, b: PrintRange): boolean {
    return rangesIntersect(a, b) || rangesIntersect(b, a);
}

function cstRangeIntersector(range: PrintRange): (child: ElementMeta) => boolean {
    return (child: ElementMeta): boolean => {
        const cst = child.cst();
        /* istanbul ignore next */
        if (!cst) return false;
        return rangesIntersectSym(cst, range);
    };
}

export interface ElementRange {
    /**
     * Elements that are affected by the print range.
     */
    elements: readonly ElementMeta[];

    /**
     * Range that printed `elements` are in.
     */
    range: PrintRange;

    /**
     * Indentation level of `elements`.
     */
    level: number;

    /**
     * Options to be used when printing `elements`.
     */
    options?: PrintModelElementOptions;

    /**
     * All siblings not in range prior to `elements`
     */
    leading?: readonly ElementMeta[];
}

const ignoredPrinter: ElementPrinter = (node, context, sibling?) =>
    printElementIgnored(node, context) ?? DefaultElementPrinter(node, context, sibling);

/**
 * Collects and returns the elements that should be printed in `range`.
 */
export function collectPrintRange(
    document: LangiumDocument,
    range: PrintRange
): ElementRange | undefined {
    const root = document.parseResult.value.$meta as NamespaceMeta;
    const cst = root.cst();

    /* istanbul ignore next */
    if (!cst) return;

    const { offset, end } = range;

    // short-circuit for ranges that fall outside of the root element
    if (end <= cst.offset || offset >= cst.end) return;
    let level = 0;
    let scope = root as ElementMeta;
    let scopeCst = cst;
    let children: readonly ElementMeta[] = root.children;
    let leading: readonly ElementMeta[] | undefined;

    for (;;) {
        // descend through children to find a common children range
        const blockOffset = findNodeForKeyword(scope.cst() ?? scopeCst, "{")?.offset ?? -1;

        // greater_equal comparison since a cursor just before the bracket will
        // have the same offset
        if ((scope.parent() !== undefined && blockOffset === -1) || blockOffset >= offset) {
            const parent = scope.parent();
            if (parent?.is(OwningMembership)) scope = parent;
            return {
                elements: [scope],
                range: getChildrenRange([scope]) as PrintRange,
                // ascending one level back up
                level: level - 1,
                leading,
                options: {
                    printer: DefaultElementPrinter,
                    previousSibling: leading?.at(-1),
                },
            };
        }

        const allChildrenRange = getChildrenRange(children);

        const first = children.findIndex(cstRangeIntersector(range));
        const last = children.findLastIndex(cstRangeIntersector(range));
        leading = first > 0 ? children.slice(0, first) : undefined;

        if (first === -1 || last === -1) {
            // no children intersect the range which is inside the children
            // block: format the space between the neareast two children
            switch (children.length) {
                case 0:
                    // TODO: format brackets?
                    return;

                case 1:
                    /* istanbul ignore next */
                    if (!allChildrenRange) return;
                    return {
                        elements: children,
                        range: allChildrenRange,
                        level,
                        options: {
                            printer: ignoredPrinter,
                        },
                    };

                default: {
                    const next = children.findIndex((child) => {
                        const cst = child.cst();
                        return cst && cst.offset >= end;
                    });
                    /* istanbul ignore next */
                    if (next === -1) return;

                    let prev = next - 1;
                    while (!children[prev].cst() && prev >= 0) {
                        --prev;
                    }

                    const surrounding =
                        prev >= 0 ? children.slice(prev, next + 1) : [children[next]];
                    leading = prev > 0 ? children.slice(0, prev) : undefined;
                    return {
                        elements: surrounding,
                        range: getChildrenRange(surrounding) as PrintRange,
                        level,
                        leading,
                        options: {
                            printer: ignoredPrinter,
                            previousSibling: leading?.at(-1),
                        },
                    };
                }
            }
        }

        if (first === last) {
            const child = children[first];
            if (
                (child.is(Relationship) && !child.element()?.is(InlineExpression)) ||
                child.is(Namespace)
            ) {
                // descend down to check if the whole element or just some
                // of its children need to be printed
                const target =
                    child.is(OwningMembership) && child.element().is(Namespace)
                        ? (child.element() as NamespaceMeta)
                        : child;
                level++;
                scope = target;
                scopeCst = (target.cst() ?? child.cst()) as CstNode;
                children = target.children;
                continue;
            }
        }

        const elements = children.slice(first, last + 1);
        return {
            elements,
            range: getChildrenRange(elements) as PrintRange,
            level,
            leading,
            options: {
                printer: DefaultElementPrinter,
                previousSibling: leading?.at(-1),
            },
        };
    }
}

export function getChildrenRange(children: readonly ElementMeta[]): PrintRange | undefined {
    const first = children.find((e) => e.cst());
    const last = children.findLast((e) => e.cst());
    if (first === undefined || last === undefined) return;
    const left = [first];
    if (first.is(Relationship)) {
        left.push(
            ...[first.source(), first.element()]
                .filter(NonNullable)
                .filter((e) => e.parent() === first)
        );
    }

    let right = [last];
    if (first === last) {
        right = left;
    } else if (last.is(Relationship)) {
        right.push(
            ...[last.source(), last.element()]
                .filter(NonNullable)
                .filter((e) => e.parent() === first)
        );
    }

    const start = Math.min(
        ...left
            .map(getElementStart)
            .filter(NonNullable)
            .map((s) => s.offset)
    );
    const end = Math.max(
        ...right
            .map(getElementEnd)
            .filter(NonNullable)
            .map((s) => s.end)
    );

    /* istanbul ignore next */
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    return { offset: start, end };
}
