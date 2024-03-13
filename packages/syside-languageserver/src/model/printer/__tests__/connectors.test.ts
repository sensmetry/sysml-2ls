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

import { DeepPartial } from "langium";
import { SubtypeKeys } from "../../../services";
import { PrinterTestContext, expectPrinted as expectPrintedAs } from "./utils";
import {
    Element,
    Connector,
    BindingConnector,
    Succession,
    ItemFlow,
    SuccessionItemFlow,
    BindingConnectorAsUsage,
    ConnectionUsage,
    FlowConnectionUsage,
    SuccessionFlowConnectionUsage,
    AllocationUsage,
    InterfaceUsage,
} from "../../../generated/ast";

describe("connectors", () => {
    const expectPrinted = (
        text: string,
        context?: DeepPartial<PrinterTestContext> & { node?: SubtypeKeys<Element> }
    ): jest.JestMatchers<Promise<string>> => {
        return expectPrintedAs(text, {
            ...context,
            lang: "kerml",
            node: context?.node ?? Connector,
        });
    };

    it("should print binary connectors", async () => {
        return expectPrinted(
            "connector a from one ::> a [1] to two references b [2] {}"
        ).resolves.toEqual("connector a from one ::> a [1] to two references b [2] {}\n");
    });

    it("should print sufficient connectors", () => {
        return expectPrinted(" connector  all  from A to B;").resolves.toEqual(
            `connector all from A to B;\n`
        );
    });

    it("should print nary connectors", async () => {
        return expectPrinted("connector a (one, two, three) {}").resolves.toEqual(
            "connector a (one, two, three) {}\n"
        );
    });

    it("should preserve nary formatting for binary connectors", async () => {
        return expectPrinted("connector a (one, two) {}").resolves.toEqual(
            "connector a (one, two) {}\n"
        );
    });

    it("should break connectors", async () => {
        return expectPrinted(
            "connector 'some long name here' from one ::> a [1] to two references b [2] {}",
            {
                options: { lineWidth: 30 },
            }
        ).resolves.toEqual(`connector 'some long name here'
    from one ::> a [1]
    to two references b [2] {}\n`);
    });

    it("should long nary connectors", async () => {
        return expectPrinted("connector a (one, two, three, four) {}", {
            options: { lineWidth: 20 },
        }).resolves.toEqual(`connector a (
    one,
    two,
    three,
    four
) {}\n`);
    });

    it("should skip source keyword if it is not needed", async () => {
        return expectPrinted("connector one to two {}", {
            format: { binary_connectors_from_keyword: { default: "as_needed" } },
        }).resolves.toEqual("connector one to two {}\n");
    });

    it("should add source keyword if it is needed", async () => {
        return expectPrinted("connector a from one to two {}", {
            format: { binary_connectors_from_keyword: { default: "as_needed" } },
        }).resolves.toEqual("connector a from one to two {}\n");
    });

    it("should print binary binding connectors", async () => {
        return expectPrinted("binding a of one = two {}", {
            node: BindingConnector,
        }).resolves.toEqual("binding a of one = two {}\n");
    });

    it("should print binary successions", async () => {
        return expectPrinted("succession a first one then two {}", {
            node: Succession,
        }).resolves.toEqual("succession a first one then two {}\n");
    });
});

