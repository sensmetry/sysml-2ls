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
 *
 * Based on https://github.com/prettier/prettier
 ********************************************************************************/

import stringWidth from "string-width";
import { SemanticTokenTypes } from "vscode-languageserver";

/**
 * Group ID type.
 */
export type Id = string;

/**
 * Additional interface to attach semantic highlighting information. This will
 * allow pretty printing and semantic highligting in a single pass for those
 * cases where the formatted text will not be displayed through a language
 * server, i.e. custom visualization.
 */
export interface HighlightCommand {
    /**
     * Semantic type of the text portion. Using string as that is what
     * `vscode-languageserver.SemanticTokenType` uses.
     */
    type?: string;
    /**
     * Semantic modifiers of the text portion. Using string as that is what
     * `vscode-languageserver.SemanticTokenModifiers` uses.
     */
    modifiers?: string[];
}

export interface Indent {
    readonly kind: "indent";
    contents: Doc;
}

/**
 * Increases the level of indentation.
 */
export function indent(contents: Doc): Indent {
    return { kind: "indent", contents };
}

/**
 * Decreases the level of indentation.
 * @see {@link indent}
 */
export function dedent(contents: Doc): Align {
    return align(-1, contents);
}

export interface Align {
    readonly kind: "align";
    prefix: number | Text;
    contents: Doc;
}

/**
 * Increases the indentation by a fixed number of spaces or text. If document is
 * printed with tabs enabled, the leading spaces will be replaced by as many
 * tabs as possible.
 * @see {@link indent}
 * @param prefix number of spaces or text to icrease the indentation with.
 */
export function align(prefix: number | Text, contents: Doc): Align {
    return { kind: "align", prefix, contents };
}

export interface Group {
    readonly kind: "group";
    id?: Id;
    contents: Doc;
    break: boolean | "propagated";
    expandedStates?: Doc[];
}

export interface GroupOptions {
    /**
     * ID of this group that can be referenced by {@link ifBreak}.
     */
    id?: Id;
    /**
     * If true, this group always breaks.
     */
    shouldBreak?: boolean;
}

function groupInternal(
    contents: Doc,
    options: GroupOptions & { expandedStates?: Doc[] } = {}
): Group {
    return {
        kind: "group",
        id: options.id,
        contents,
        break: Boolean(options.shouldBreak),
        expandedStates: options.expandedStates,
    };
}

/**
 * A group of items that the printer will try fit on one line. If a group
 * doesn't fit, the printer will break the outer group and try fitting nested
 * groups again until everything fits or breaks.
 *
 * A group breaks if:
 * * `shouldBreak` option is set to `true
 * * `contents` include possibly in nested non-group doc:
 *      * {@link breakParent}
 *      * {@link hardline}
 *      * {@link literalline}
 *
 * Breaks are propagated to all parent groups.
 */
export function group(contents: Doc, options: GroupOptions = {}): Group {
    return groupInternal(contents, options);
}

/**
 * A variation of {@link group} that will try printing `states` in order until
 * one fits, otherwise prints the last alternative. Use with care as this can
 * result in poor performance.
 *
 * @param states documents from the least expanded (most flattened) to most
 * expanded
 */
export function conditionalGroup(states: Doc[], options: GroupOptions = {}): Group {
    return groupInternal(states[0], { ...options, expandedStates: states });
}

export interface Root {
    readonly kind: "root";
    contents: Doc;
}

/**
 * Marks contents as `root`.
 * @see {@link dedentToRoot}
 * @see {@link literalline}
 */
export function markAsRoot(contents: Doc): Root {
    return { kind: "root", contents };
}

/**
 * Decreases the indentation to the root level.
 * @see {@link markAsRoot}
 * @see {@link dedent}
 */
export function dedentToRoot(contents: Doc): Align {
    return align(Number.NEGATIVE_INFINITY, contents);
}

export interface Fill {
    readonly kind: "fill";
    parts: Doc[];
}

/**
 * A variation of {@link group} that prints as many documents as fits on each
 * line before breaking, compared to {@link group} that breaks on every element.
 *
 * @param parts array of alternating documents and line breaks, e.g. {@link softline}
 */
