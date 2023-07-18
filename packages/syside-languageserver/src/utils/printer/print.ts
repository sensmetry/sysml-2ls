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

import assert from "assert";
import {
    DefaultPrinterConfig,
    Doc,
    DocCommand,
    DocKind,
    DocTypes,
    Group,
    PrinterConfig,
    Text,
    fill,
    getDocKind,
    hardlineWithoutBreakParent,
    indent,
    literals,
    text,
    visitDoc,
} from "./doc";

type Indentation = "indent" | "dedent" | Text | number;

type Indent = {
    value: Text;
    length: number;
    queue: Indent[];
    kind: Indentation;
    immediate: boolean;
    root?: Indent;
};

type Mode = "break" | "flat";
const Cursor = Symbol("cursor");
type OutToken = Text | typeof Cursor;

type LineSuffixes = Command[];
type Out = OutToken[];
type Command = readonly [Indent, Mode, Doc];
type Commands = Command[];
type GroupModeMap = Map<string, Mode>;

function generateInitialQueue(indent: Indent, newIndent: Indent): Indent[] {
    if (newIndent.kind === "dedent") {
        return indent.queue.slice(0, -1);
    }
    return [...indent.queue, newIndent];
}

function generateIndent(indent: Indent, newIndent: Indent, config: PrinterConfig): Indent {
    const queue = generateInitialQueue(indent, newIndent);

    let length = 0;
    const value: string[] = [];
    queue.forEach((indent) => {
        const kind = indent.kind;
        if (kind === "indent") {
            length += config.tabWidth;
            value.push(config.useSpaces ? " ".repeat(config.tabWidth) : "\t");
            return;
        } else if (typeof kind === "number") {
            assert(kind >= 0);
            length += kind;
            if (config.useSpaces) value.push(" ".repeat(kind));
            else {
                value.push(
                    "\t".repeat(Math.floor(kind / config.tabWidth)) +
                        " ".repeat(kind % config.tabWidth)
                );
            }
            return;
        } else if (typeof kind === "object") {
            length += kind.width;
            value.push(kind.contents);
        }
    });

    return {
        length,
        value: text(value.join("")),
        queue,
        kind: newIndent.kind,
        immediate: newIndent.immediate,
        root: indent.root,
    };
}

function makeIndent(indent: Indent, config: PrinterConfig, immediate: boolean): Indent {
    return generateIndent(
        indent,
        { kind: "indent", length: 0, queue: [], value: literals.emptytext, immediate },
        config
    );
}

function trim(out: Out): number {
    if (out.length === 0) return 0;

    let trimmed = 0;
    let cursors = 0;
    let index = out.length;

    const loop = (): void => {
        while (index--) {
            const last = out[index];
            if (last === Cursor) {
                cursors++;
                continue;
            }

            // regex trimming is far slower...
            for (let charIdx = last.contents.length - 1; charIdx >= 0; charIdx--) {
                const char = last.contents[charIdx];
                if (char === " " || char === "\t") {
                    trimmed++;
                    continue;
                }

                out[index] = text(last.contents.slice(0, charIdx + 1), {
                    type: last.type,
                    modifiers: last.modifiers,
                });
                return;
            }
        }
    };

    loop();

    if (trimmed > 0 || cursors > 0) {
        out.length = index + 1;
        out.push(...Array(cursors).fill(Cursor));
    }

    return trimmed;
}

function makeAlign(
    indent: Indent,
    amount: Text | number,
    config: PrinterConfig,
    immediate: boolean
): Indent {
    if (typeof amount === "number") {
        if (amount === Number.NEGATIVE_INFINITY) {
            return indent.root ?? rootIndent();
        }
        if (amount === 0) return indent;
        if (amount < 0)
            return generateIndent(
                indent,
                { kind: "dedent", length: 0, queue: [], value: literals.emptytext, immediate },
                config
            );
    }

    return generateIndent(
        indent,
        {
            kind: amount,
            length: 0,
            queue: [],
            value: literals.emptytext,
            immediate,
        },
        config
    );
}

