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
import { Namespace, SuccessionAsUsage, TransitionUsage } from "../../../generated/ast";
import { printDoc } from "../../../utils";
import { StateUsageMeta } from "../../SysML";
import { defaultSysMLPrinterContext, printModelElement } from "../print";
import { PrinterTestContext, expectPrinted } from "./utils";
import { parsedNode } from "../../../testing/utils";

describe("successions", () => {
    it("should print regular successions", async () => {
        return expectPrinted("readonly succession first a then b;", {
            lang: "sysml",
            node: SuccessionAsUsage,
        }).resolves.toEqual("readonly succession first a then b;\n");
    });

    it("should print empty successions", async () => {
        return expectPrinted("action { first start; then action a; }", {
            lang: "sysml",
            node: SuccessionAsUsage,
        }).resolves.toEqual("then\n");
    });

    it("should print empty successions with multiplicity source", async () => {
        return expectPrinted("action { first start; then [1] action a; }", {
            lang: "sysml",
            node: SuccessionAsUsage,
        }).resolves.toEqual("then [1]\n");
    });

    it("should print target successions", async () => {
        return expectPrinted("action { first start; then [1] b; }", {
            lang: "sysml",
            node: SuccessionAsUsage,
        }).resolves.toEqual("then [1] b;\n");
    });

    it("should print transition successions", async () => {
        // this should parse the second child using EntryTransitionMember rule but we
        // had to flatten the body fragment due to a bug in Langium, the second
        // child is parsed from TargetTransitionUsage instead
        const node = (
            await parsedNode("state { entry; public then b; }", {
                lang: "sysml",
                node: SuccessionAsUsage,
            })
        ).$meta;
        const entry = (
            (
                node.document.parseResult.value as Namespace
            ).$meta.children[0].element() as StateUsageMeta
        ).children[0];

        return expect(
            printDoc(
                printModelElement(node, defaultSysMLPrinterContext(), { previousSibling: entry })
            ).text
        ).toEqual("then b;\n");
    });
});