export function fill(parts: Doc[]): Fill {
    return { kind: "fill", parts };
}

export interface IfBreak {
    readonly kind: "if-break";
    onBreak: Doc;
    onFlat: Doc;
    groupId?: Id;
}

/**
 * Conditional documents to print based on if the current {@link group} or
 * {@link fill} was broken or not.
 *
 * @param onBreak document to print if the current group was broken
 * @param onFlat document to print if the current group was not broken
 * @param groupId id of another group to check if it was broken or not
 */
export function ifBreak(onBreak: Doc, onFlat: Doc, groupId?: Id): IfBreak {
    return { kind: "if-break", onBreak, onFlat, groupId };
}

export interface IndentIfBreak {
    readonly kind: "indent-if-break";
    contents: Doc;
    groupId: Id;
    negate?: boolean;
}

/**
 * Equivalent to `ifBreak(indent(doc), doc, { groupId })`. `negate: true`
 * reverses the conditional documents.
 */
export function indentIfBreak(
    contents: Doc,
    options: { groupId: Id; negate?: boolean }
): IndentIfBreak {
    return { kind: "indent-if-break", contents, ...options };
}

export interface LineSuffix {
    readonly kind: "line-suffix";
    contents: Doc;
}

/**
 * Marks `contents` to be printed at the end of the line, such as single line
 * trailing comments.
 *
 * @see {@link lineSuffixBoundary}
 */
export function lineSuffix(contents: Doc): LineSuffix {
    return { kind: "line-suffix", contents };
}

export interface LineSuffixBoundary {
    readonly kind: "line-suffix-boundary";
}

/**
 * Marks a boundary that {@link lineSuffix} cannot cross, it will always be
 * printed before the boundary.
 *
 * ```ts
 * [text("["), lineSuffix(text(" // a comment")), lineSuffixBoundary, text("}")]
 * ```
 *
 * will output
 *
 * ```
 * { // a comment
 * }
 * ```
 */
export const lineSuffixBoundary: LineSuffixBoundary = { kind: "line-suffix-boundary" };

export interface BreakParent {
    readonly kind: "break-parent";
}

/**
 * Breaks the current {@link group}
 */
export const breakParent: BreakParent = { kind: "break-parent" };

export interface Trim {
    readonly kind: "trim";
}

/**
 * Trims all trailing whitespace on the current line.
 */
export const trim: Trim = { kind: "trim" };

export type LineMode = "hard" | "soft" | "auto" | "hard-literal";

export interface Line {
    readonly kind: "line";
    mode: LineMode;
}

/**
 * A hard line that doesn't break the current {@link group} or {@link fill}.
 *
 * @see {@link hardline}
 */
export const hardlineWithoutBreakParent: Line = { kind: "line", mode: "hard" };

/**
 * A literal line that doesn't break the current {@link group} or {@link fill}.
 *
 * @see {@link literalline}
 */
export const literallineWithoutBreakParent: Line = { kind: "line", mode: "hard-literal" };

/**
 * An automatic line break that will be replaced by a space if the current
 * {@link group} or {@link fill} was not broken.
 *
 * @see {@link softline}
 * @see {@link hardline}
 * @see {@link literalline}
 */
export const line: Line = { kind: "line", mode: "auto" };

/**
 * An automatic line break that will be replaced by nothing if the current
 * {@link group} or {@link fill} was not broken.
 *
 * @see {@link line}
 * @see {@link hardline}
 * @see {@link literalline}
 */
export const softline: Line = { kind: "line", mode: "soft" };

/**
 * A line break that is always included in the output. Also breaks the current
 * {@link group} or {@link fill}.
 *
 * @see {@link line}
 * @see {@link softline}
 * @see {@link literalline}
 * @see {@link hardlineWithoutBreakParent}
 */
export const hardline: readonly [Line, BreakParent] = [hardlineWithoutBreakParent, breakParent];

/**
 * A literal line break that is always included in the output but doesn't indent
 * it. Also breaks the current {@link group} or {@link fill}. Unlike other line
 * breaks, it preserves trailing whitespace.
 *
 * @see {@link line}
 * @see {@link softline}
 * @see {@link hardline}
 * @see {@link literallineWithoutBreakParent}
 */
