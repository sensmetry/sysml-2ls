/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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
    AcceptActionUsage,
    ActionUsage,
    AssignmentActionUsage,
    DecisionNode,
    ForLoopActionUsage,
    ForkNode,
    IfActionUsage,
    JoinNode,
    MergeNode,
    SendActionUsage,
    StateSubactionMembership,
    TerminateActionUsage,
    WhileLoopActionUsage,
} from "../../../generated/ast";
import { parsedNode } from "../../../testing/utils";
import { ExpressionMeta, FeatureValueMeta, ParameterMembershipMeta } from "../../KerML";
import { AssignmentActionUsageMeta, ReferenceUsageMeta } from "../../SysML";
import { basicIdProvider } from "../../metamodel";
import { expectPrinted, printSysMLElement } from "./utils";

describe("assignment actions", () => {
    it("should print fitting actions on one line", async () => {
        return expectPrinted("action { assign a := b; }", {
            node: AssignmentActionUsage,
            lang: "sysml",
        }).resolves.toEqual("assign a := b;\n");
    });

    it("should break at assign", async () => {
        return expectPrinted("action { action 'some long action name here' assign a := b; }", {
            node: AssignmentActionUsage,
            lang: "sysml",
            options: { lineWidth: 40 },
        }).resolves.toEqual(`action 'some long action name here'
    assign a := b;\n`);
    });

    it("should break at assignment", async () => {
        return expectPrinted(
            "action { action 'some long action name here' assign 'some even longer target member name' := b; }",
            {
                node: AssignmentActionUsage,
                lang: "sysml",
                options: { lineWidth: 40 },
            }
        ).resolves.toEqual(`action 'some long action name here'
    assign 'some even longer target member name' :=
        b;\n`);
    });

    it("should break at assignment 2", async () => {
        return expectPrinted(
            `action { action 'disconnect trailer from vehicle' assign 'vehicle-trailer system'
            .trailerHitch := null; }`,
            {
                node: AssignmentActionUsage,
                lang: "sysml",
                options: { lineWidth: 80 },
            }
        ).resolves.toEqual(`action 'disconnect trailer from vehicle'
    assign 'vehicle-trailer system'.trailerHitch := null;\n`);
    });

    it("should not break when assigning sequences", async () => {
        return expectPrinted(
            "action { action 'some long action name here' assign 'some even longer target member name' := (1,2,3,4,5); }",
            {
                node: AssignmentActionUsage,
                lang: "sysml",
                options: { lineWidth: 60 },
            }
        ).resolves.toEqual(`action 'some long action name here'
    assign 'some even longer target member name' := (
        1, 2, 3, 4, 5,
    );\n`);
    });

    it("should print chained members", async () => {
        const node = (
            await parsedNode("action = a.x { assign b := c; }", {
                node: ActionUsage,
                lang: "sysml",
            })
        ).$meta;

        const assignment = node.children[0].element() as AssignmentActionUsageMeta;

        // hoisting the expression from owning action since that is easier than
        // constructing a full expression tree
        assignment.target = [
            ParameterMembershipMeta.create(basicIdProvider(), node.document),
            ReferenceUsageMeta.create(basicIdProvider(), node.document, {
                value: [node.value as FeatureValueMeta, node.value?.element() as ExpressionMeta],
            }),
        ];

        expect(printSysMLElement(assignment)).toEqual("assign a.x.b := c;\n");
    });
});