describe("transition usages", () => {
    describe("inside actions", () => {
        const expectPrintedAs = (
            text: string,
            options: DeepPartial<Omit<PrinterTestContext, "lang" | "node">> = {}
        ): jest.JestMatchers<Promise<string>> => {
            return expectPrinted(`action { ${text} }`, {
                lang: "sysml",
                node: TransitionUsage,
                ...options,
            });
        };

        it("should print guarded successions", async () => {
            return expectPrintedAs("succession S first a.b if true then x;").resolves.toEqual(
                "succession S first a.b if true then x;\n"
            );
        });

        it("should break long guarded successions", async () => {
            return expectPrintedAs(
                `
first long_rhs_usage_name.long_rhs_usage_name
if some_long_condition_here > some_long_value_here
then some_long_then_succession_here {
    item I;
}`,
                { options: { lineWidth: 40 } }
            ).resolves.toMatchInlineSnapshot(`
"first long_rhs_usage_name
        .long_rhs_usage_name
    if (
        some_long_condition_here >
        some_long_value_here
    )
        then some_long_then_succession_here {
    item I;
}
"
`);
        });

        it("should print guarded target successions", async () => {
            return expectPrintedAs("first start; if true then x;").resolves.toEqual(
                "if true then x;\n"
            );
        });

        it("should break long guarded target successions", async () => {
            return expectPrintedAs(
                `
first start;
if some_long_condition_here > some_long_value_here
then some_long_then_succession_here {
    item I;
}`,
                { options: { lineWidth: 40 } }
            ).resolves.toMatchInlineSnapshot(`
"if (
    some_long_condition_here >
    some_long_value_here
)
    then some_long_then_succession_here {
    item I;
}
"
`);
        });

        it("should print default target succession", async () => {
            return expectPrintedAs("first x; else x { item I; }").resolves.toMatchInlineSnapshot(`
"else x {
    item I;
}
"
`);
        });
    });

    describe("inside states", () => {
        const expectPrintedAs = (
            text: string,
            options: DeepPartial<Omit<PrinterTestContext, "lang" | "node">> = {}
        ): jest.JestMatchers<Promise<string>> => {
            return expectPrinted(`state { ${text} }`, {
                lang: "sysml",
                node: TransitionUsage,
                ...options,
            });
        };

        it("should print transition usage", async () => {
            return expectPrintedAs(
                "transition first x accept a if true do something then last;"
            ).resolves.toEqual("transition first x accept a if true do something then last;\n");
        });

        it("should break long transition usage", async () => {
            return expectPrintedAs(
                `transition some_long_transition_name
                first some_long_first_name
                accept some_long_accepter_name
                if some_long_lhs_variable > some_long_rhs_variable
                do some_long_effect_name
                then some_long_then_name;`,
                { options: { lineWidth: 40 } }
            ).resolves.toMatchInlineSnapshot(`
"transition some_long_transition_name
    first some_long_first_name
    accept some_long_accepter_name
    if (
        some_long_lhs_variable >
        some_long_rhs_variable
    )
        do some_long_effect_name
    then some_long_then_name;
"
`);
        });

        it("should break long transition usage without effect", async () => {
            return expectPrintedAs(
                `transition some_long_transition_name
                first some_long_first_name
                accept some_long_accepter_name
                if some_long_lhs_variable > some_long_rhs_variable
                then some_long_then_name;`,
                { options: { lineWidth: 40 } }
            ).resolves.toMatchInlineSnapshot(`
"transition some_long_transition_name
    first some_long_first_name
    accept some_long_accepter_name
    if (
        some_long_lhs_variable >
        some_long_rhs_variable
    )
        then some_long_then_name;
"
`);
        });

        it("should break long transition usage without guard", async () => {
            return expectPrintedAs(
                `transition some_long_transition_name
                first some_long_first_name
                accept some_long_accepter_name
                do some_long_effect_name
                then some_long_then_name;`,
                { options: { lineWidth: 40 } }
            ).resolves.toMatchInlineSnapshot(`
"transition some_long_transition_name
    first some_long_first_name
    accept some_long_accepter_name
    do some_long_effect_name
    then some_long_then_name;
"
`);
        });

        it("should print transition usage without first", async () => {
            return expectPrintedAs("transition first x accept a if true do something then last;", {
                format: { transition_usage_first_keyword: { default: "as_needed" } },
            }).resolves.toEqual("transition x accept a if true do something then last;\n");
        });

        it("should print target transition usage", async () => {
            return expectPrintedAs("accept a if true do something then last;").resolves.toEqual(
                "accept a if true do something then last;\n"
            );
        });

        it("should break long target transition usage", async () => {
            return expectPrintedAs(
                `transition
                accept some_long_accepter_name
                if some_long_lhs_variable > some_long_rhs_variable
                do some_long_effect_name
                then some_long_then_name;`,
                { options: { lineWidth: 40 } }
            ).resolves.toMatchInlineSnapshot(`
"transition
    accept some_long_accepter_name
    if (
        some_long_lhs_variable >
        some_long_rhs_variable
    )
        do some_long_effect_name
    then some_long_then_name;
"
`);
        });

        it("should break long target transition usage without effect", async () => {
            return expectPrintedAs(
                `
                accept some_long_accepter_name
                if some_long_lhs_variable > some_long_rhs_variable
                then some_long_then_name;`,
                { options: { lineWidth: 40 } }
            ).resolves.toMatchInlineSnapshot(`
"accept some_long_accepter_name
    if (
        some_long_lhs_variable >
        some_long_rhs_variable
    )
        then some_long_then_name;
"
`);
        });

        it("should break long target ransition usage without guard", async () => {
            return expectPrintedAs(
                `transition
                do some_long_effect_name
                then some_long_then_name;`,
                {
                    options: { lineWidth: 40 },
                    format: { transition_usage_keyword: { default: "as_needed" } },
                }
            ).resolves.toMatchInlineSnapshot(`
"transition
    do some_long_effect_name
    then some_long_then_name;
"
`);
        });

        it("should print guarded target successions", async () => {
            return expectPrintedAs("entry start; if true then x;").resolves.toEqual(
                "if true then x;\n"
            );
        });
    });

    it("should preserve comments inside", () => {
        return expectPrinted(
            `state {
                accept rs : ResultGiveItems
                // a note
                then Wait;
            }`,
            {
                node: TransitionUsage,
                lang: "sysml",
            }
        ).resolves.toEqual(`accept rs : ResultGiveItems
    // a note
    then Wait;\n`);
    });
});