export const literalline: readonly [Line, BreakParent] = [
    literallineWithoutBreakParent,
    breakParent,
];

export interface Cursor {
    readonly kind: "cursor";
}

/**
 * A placeholder value for cursors that are propagated to the formatted
 * document.
 */
export const cursor: Cursor = { kind: "cursor" };

export interface Label {
    readonly kind: "label";
    label: unknown;
    contents: Doc;
}

/**
 * Marks the contents with a `label`.
 */
export function label(label: unknown, contents: Doc): Doc {
    return label ? { kind: "label", label, contents } : contents;
}

export interface Text extends HighlightCommand {
    readonly kind: "text";
    readonly contents: string;
    /**
     * Display width of this text
     */
    readonly width: number;
}

/**
 * Literal text to print. Unlinke `prettier`, this is its own doc command that
 * also allows attaching semantic highlighting information.
 */
export function text(contents: string, semantic: HighlightCommand = {}): Text {
    let width: number | undefined;
    return {
        kind: "text",
        contents,
        ...semantic,
        get width(): number {
            if (width !== undefined) return width;
            return (width = stringWidth(contents));
        },
    };
}

/**
 * Convenience function to keywords.
 * @see {@link text}
 */
export function keyword(contents: string): Text {
    return text(contents, { type: SemanticTokenTypes.keyword });
}

export const brackets = {
    round: {
        open: text("("),
        close: text(")"),
    },
    square: {
        open: text("["),
        close: text("]"),
    },
    curly: {
        open: text("{"),
        close: text("}"),
    },
    angle: {
        open: text("<"),
        close: text(">"),
    },
} as const;

export const literals = {
    true: text("true", { type: SemanticTokenTypes.keyword }),
    false: text("false", { type: SemanticTokenTypes.keyword }),
    null: text("null", { type: SemanticTokenTypes.keyword }),
    dot: text("."),
    comma: text(","),
    colon: text(":"),
    semicolon: text(";"),
    tilde: text("~"),
    doublecolon: text("::"),
    emptytext: text(""),
    space: text(" "),
    tab: text("\t"),
    lf: text("\n"),
    crlf: text("\r\n"),
} as const;

export type DocCommand =
    | Indent
    | Align
    | Group
    | Root
    | Fill
    | IfBreak
    | IndentIfBreak
    | LineSuffix
    | LineSuffixBoundary
    | BreakParent
    | Trim
    | Line
    | Cursor
    | Label
    | Text;

// unlike `prettier`, we don't allow string literals here since we use `Text`
export type Doc = DocCommand | readonly Doc[];

export type DocTypes = { [K in DocCommand["kind"]]: Extract<Doc, { kind: K }> } & {
    array: readonly Doc[];
};

export type DocKind = keyof DocTypes;

/**
 * Joins array of documents with a `separator`
 *
 * @param trailing if true, also adds a trailing `separator`
 */
export function join(separator: Doc, docs: Doc[], trailing = false): Doc[] {
    const joined = docs.flatMap((doc) => [doc, separator]);
    if (!trailing) joined.pop();
    return joined;
}

export function addAlignment(doc: Doc, size: number, tabWidth: number): Doc {
    if (size <= 0) return doc;

    const level = Math.floor(size / tabWidth);
    let aligned = doc;

    const spaces = size % tabWidth;
    if (spaces > 0) {
        aligned = align(spaces, aligned);
    }
    for (let i = 0; i < level; i++) aligned = indent(aligned);
    return align(Number.NEGATIVE_INFINITY, aligned);
}

export interface PrinterConfig {
    /**
     * Maximum line width, in certain cases when a line cannot be split this
     * will be violated
     */
    lineWidth: number;

    /**
     * Number of space characters in tab
     */
    tabWidth: number;

    /**
     * Use spaces to indent tabs
     */
    useSpaces: boolean;

    /**
     * Line end characters (LF or CLRF)
     */
    lineEnd: "\n" | "\r\n";

    /**
     * If true, prints the final new line
     */
    addFinalNewline?: boolean;

    /**
     * If true, also collects semantic highlighting ranges
     */
    highlighting?: boolean;
}