type FitsContext = {
    width: number;
    hasLineSuffix: boolean;
    groupModeMap: GroupModeMap;
    mustBeFlat?: boolean;
    config: PrinterConfig;
};

function rootIndent(): Indent {
    return { kind: 0, value: literals.emptytext, length: 0, queue: [], immediate: true };
}

const Fits: {
    [K in DocKind]: (
        command: [Indent, Mode, DocTypes[K]],
        stack: Commands,
        out: Out,
        context: FitsContext
    ) => boolean | undefined | void;
} = {
    text([_, __, text], stack, out, context) {
        context.width -= text.width;
        if (context.width < 0) return false;
        out.push(text);
        return;
    },
    array([indent, mode, items], stack) {
        stack.push(
            ...items
                .slice()
                .reverse()
                .map((doc) => [indent, mode, doc] as const)
        );
    },
    fill([indent, mode, doc], stack) {
        stack.push(
            ...doc.parts
                .slice()
                .reverse()
                .map((doc) => [indent, mode, doc] as const)
        );
    },
    label([indent, mode, doc], stack) {
        stack.push([indent, mode, doc.contents]);
    },
    indent([indent, mode, doc], stack, out, context) {
        stack.push([makeIndent(indent, context.config, doc.immediate), mode, doc.contents]);
    },
    ["indent-if-break"]([indent, mode, doc], stack) {
        stack.push([indent, mode, doc.contents]);
    },
    align([indent, mode, doc], stack, out, context) {
        stack.push([
            makeAlign(indent, doc.prefix, context.config, doc.immediate),
            mode,
            doc.contents,
        ]);
    },
    group([indent, _, doc], stack, out, context) {
        if (context.mustBeFlat && doc.break) return false;
        const groupMode: Mode = doc.break ? "break" : "flat";
        const contents =
            doc.expandedStates && doc.expandedStates.length > 0 && groupMode === "break"
                ? doc.expandedStates[doc.expandedStates.length - 1]
                : doc.contents;
        stack.push([indent, groupMode, contents]);
        return;
    },
    cursor() {
        return;
    },
    root([indent, mode, doc], stack) {
        stack.push([
            {
                ...indent,
                root: indent,
            },
            mode,
            doc.contents,
        ]);
    },
    ["if-break"]([indent, mode, doc], stack, out, context) {
        const groupMode = doc.groupId ? context.groupModeMap.get(doc.groupId) || "flat" : mode;
        const contents = groupMode === "break" ? doc.onBreak : doc.onFlat;
        if (contents) stack.push([indent, mode, contents]);
    },
    ["line-suffix"](_, stack, out, context) {
        context.hasLineSuffix = true;
    },
    ["line-suffix-boundary"](_, stack, out, context) {
        if (context.hasLineSuffix) return false;
        return;
    },
    trim(_, stack, out, context) {
        context.width -= trim(out);
    },
    line([_, mode, doc], stack, out, context) {
        if (mode === "break" || doc.mode === "hard" || doc.mode === "hard-literal") return true;
        if (doc.mode !== "soft") {
            out.push(text(" "));
            context.width--;
        }
        return;
    },
    ["break-parent"]() {
        return false;
    },
};

function fits(next: Command, restCommands: Commands, context: FitsContext): boolean {
    if (context.width === Number.POSITIVE_INFINITY) {
        return true;
    }

    let restIdx = restCommands.length;
    const commands = [next];
    const out: Out = [];
    while (context.width >= 0) {
        if (commands.length === 0) {
            if (restIdx === 0) return true;
            commands.push(restCommands[--restIdx]);
            continue;
        }

        const command = commands.pop() as Command;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fits = Fits[getDocKind(command[2])](command as any, commands, out, context);
        if (typeof fits === "boolean") return fits;
    }

    return false;
}

export interface SemanticRange {
    /**
     * Start position in code points
     */
    start: number;
    /**
     * End position in code points
     */
    end: number;
    /**
     * Semantic type
     */
    type: string;
    /**
     * Semantic modifiers
     */
    modifiers?: string[];
}