describe.each([
    ["kerml", ItemFlow, SuccessionItemFlow],
    ["sysml", FlowConnectionUsage, SuccessionFlowConnectionUsage],
] as const)("%s item flows", (lang, flowType, successionType) => {
    const expectPrinted = (
        text: string,
        context?: DeepPartial<PrinterTestContext> & { node?: SubtypeKeys<Element> }
    ): jest.JestMatchers<Promise<string>> => {
        return expectPrintedAs(text, {
            ...context,
            lang,
            node: context?.node ?? flowType,
        });
    };

    it("should print fitting item flows", async () => {
        return expectPrinted("flow a of [1] : I = 1 from one to two {}", {}).resolves.toEqual(
            "flow a of : I [1] = 1 from one to two {}\n"
        );
    });

    it("should print fitting item flows with named item features", async () => {
        return expectPrinted("flow a of i [1] : I = 1 from one to two {}", {}).resolves.toEqual(
            "flow a of i : I [1] = 1 from one to two {}\n"
        );
    });

    it("should print item flows without ends", async () => {
        return expectPrinted("flow a  = 3 of [1] : I = 1;").resolves.toEqual(
            "flow a = 3 of : I [1] = 1;\n"
        );
    });

    it("should print flows with ends only", async () => {
        return expectPrinted("flow a to b;").resolves.toEqual("flow a to b;\n");
    });

    it("should print succession item flow", async () => {
        return expectPrinted("succession flow a of [1] : I = 1 from one to two {}", {
            node: successionType,
        }).resolves.toEqual("succession flow a of : I [1] = 1 from one to two {}\n");
    });

    it("should print chained ends", async () => {
        return expectPrinted("flow from a.b.c to d.e.f {}").resolves.toEqual(
            "flow from a.b.c to d.e.f {}\n"
        );
    });

    it("should ends", async () => {
        return expectPrinted("flow from a.b.c to d.e.f {}").resolves.toEqual(
            "flow from a.b.c to d.e.f {}\n"
        );
    });

    it("should break long chained ends", async () => {
        return expectPrinted(
            `flow
            from some_long_chain1.some_long_chain2.some_long_chain3.some_long_chain4
            to some_long_chain1.some_long_chain2.some_long_chain3.some_long_chain4 {}`,
            {
                options: { lineWidth: 50 },
            }
        ).resolves.toEqual(`flow
    from some_long_chain1.some_long_chain2
        .some_long_chain3.some_long_chain4
    to some_long_chain1.some_long_chain2
        .some_long_chain3.some_long_chain4 {}\n`);
    });

    it("should print succession item flow", async () => {
        return expectPrinted(
            `succession flow 'some long flow name' of 'long item feature name'
                [1] ordered nonunique: 'some item feature typing' = 1 from 'long source end name'
                to 'long destination end name' {}`,
            {
                node: successionType,
                options: { lineWidth: 40 },
            }
        ).resolves.toMatchInlineSnapshot(`
"succession flow 'some long flow name'
    of 'long item feature name'
        : 'some item feature typing'
        [1] ordered nonunique = 1
    from 'long source end name'
    to 'long destination end name' {}
"
`);
    });
});

describe("messages", () => {
    const expectPrinted = (
        text: string,
        context?: DeepPartial<PrinterTestContext> & { node?: SubtypeKeys<Element> }
    ): jest.JestMatchers<Promise<string>> => {
        return expectPrintedAs(text, {
            ...context,
            lang: "sysml",
            node: context?.node ?? FlowConnectionUsage,
        });
    };

    it("should print fitting messages", async () => {
        return expectPrinted("message a of [1] : I = 1 from one to two {}", {}).resolves.toEqual(
            "message a of : I [1] = 1 from one to two {}\n"
        );
    });

    it("should print fitting messages with named item features", async () => {
        return expectPrinted("message a of i [1] : I = 1 from one to two {}", {}).resolves.toEqual(
            "message a of i : I [1] = 1 from one to two {}\n"
        );
    });

    it("should print messages without ends", async () => {
        return expectPrinted("message a  = 3 of [1] : I = 1;").resolves.toEqual(
            "message a = 3 of : I [1] = 1;\n"
        );
    });

    it("should print messages with ends only", async () => {
        return expectPrinted("message a to b;").resolves.toEqual("message a to b;\n");
    });
});

describe("binding connectors as usage", () => {
    const expectPrinted = (
        text: string,
        context?: DeepPartial<PrinterTestContext> & { node?: SubtypeKeys<Element> }
    ): jest.JestMatchers<Promise<string>> => {
        return expectPrintedAs(text, {
            ...context,
            lang: "sysml",
            node: context?.node ?? BindingConnectorAsUsage,
        });
    };

    it("should preserve binding keyword", async () => {
        return expectPrinted("readonly binding B bind one = two {}").resolves.toEqual(
            "readonly binding B bind one = two {}\n"
        );
    });

    it("should preserve missing binding keyword", async () => {
        return expectPrinted("readonly bind one = two {}").resolves.toEqual(
            "readonly bind one = two {}\n"
        );
    });

    it("should add binding keyword if needed", async () => {
        return expectPrinted("readonly binding B bind one = two {}", {
            format: { binding_connector_as_usage_keyword: { default: "as_needed" } },
        }).resolves.toEqual("readonly binding B bind one = two {}\n");
    });

    it("should not add binding keyword if not needed", async () => {
        return expectPrinted("readonly binding bind one = two {}", {
            format: { binding_connector_as_usage_keyword: { default: "as_needed" } },
        }).resolves.toEqual("readonly bind one = two {}\n");
    });
});