describe("accept actions", () => {
    it("should print fitting actions on one line", async () => {
        return expectPrinted("action { accept a : x via b; }", {
            node: AcceptActionUsage,
            lang: "sysml",
        }).resolves.toEqual("accept a : x via b;\n");
    });

    it("should break at accept", async () => {
        return expectPrinted("action { action 'some long action name here' accept a via b; }", {
            node: AcceptActionUsage,
            lang: "sysml",
            options: { lineWidth: 40 },
        }).resolves.toEqual(`action 'some long action name here'
    accept a via b;\n`);
    });

    it("should break at via", async () => {
        return expectPrinted(
            "action { action 'some long action name here' accept 'some even longer target member name' via b; }",
            {
                node: AcceptActionUsage,
                lang: "sysml",
                options: { lineWidth: 40 },
            }
        ).resolves.toEqual(`action 'some long action name here'
    accept 'some even longer target member name'
        via b;\n`);
    });

    it.each(["at", "when", "after"])("should print %s payload", async (kind) => {
        return expectPrinted(`action { accept a ${kind} x.y via b; }`, {
            node: AcceptActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`accept a ${kind} x.y via b;\n`);
    });
});

describe.each([
    ["merge", MergeNode],
    ["decide", DecisionNode],
    ["join", JoinNode],
    ["fork", ForkNode],
] as const)("%s control nodes", (kw, type) => {
    it("should print fitting nodes on one line", async () => {
        return expectPrinted(
            `action { in abstract readonly derived end individual snapshot ${kw} node; }`,
            {
                node: type,
                lang: "sysml",
            }
        ).resolves.toEqual(`in abstract readonly derived end individual snapshot ${kw} node;\n`);
    });
});

describe("if actions", () => {
    it("should print if actions", async () => {
        return expectPrinted(`action { action If if (true) { item Then; } else { item Else; } }`, {
            node: IfActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`action If
if true {
    item Then;
} else {
    item Else;
}\n`);
    });

    it("should print if action chains", async () => {
        return expectPrinted(
            `action { action If if (true) { item Then; } else if (false) { item Else; } }`,
            {
                node: IfActionUsage,
                lang: "sysml",
            }
        ).resolves.toEqual(`action If
if true {
    item Then;
} else if false {
    item Else;
}\n`);
    });

    it("should break long condition expression", async () => {
        return expectPrinted(
            `action { action If if (some_long_name.longer_name > some_long_rhs_expression ) { item Then; } }`,
            {
                node: IfActionUsage,
                lang: "sysml",
                options: { lineWidth: 50 },
            }
        ).resolves.toEqual(`action If
if (
    some_long_name.longer_name >
    some_long_rhs_expression
) {
    item Then;
}\n`);
    });

    it("should not parenthesize condition if option is set", async () => {
        return expectPrinted(`action { action If if (true) { } }`, {
            node: IfActionUsage,
            lang: "sysml",
            format: { if_parenthesize_condition: "never" },
        }).resolves.toEqual(`action If if true {}\n`);
    });
});

describe("for loops", () => {
    it("should print for loops", async () => {
        return expectPrinted(`action { action For for i : Integer in my_seq { item I; }}`, {
            node: ForLoopActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`action For for i : Integer in my_seq { item I; }\n`);
    });

    it("should break long declarations", async () => {
        return expectPrinted(
            `action { action For for some_long_loop_variable_name : Integer in some_long_sequence_name { item I; }}`,
            {
                node: ForLoopActionUsage,
                lang: "sysml",
                options: { lineWidth: 40 },
            }
        ).resolves.toEqual(`action For
for some_long_loop_variable_name
        : Integer
    in some_long_sequence_name {
    item I;
}\n`);
    });
});

describe("while loops", () => {
    it("should print conditional while loops", async () => {
        return expectPrinted(`action { action While while (true) { item Body; } }`, {
            node: WhileLoopActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`action While while true { item Body; }\n`);
    });

    it("should print unconditional while loops", async () => {
        return expectPrinted(`action { action Loop loop { item Body; } }`, {
            node: WhileLoopActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`action Loop loop { item Body; }\n`);
    });

    it("should print loops with until condition", async () => {
        return expectPrinted(`action { action Loop loop { item Body; } until (false); }`, {
            node: WhileLoopActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`action Loop
loop {
    item Body;
} until false;\n`);
    });

    it("should preserve action keyword on loop bodies", async () => {
        return expectPrinted(`action { action Loop loop action { item Body; } until (false); }`, {
            node: WhileLoopActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`action Loop
loop action {
    item Body;
} until false;\n`);
    });

    it("should break the loop declaration first", async () => {
        return expectPrinted(`action { action While while (true) { item Body; } }`, {
            node: WhileLoopActionUsage,
            lang: "sysml",
            options: { lineWidth: 30 },
        }).resolves.toEqual(`action While
while true { item Body; }\n`);
    });

    it("should preserve action keyword on while bodies", async () => {
        return expectPrinted(
            `action { action While while (true) action { item Body; } until (false); }`,
            {
                node: WhileLoopActionUsage,
                lang: "sysml",
            }
        ).resolves.toEqual(`action While
while true
    action {
    item Body;
} until false;\n`);
    });

    it("should not parenthesise conditions if options are set", async () => {
        return expectPrinted(`action { action Loop while (true) { } until (false); }`, {
            node: WhileLoopActionUsage,
            lang: "sysml",
            format: {
                while_loop_parenthesize_condition: "never",
                while_loop_parenthesize_until: "never",
            },
        }).resolves.toEqual(`action Loop
while true {
} until false;\n`);
    });

    it("should break long condition expressions", async () => {
        return expectPrinted(
            `action { action some_long_loop_name_here while long_lhs_expression_here > long_rhs_expression_here { item Body; } }`,
            {
                node: WhileLoopActionUsage,
                lang: "sysml",
                options: { lineWidth: 50 },
                format: {
                    while_loop_parenthesize_condition: "never",
                    while_loop_parenthesize_until: "never",
                },
            }
        ).resolves.toMatchInlineSnapshot(`
"action some_long_loop_name_here
while
    long_lhs_expression_here >
    long_rhs_expression_here {
    item Body;
}
"
`);
    });

    it("should parenthesize long condition expressions", async () => {
        return expectPrinted(
            `action { action some_long_loop_name_here while long_lhs_expression_here > long_rhs_expression_here { item Body; } }`,
            {
                node: WhileLoopActionUsage,
                lang: "sysml",
                options: { lineWidth: 56 },
                format: {
                    while_loop_parenthesize_condition: "on_break",
                    while_loop_parenthesize_until: "never",
                },
            }
        ).resolves.toMatchInlineSnapshot(`
"action some_long_loop_name_here
while (
    long_lhs_expression_here > long_rhs_expression_here
) {
    item Body;
}
"
`);
    });
});

describe("send actions", () => {
    it("should print actions", async () => {
        return expectPrinted(`action { action Send send 1 via 2 to 3; }`, {
            node: SendActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`action Send send 1 via 2 to 3;\n`);
    });

    it("should break long actions", async () => {
        return expectPrinted(
            `action { action some_long_action_name send some_long_payload_name via some_long_sender_name to some_long_receiver_name; }`,
            {
                node: SendActionUsage,
                lang: "sysml",
                options: { lineWidth: 40 },
            }
        ).resolves.toEqual(`action some_long_action_name
    send some_long_payload_name
        via some_long_sender_name
        to some_long_receiver_name;\n`);
    });
});

describe.each(["entry", "exit", "do"])("state %s subactions", (kind) => {
    it("should print empty subactions", async () => {
        return expectPrinted(`state { ${kind}; }`, {
            node: StateSubactionMembership,
            lang: "sysml",
        }).resolves.toEqual(`${kind};\n`);
    });

    it("should print perform subactions", async () => {
        return expectPrinted(`state { ${kind} action a = b; }`, {
            node: StateSubactionMembership,
            lang: "sysml",
        }).resolves.toEqual(`${kind} action a = b;\n`);
    });

    it("should print accept subactions", async () => {
        return expectPrinted(`state { ${kind} action a accept b = 3 via x; }`, {
            node: StateSubactionMembership,
            lang: "sysml",
        }).resolves.toEqual(`${kind} action a accept b = 3 via x;\n`);
    });

    it("should print send subactions", async () => {
        return expectPrinted(`state { ${kind} send 1 via 2 to 3; }`, {
            node: StateSubactionMembership,
            lang: "sysml",
        }).resolves.toEqual(`${kind} send 1 via 2 to 3;\n`);
    });

    it("should print assign subactions", async () => {
        return expectPrinted(`state { ${kind} action a assign b := x.y; }`, {
            node: StateSubactionMembership,
            lang: "sysml",
        }).resolves.toEqual(`${kind} action a assign b := x.y;\n`);
    });

    it("should indent assign subaction values once", async () => {
        return expectPrinted(`state { ${kind} assign b := x.y; }`, {
            node: StateSubactionMembership,
            lang: "sysml",
            options: { lineWidth: 15 },
        }).resolves.toEqual(`${kind} assign b :=
    x.y;\n`);
    });
});

describe("terminate actions", () => {
    it("terminate actions are printed", async () => {
        return expectPrinted(`action c1 { terminate c1; }`, {
            node: TerminateActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`terminate c1;\n`);
    });

    it("empty terminate actions are printed", async () => {
        return expectPrinted(`action c1 { terminate; }`, {
            node: TerminateActionUsage,
            lang: "sysml",
        }).resolves.toEqual(`terminate;\n`);
    });

    it("long actions are broken", async () => {
        return expectPrinted(
            `action some_long_terminate_name { action some_long_action_name terminate some_long_terminate_name; }`,
            {
                node: TerminateActionUsage,
                lang: "sysml",
                options: { lineWidth: 40 },
            }
        ).resolves.toEqual(`action some_long_action_name
    terminate some_long_terminate_name;\n`);
    });
});
