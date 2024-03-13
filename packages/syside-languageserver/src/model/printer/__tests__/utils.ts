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

import { LangiumDocument, AstNode, DeepPartial } from "langium";
import { SubtypeKeys } from "../../../services";
import { emptyDocument, getRange, parseKerML, parseSysML } from "../../../testing";
import { PrinterConfig, mergeWithPartial, DefaultPrinterConfig, print } from "../../../utils";
import { ElementMeta, NamespaceMeta } from "../../KerML";
import { ElementIDProvider, basicIdProvider, MetatypeProto, Metatype } from "../../metamodel";
import {
    ModelPrinterContext,
    printModelElement,
    defaultKerMLPrinterContext,
    defaultSysMLPrinterContext,
    collectUnprintedNotes,
} from "../print";
import { Element, OwningMembership } from "../../../generated/ast";
import { parsedNode } from "../../../testing";
import { ElementRange, collectPrintRange } from "../utils";
import { attachNotes } from "../../notes";

let provider: ElementIDProvider;
let document: LangiumDocument;

beforeAll(() => {
    provider = basicIdProvider();
    document = emptyDocument("printer_utils", ".sysml");
});

export const makeEmpty = <T extends AstNode>(proto: MetatypeProto<T>): T["$meta"] => {
    return (proto as Metatype<T>)["create"](provider, document) as T["$meta"];
};

export interface PrinterTestContext extends ModelPrinterContext {
    options: PrinterConfig;
}

function printElement(
    element: ElementMeta,
    context: DeepPartial<PrinterTestContext>,
    defaultContext: ModelPrinterContext
): string {
    let previousSibling: ElementMeta | undefined;
    const parent = element.parent();
    const owner = element.owner();
    if (parent && owner) {
        const self = parent.is(OwningMembership) ? parent : element;
        const siblings = owner.ownedElements().toArray();
        const index = siblings.findIndex((e) => e === self);
        if (index !== -1) previousSibling = siblings[index];
    }

    const printContext = mergeWithPartial(defaultContext, context);

    const doc = printModelElement(element, printContext, { previousSibling });
    const formatted = print(doc, { ...DefaultPrinterConfig, ...context.options });

    expect(collectUnprintedNotes(element, printContext.printed)).toHaveLength(0);

    return formatted;
}

export const printKerMLElement = (
    element: ElementMeta,
    context: DeepPartial<PrinterTestContext> = {}
): string => printElement(element, context, defaultKerMLPrinterContext());

export const printSysMLElement = (
    element: ElementMeta,
    context: DeepPartial<PrinterTestContext> = {}
): string => printElement(element, context, defaultSysMLPrinterContext());

export function expectPrinted(
    text: string,
    options: DeepPartial<PrinterTestContext> & {
        build?: boolean;
        lang?: "sysml" | "kerml";
        node: SubtypeKeys<Element>;
        index?: number;
    }
): jest.JestMatchers<Promise<string>> {
    const lang = options.lang ?? "kerml";
    return expect(
        parsedNode(text, options).then((node) =>
            (lang === "kerml" ? printKerMLElement : printSysMLElement)(node.$meta, options)
        )
    );
}

export async function getPrintRange(
    source: string,
    options: DeepPartial<PrinterTestContext> & {
        lang?: "sysml" | "kerml";
    } = {}
): Promise<ElementRange | undefined> {
    const lang = options.lang ?? "kerml";
    const { text, range } = getRange(source);
    return (lang === "kerml" ? parseKerML : parseSysML)(text, { build: false }).then((result) => {
        const root = result.value.$meta as NamespaceMeta;
        expect(root).toBeDefined();
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);

        attachNotes(root.document);
        const printRange = collectPrintRange(root.document, range);

        return printRange;
    });
}