export interface PrintResult {
    /**
     * Formatted text output.
     */
    text: string;
    /**
     * Semantic highlighting ranges. Ranges are guaranteed to be in ascending
     * order.
     */
    highlighting?: SemanticRange[];
    /**
     * Cursor positions as code points
     */
    cursors: number[];
}

export function collect(out: Out, semantic: true): Required<PrintResult>;
export function collect(out: Out, semantic: false): Omit<PrintResult, "highlighting">;
export function collect(out: Out, semantic: boolean): PrintResult;

export function collect(out: Out, semantic: boolean): PrintResult {
    const text: string[] = [];
    const highlighting: SemanticRange[] = [];
    const cursors: number[] = [];

    let position = 0;
    out.forEach((part) => {
        if (part === Cursor) {
            cursors.push(position);
        } else {
            text.push(part.contents);
            if (semantic && part.type) {
                highlighting.push({
                    start: position,
                    end: position + part.contents.length,
                    type: part.type,
                    modifiers: part.modifiers,
                });
            }
            position += part.contents.length;
        }
    });

    const result: PrintResult = {
        text: text.join(""),
        cursors,
    };
    if (semantic) result.highlighting = highlighting;
    return result;
}

type FormatContext = {
    position: number;
    shouldRemeasure: boolean;
    out: Out;
    lineSuffixes: LineSuffixes;
    groupModeMap: GroupModeMap;
    stack: Commands;
    lineEnd: Text;
    config: PrinterConfig;
};

function selectIndent(context: FormatContext, indent: Indent): Indent | undefined {
    if (indent.immediate && context.position === 0)
        return context.out.length === 0 || context.out.at(-1) === context.lineEnd
            ? indent
            : indent.root;
    return;
}

type FormatFunction<T extends Doc = Doc> = (
    indent: Indent,
    mode: Mode,
    doc: T,
    context: FormatContext
) => void;