describe.each([
    [
        "connection usages",
        ConnectionUsage,
        "connection",
        "connect",
        { multi: "binary_connection_usages", optional: "connection_usage_keyword" },
    ],
    [
        "allocation usages",
        AllocationUsage,
        "allocation",
        "allocate",
        { multi: "binary_allocation_usages", optional: "allocation_usage_keyword" },
    ],
    [
        "interface usages",
        InterfaceUsage,
        "interface",
        "connect",
        { multi: "binary_interface_usages", optional: false },
    ],
] as const)("%s", (_, type, kw, src, { multi, optional }) => {
    const expectPrinted = (
        text: string,
        context?: DeepPartial<PrinterTestContext> & { node?: SubtypeKeys<Element> }
    ): jest.JestMatchers<Promise<string>> => {
        return expectPrintedAs(text, {
            ...context,
            lang: "sysml",
            node: context?.node ?? type,
        });
    };

    it(`should preserve ${kw} keyword`, async () => {
        return expectPrinted(`readonly ${kw} B ${src} one to two { end b; }`).resolves.toEqual(
            `readonly ${kw} B ${src} one to two {
    end b;
}\n`
        );
    });

    if (optional) {
        it(`should preserve missing ${kw} keyword`, async () => {
            return expectPrinted(`readonly ${src} one to two {}`).resolves.toEqual(
                `readonly ${src} one to two {}\n`
            );
        });

        it(`should add ${kw} keyword if needed`, async () => {
            return expectPrinted(`readonly ${kw} B ${src} one to two {}`, {
                format: { [optional]: { default: `as_needed` } },
            }).resolves.toEqual(`readonly ${kw} B ${src} one to two {}\n`);
        });

        it(`should not add ${kw} keyword if not needed`, async () => {
            return expectPrinted(`readonly ${kw} ${src} one to two {}`, {
                format: { [optional]: { default: `as_needed` } },
            }).resolves.toEqual(`readonly ${src} one to two {}\n`);
        });

        it(`should not add an extra leading space without ${kw}`, async () => {
            return expectPrinted(`${kw} ${src} one to two {}`, {
                format: { [optional]: { default: `as_needed` } },
            }).resolves.toEqual(`${src} one to two {}\n`);
        });
    }

    if (multi) {
        it(`should print nary ends`, async () => {
            return expectPrinted(`${kw} A ${src} a to b;`, {
                format: { [multi]: { default: `never` } },
            }).resolves.toEqual(`${kw} A ${src} (a, b);\n`);
        });
    }

    it(`should print no ends`, async () => {
        return expectPrinted(`${kw} A;`).resolves.toEqual(`${kw} A;\n`);
    });
});

describe("interface usage", () => {
    const expectPrinted = (
        text: string,
        context?: DeepPartial<PrinterTestContext> & { node?: SubtypeKeys<Element> }
    ): jest.JestMatchers<Promise<string>> => {
        return expectPrintedAs(text, {
            ...context,
            lang: "sysml",
            node: context?.node ?? InterfaceUsage,
        });
    };

    it("should preserve missing connect keyword in binary interface", () => {
        return expectPrinted(`interface one to two {}`).resolves.toEqual(
            `interface one to two {}\n`
        );
    });

    it("should preserve missing connect keyword in nary interface", () => {
        return expectPrinted(`interface (one, two) {}`).resolves.toEqual(
            `interface (one, two) {}\n`
        );
    });

    it("should add connect keyword in binary interface with declaration", () => {
        return expectPrinted(`interface i connect one to two {}`, {
            format: { interface_usage_connect_keyword: { default: "as_needed" } },
        }).resolves.toEqual(`interface i connect one to two {}\n`);
    });

    it("should add connect keyword in nary interface with declaration", () => {
        return expectPrinted(`interface i connect (one, two) {}`, {
            format: { interface_usage_connect_keyword: { default: "as_needed" } },
        }).resolves.toEqual(`interface i connect (one, two) {}\n`);
    });
});