export const DefaultPrinterConfig: Readonly<PrinterConfig> = {
    lineWidth: 100,
    tabWidth: 4,
    useSpaces: true,
    lineEnd: "\n",
    addFinalNewline: true,
    highlighting: false,
};

export function getDocKind(doc: Doc): DocKind {
    return "kind" in doc ? doc.kind : "array";
}

export interface DocVisitor {
    /**
     * If true, traverse optional group docs instead of direct contents.
     */
    readonly traverseOptionalGroups?: boolean;
    /**
     * Callback on entering a doc. Returns false if doc children should not be
     * visited.
     */
    enter(doc: Doc): boolean;
    /**
     * Callback on exiting a doc.
     */
    exit?(doc: Doc): void;
}

const Visitor: {
    [K in DocKind]: (doc: DocTypes[K], stack: Doc[], traverseOptional: boolean) => void;
} = {
    "break-parent"() {
        /* empty */
    },
    "if-break"(doc, stack) {
        stack.push(doc.onFlat, doc.onBreak);
    },
    "indent-if-break"(doc, stack) {
        stack.push(doc.contents);
    },
    "line-suffix"(doc, stack) {
        stack.push(doc.contents);
    },
    "line-suffix-boundary"() {
        /* empty */
    },
    align(doc, stack) {
        stack.push(doc.contents);
    },
    array(doc, stack) {
        stack.push(...doc.slice().reverse());
    },
    cursor() {
        /* empty */
    },
    fill(doc, stack) {
        stack.push(...doc.parts.slice().reverse());
    },
    group(doc, stack, traverseOptional) {
        if (traverseOptional && doc.expandedStates && doc.expandedStates.length > 0) {
            stack.push(...doc.expandedStates.slice().reverse());
        } else {
            stack.push(doc.contents);
        }
    },
    indent(doc, stack) {
        stack.push(doc.contents);
    },
    label(doc, stack) {
        stack.push(doc.contents);
    },
    line() {
        /* empty */
    },
    root(doc, stack) {
        stack.push(doc.contents);
    },
    text() {
        /* empty */
    },
    trim() {
        /* empty */
    },
};

const ExitMarker = Symbol("DocVisitorExitMarker");

export function visitDoc(doc: Doc, visitor: DocVisitor): void {
    const stack: (Doc | typeof ExitMarker)[] = [doc];
    const traverseOptionalGroups = visitor.traverseOptionalGroups === true;

    while (stack.length > 0) {
        const item = stack.pop() as Doc | typeof ExitMarker;

        if (item === ExitMarker) {
            visitor.exit?.call(visitor, stack.pop() as Doc);
            continue;
        }

        if (visitor.exit) {
            stack.push(item, ExitMarker);
        }

        if (visitor.enter(item) === false) {
            continue;
        }

        const kind = getDocKind(item);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Visitor[kind](item as any, stack as Doc[], traverseOptionalGroups);
    }
}

export function inheritLabel(doc: Label, contents: (doc: Doc) => Doc): Label;
export function inheritLabel<R extends Doc>(doc: Doc, contents: (doc: Doc) => R): R;

export function inheritLabel(doc: Doc, contents: (doc: Doc) => Doc): Doc {
    const command = doc as DocCommand;
    return command.kind === "label"
        ? label(command.label, contents(command.contents))
        : contents(doc);
}

export function getLabel(doc: Label): unknown;
export function getLabel(doc: Doc): undefined | unknown;

export function getLabel(doc: Doc): unknown {
    const command = doc as DocCommand;
    return command.kind === "label" ? command.label : undefined;
}

/**
 * Appends `items` to `left` if it is `Fill`, otherwise returns a new fill of
 * `[left, ...items]`
 */
export function appendFill(left: Doc, ...items: Doc[]): Fill {
    const lhs = left as DocCommand;
    if (lhs.kind === "fill") {
        lhs.parts.push(...items);
        return lhs;
    }
    return fill([left, ...items]);
}

/**
 * Returns `doc` with `Indent` and `Align` unwrapped.
 */
export function unwrapIndent(doc: Doc): Doc {
    const d = doc as DocCommand;
    if (d.kind === "indent") return d.contents;
    if (d.kind === "align") return d.contents;
    return d;
}