const Formatter: {
    [K in DocKind]: FormatFunction<DocTypes[K]>;
} = {
    text(indent, mode, doc, context): void {
        // Unlike `prettier`, print indents on a first new-line text. This way
        // all new text will use the most recent indent whereas in prettier the
        // indent is taken from the last line break. `hard-literal` lines output
        // a new line end token which compares to false by reference and
        // preserves literal line breaks. Also, indent works on the first line
        // now.
        const newIndent = selectIndent(context, indent);
        if (newIndent) {
            context.out.push(newIndent.value);
            context.position = newIndent.length;
        }
        context.out.push(doc);
        context.position += doc.width;
    },

    array(indent, mode, doc, context): void {
        context.stack.push(
            ...doc
                .slice()
                .reverse()
                .map((command) => [indent, mode, command] as const)
        );
    },

    indent(ind, mode, doc, context): void {
        const indent = makeIndent(ind, context.config, doc.immediate);
        context.stack.push([indent, mode, doc.contents]);
    },

    align(ind, mode, doc, context): void {
        const indent = makeAlign(ind, doc.prefix, context.config, doc.immediate);
        context.stack.push([indent, mode, doc.contents]);
    },

    trim(indent, mode, doc, context): void {
        context.position -= trim(context.out);
    },

    cursor(indent, mode, doc, context): void {
        context.out.push(Cursor);
    },

    group(indent, mode, doc, context): void {
        const inner = (): void => {
            if (mode === "flat") {
                if (!context.shouldRemeasure) {
                    context.stack.push([indent, doc.break ? "break" : "flat", doc.contents]);
                    return;
                }
            }

            context.shouldRemeasure = false;
            const next: Command = [indent, "flat", doc.contents];
            // indent may not have been printed yet, check here
            const remainder =
                context.config.lineWidth -
                context.position -
                (selectIndent(context, indent)?.length ?? 0);
            const hasLineSuffix = context.lineSuffixes.length > 0;

            if (
                !doc.break &&
                fits(next, context.stack, {
                    config: context.config,
                    groupModeMap: context.groupModeMap,
                    hasLineSuffix,
                    width: remainder,
                })
            ) {
                context.stack.push(next);
            } else {
                if (doc.expandedStates && doc.expandedStates.length > 0) {
                    const mostExpanded = doc.expandedStates.at(-1) as Doc;
                    if (doc.break) {
                        context.stack.push([indent, "break", mostExpanded]);
                        return;
                    }

                    for (let i = 1; i < doc.expandedStates.length + 1; i++) {
                        if (i >= doc.expandedStates.length) {
                            context.stack.push([indent, "break", mostExpanded]);
                            return;
                        }

                        const state = doc.expandedStates[i];
                        const command: Command = [indent, "flat", state];
                        if (
                            fits(command, context.stack, {
                                width: remainder,
                                hasLineSuffix,
                                groupModeMap: context.groupModeMap,
                                config: context.config,
                            })
                        ) {
                            context.stack.push(command);
                            return;
                        }
                    }
                } else {
                    context.stack.push([indent, "break", doc.contents]);
                }
            }
        };

        inner();
        if (doc.id) {
            context.groupModeMap.set(doc.id, context.stack.at(-1)?.[1] as Mode);
        }
    },

    fill(indent, mode, doc, context): void {
        let parts = doc.parts;
        if (parts.length === 0) return;

        const remainder = context.config.lineWidth - context.position;
        const content = parts[0];

        const flatContent: Command = [indent, "flat", content];
        const breakContent: Command = [indent, "break", content];
        const flatContentFits = fits(flatContent, [], {
            width: remainder,
            config: context.config,
            groupModeMap: context.groupModeMap,
            hasLineSuffix: context.lineSuffixes.length > 0,
            mustBeFlat: true,
        });

        if (parts.length === 1) {
            context.stack.push(flatContentFits ? flatContent : breakContent);
            return;
        }

        const whitespace = parts[1];
        const flatWs: Command = [indent, "flat", whitespace];
        const breakWs: Command = [indent, "break", whitespace];
        if (parts.length === 2) {
            if (flatContentFits) {
                context.stack.push(flatWs, flatContent);
            } else {
                context.stack.push(breakWs, breakContent);
            }
            return;
        }

        parts = parts.slice(2);
        const remaining: Command = [indent, mode, fill(parts)];
        const secondContent = parts[0];
        const combinedFlatContent: Command = [indent, "flat", [content, whitespace, secondContent]];
        const combinedFits = fits(combinedFlatContent, [], {
            width: remainder,
            config: context.config,
            groupModeMap: context.groupModeMap,
            hasLineSuffix: context.lineSuffixes.length > 0,
            mustBeFlat: true,
        });

        if (combinedFits) {
            context.stack.push(remaining, flatWs, flatContent);
        } else {
            context.stack.push(remaining, breakWs, flatContentFits ? flatContent : breakContent);
        }
    },

    "line-suffix"(indent, mode, doc, context): void {
        context.lineSuffixes.push([indent, mode, doc.contents]);
    },

    "line-suffix-boundary"(indent, mode, doc, context): void {
        if (context.lineSuffixes.length > 0) {
            context.stack.push([indent, mode, hardlineWithoutBreakParent]);
        }
    },

    line(indent, mode, doc, context): void {
        if (mode === "flat") {
            if (doc.mode === "auto") {
                context.out.push(text(" "));
                context.position++;
                return;
            }

            if (doc.mode === "soft") return;

            context.shouldRemeasure = true;
        }

        if (context.lineSuffixes.length > 0) {
            context.stack.push([indent, mode, doc], ...context.lineSuffixes.reverse());
            context.lineSuffixes.length = 0;
            return;
        }

        if (doc.mode === "hard-literal") {
            if (!indent.immediate && indent.root) {
                context.out.push(context.lineEnd, indent.root.value);
                context.position = indent.root.length;
            } else {
                // Output a different line end token (by reference) so that
                // `text` doesn't output an indent.
                context.out.push(text(context.config.lineEnd));
                context.position = 0;
            }
            return;
        }

        context.position -= trim(context.out);
        context.out.push(context.lineEnd);
        context.position = 0;
        // don't print an empty indent immediatelly
        if (!indent.immediate && indent.length > 0) {
            context.out.push(indent.value);
            context.position = indent.length;
        }
    },

    label(indent, mode, doc, context): void {
        context.stack.push([indent, mode, doc]);
    },

    "break-parent"(): void {
        // no-op
    },

    "if-break"(ind, mode, doc, context): void {
        const groupMode = (doc.groupId ? context.groupModeMap.get(doc.groupId) : mode) ?? mode;
        context.stack.push([ind, mode, groupMode === "flat" ? doc.onFlat : doc.onBreak]);
    },

    "indent-if-break"(ind, mode, doc, context): void {
        const groupMode = (doc.groupId ? context.groupModeMap.get(doc.groupId) : mode) ?? mode;
        context.stack.push([
            ind,
            mode,
            groupMode === "flat"
                ? doc.negate
                    ? indent(doc.contents)
                    : doc.contents
                : doc.negate
                ? doc.contents
                : indent(doc.contents),
        ]);
    },

    root(indent, mode, doc, context) {
        context.stack.push([
            {
                ...indent,
                root: indent,
            },
            mode,
            doc.contents,
        ]);
    },
};