describe("succession actions", () => {
    const expectPrintedAs = (
        text: string,
        options: DeepPartial<Omit<PrinterTestContext, "lang" | "node">> = {}
    ): jest.JestMatchers<Promise<string>> => {
        return expectPrinted(text, {
            lang: "sysml",
            node: Namespace,
            ...options,
        });
    };

    it("should print empty succession usage", () => {
        return expectPrintedAs(
            "part def P  { then    [ * ]    occurrence O : A {} }"
        ).resolves.toEqual(
            `part def P {
    then [*] occurrence O : A {}
}\n`
        );
    });
    it("should print action nodes", () => {
        return expectPrintedAs(
            `
        action a1 {
            first start;
            then    send    S()   via A     to b;
            then    accept     when    b.f;
            then    decide;
                if true
                    then m;
                else done;
        }`
        ).resolves.toEqual(
            `action a1 {
    first start;
    then send S() via A to b;
    then accept when b.f;
    then decide;
        if true then m;
        else done;
}\n`
        );
    });

    it("should print simple succession", () => {
        return expectPrintedAs(
            `
        action def ControlNodeTest {
            action   A1;
            then   J;
            

            then B1;
        }`
        ).resolves.toEqual(
            `action def ControlNodeTest {
    action A1;
    then J;

    then B1;
}\n`
        );
    });

    it("should print succession to action body", () => {
        return expectPrintedAs(
            `
            action def TakePicture {
                in item scene : Scene;
                out item picture : Picture;
        
                action focus : Focus {
                    in item scene = TakePicture::scene;
                    out item image;
                }
        
                flow from focus.image to shoot.image;
        
                then action shoot : Shoot {
                    in item;
                    out item picture = TakePicture::picture;
                }
            }`
        ).resolves.toEqual(
            `action def TakePicture {
    in item scene : Scene;
    out item picture : Picture;

    action focus : Focus {
        in item scene = TakePicture::scene;
        out item image;
    }

    flow from focus.image to shoot.image;

    then action shoot : Shoot {
        in item;
        out item picture = TakePicture::picture;
    }
}\n`
        );
    });

    it("should print transition usage", () => {
        return expectPrintedAs(
            `
                action A {
            first focus 
                if focus.image.isWellFocused then shoot;
                }`
        ).resolves.toEqual(
            `action A {
    first focus if focus.image.isWellFocused then shoot;
}\n`
        );
    });

    it("shouldprint forked successions", () => {
        return expectPrintedAs(
            `
            action def Brake {
                action TurnOn;
                
                then fork;
                    then monitorBrakePedal;
                    then monitorTraction;
                    then braking;
                    then action A;
                
                action monitorBrakePedal : MonitorBrakePedal;
                then joinNode;
                
                action monitorTraction : MonitorTraction;
                then joinNode;

                action braking : Braking;
                then joinNode;
                
                join joinNode;
                then done;
            }`
        ).resolves.toEqual(
            `action def Brake {
    action TurnOn;

    then fork;
        then monitorBrakePedal;
        then monitorTraction;
        then braking;
        then action A;

    action monitorBrakePedal : MonitorBrakePedal;
    then joinNode;

    action monitorTraction : MonitorTraction;
    then joinNode;

    action braking : Braking;
    then joinNode;

    join joinNode;
    then done;
}\n`
        );
    });

    it("should print decision transitions", () => {
        return expectPrintedAs(
            `
            action a1 {
                first start;
                then decide;
                if true
                    then m;
                    else done;
                then action a;
            }`
        ).resolves.toEqual(
            `action a1 {
    first start;
    then decide;
        if true then m;
        else done;
    then action a;
}\n`
        );
    });

    it("should print nested decision transitions", () => {
        return expectPrintedAs(
            `
            action a1 {
                first start;
                then decide;
                then decide;
                    if true
                        then m;
                        else done;
                then done;
                first x then b;
            }`
        ).resolves.toEqual(
            `action a1 {
    first start;
    then decide;
        then decide;
            if true then m;
            else done;
        then done;
    first x then b;
}\n`
        );
    });

    it("should not indent successions after merge and join nodes", () => {
        return expectPrintedAs(
            `
            action a1 {
                first start;
                then join;
                then merge;
                then done;
            }`
        ).resolves.toEqual(
            `action a1 {
    first start;
    then join;
    then merge;
    then done;
}\n`
        );
    });
});