function propagateBreaks(doc: Doc): void {
    const visited = new Set<Group>();
    const stack: Group[] = [];

    const breakParent = (): void => {
        const group = stack.at(-1);
        if (group && !group.expandedStates && !group.break) {
            group.break = "propagated";
        }
    };

    visitDoc(doc, {
        traverseOptionalGroups: true,
        enter(doc) {
            // ignore arrays
            const item = doc as DocCommand;
            if (item.kind === "break-parent") {
                breakParent();
            } else if (item.kind === "group") {
                stack.push(item);
                if (visited.has(item)) return false;
                visited.add(item);
            }
            return true;
        },
        exit(doc) {
            const item = doc as DocCommand;
            if (item.kind === "group" && stack.pop()?.break) {
                breakParent();
            }
        },
    });
}

export function formatDoc(doc: Doc, config: PrinterConfig): Out {
    const context: FormatContext = {
        position: 0,
        shouldRemeasure: false,
        out: [],
        lineSuffixes: [],
        groupModeMap: new Map(),
        stack: [[rootIndent(), "break", doc]],
        lineEnd: text(config.lineEnd),
        config,
    };

    propagateBreaks(doc);

    while (context.stack.length > 0) {
        const [indent, mode, doc] = context.stack.pop() as Command;

        const kind = getDocKind(doc);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Formatter[kind](indent, mode, doc as any, context);

        if (context.stack.length === 0 && context.lineSuffixes.length > 0) {
            context.stack.push(...context.lineSuffixes.reverse());
            context.lineSuffixes.length = 0;
        }
    }

    const finalText = context.out.findLast((item): item is Text => item !== Cursor);
    if (
        context.config.addFinalNewline &&
        (!finalText || !finalText.contents.endsWith(config.lineEnd))
    ) {
        context.out.push(text(context.config.lineEnd));
    }

    return context.out;
}

export function printDoc(
    Docdoc: Doc,
    config: PrinterConfig & { highlighting: true }
): Required<PrintResult>;
export function printDoc(
    doc: Doc,
    config: PrinterConfig & { highlighting: false }
): Omit<PrintResult, "highlighting">;
export function printDoc(doc: Doc, config?: PrinterConfig): PrintResult;

export function printDoc(doc: Doc, config: PrinterConfig = DefaultPrinterConfig): PrintResult {
    const out = formatDoc(doc, config);
    return collect(out, config.highlighting === true);
}

/**
 * Convenience printer function that prints `doc` to string using default
 * config.
 */
export function print(doc: Doc, options?: Partial<Omit<PrinterConfig, "highlighting">>): string {
    const text = printDoc(doc, { ...DefaultPrinterConfig, ...options }).text;
    return text;
}
