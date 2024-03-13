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

import { Feature, FeatureValue, Namespace } from "../../../generated/ast";
import { parsedNode } from "../../../testing/utils";
import {
    ExpressionMeta,
    LiteralBooleanMeta,
    LiteralInfinityMeta,
    LiteralNumberMeta,
    LiteralStringMeta,
    NullExpressionMeta,
} from "../../KerML";
import { expectPrinted, makeEmpty, printKerMLElement, printSysMLElement } from "./utils";

const parseExpr = async (expr: string): Promise<ExpressionMeta> => {
    const e = (
        await parsedNode(`feature a = ${expr};`, { lang: "kerml", node: Feature })
    ).$meta.value?.element();
    expect(e).toBeDefined();
    return e as ExpressionMeta;
};

describe("literal boolean", () => {
    let node: LiteralBooleanMeta;
    beforeEach(() => {
        node = makeEmpty(LiteralBooleanMeta);
    });

    it.each([
        [true, "true"],
        [false, "false"],
    ])("should format %s", (value, text) => {
        node.literal = value;
        expect(printSysMLElement(node)).toEqual(text + "\n");
    });
});

describe("literal string", () => {
    let node: LiteralStringMeta;
    beforeEach(() => {
        node = makeEmpty(LiteralStringMeta);
    });

    it.each([
        ["hello", "hello"],
        ["\tworld", "\\tworld"],
    ])("should format %s", (value, text) => {
        node.literal = value;
        expect(printSysMLElement(node)).toEqual(`"${text}"\n`);
    });
});

describe("literal infinity", () => {
    let node: LiteralInfinityMeta;
    beforeEach(() => {
        node = makeEmpty(LiteralInfinityMeta);
    });

    it("should format", () => {
        expect(printSysMLElement(node)).toEqual("*\n");
    });
});

describe("literal number", () => {
    let node: LiteralNumberMeta;
    beforeEach(() => {
        node = makeEmpty(LiteralNumberMeta);
    });

    describe("integer", () => {
        it("should format as integer", () => {
            node.literal = 42;
            expect(printSysMLElement(node)).toEqual("42\n");
        });
    });

    describe("real", () => {
        it.each([
            ["exp", "1.23456789e+0"],
            ["prec", "1.23456789"],
            ["none", "1.23456789"],
        ] as const)("should format as %s", (type, expected) => {
            node.literal = 1.23456789;
            expect(
                printSysMLElement(node, {
                    format: {
                        literal_real: type,
                    },
                })
            ).toEqual(`${expected}\n`);
        });
    });
});

describe("null expression", () => {
    let node: NullExpressionMeta;
    beforeEach(() => {
        node = makeEmpty(NullExpressionMeta);
    });

    it.each([
        [{ default: "null" }, "null"],
        [{ default: "brackets" }, "()"],
        [{ default: "preserve", fallback: "null" }, "null"],
        [{ default: "preserve", fallback: "brackets" }, "()"],
    ] as const)("should format as %s", (type, expected) => {
        expect(
            printKerMLElement(node, {
                format: {
                    null_expression: type,
                },
            })
        ).toEqual(expected + "\n");
    });

    it("should format with notes all on the same line", async () => {
        const node = await parsedNode(
            "feature a = //* leading */ ( //* inner */ ) // trailing\n;",
            {
                lang: "kerml",
                node: FeatureValue,
            }
        );

        expect(printKerMLElement(node.$meta)).toEqual(
            "= //* leading */ () //* inner */ // trailing\n"
        );
    });
});

describe("operator expressions", () => {
    it("should print all nested expressions with same precedences in the same group", async () => {
        const node = await parseExpr(
            "123456789.123456789 + 123456789.123456789 + 123456789.123456789"
        );

        expect(printKerMLElement(node, { options: { lineWidth: 10 } })).toEqual(
            "123456789.123456789 +\n123456789.123456789 +\n123456789.123456789\n"
        );
    });

    it("should preserve parentheses around parenthesized rhs subexpressions", async () => {
        const node = await parseExpr("42 +   (42-42)");
        expect(printKerMLElement(node)).toEqual("42 + (42 - 42)\n");
    });

    it("should print expressions with mixed precedences", async () => {
        const node = await parseExpr("1 * 2 + 3 % 4 * 5");
        expect(printKerMLElement(node)).toEqual("1 * 2 + (3 % 4) * 5\n");
    });

    it("should indent broken subexpressions", async () => {
        const node = await parseExpr("12314 + ( 123123 - 12313212)");
        expect(printKerMLElement(node, { options: { lineWidth: 10 } })).toMatchInlineSnapshot(`
"12314 +
(123123 -
    12313212)
"
`);
    });

    it.each([
        " + ",
        " - ",
        " ?? ",
        " implies ",
        " or ",
        " | ",
        " xor ",
        " and ",
        " & ",
        " < ",
        " > ",
        " <= ",
        " >= ",
        " * ",
        " / ",
        ".",
    ])("should print binary %s expression", async (op) => {
        const node = await parseExpr(`lhs ${op} mid ${op} rhs`);
        expect(printKerMLElement(node)).toEqual(`lhs${op}mid${op}rhs\n`);
    });

    describe.each([".?", "."])("%s binary expressions", (op) => {
        it("should print with bracket spacing", async () => {
            const node = await parseExpr(`lhs ${op} { rhs }`);
            expect(printKerMLElement(node)).toEqual(`lhs${op}{ rhs }\n`);
        });

        it("should print without bracket spacing", async () => {
            const node = await parseExpr(`lhs ${op} { rhs }`);
            expect(printKerMLElement(node, { format: { bracket_spacing: false } })).toEqual(
                `lhs${op}{rhs}\n`
            );
        });

        it("should leave brackets on the same when contents break", async () => {
            const node = await parseExpr(`lhs ${op} {\n rhs }`);
            expect(printKerMLElement(node, { format: { bracket_spacing: false } })).toEqual(
                `lhs${op}{
    rhs
}\n`
            );
        });
    });

    it.each(["..", " meta ", " istype ", " hastype ", " @ ", " @@ ", " as "])(
        "should print pure binary %s expression",
        async (op) => {
            const node = await parseExpr(`lhs ${op} rhs`);
            expect(printKerMLElement(node)).toEqual(`lhs${op}rhs\n`);
        }
    );

    it.each([" == ", " === ", " != ", " !== ", " % ", "**", "^"])(
        "should parenthesize print binary %s expression",
        async (op) => {
            const node = await parseExpr(`lhs ${op} mid ${op} rhs`);
            expect(printKerMLElement(node)).toEqual(`(lhs${op}mid)${op}rhs\n`);
        }
    );

    describe("format options", () => {
        it("should break before the operator for common operators", async () => {
            const node = await parseExpr("12314 + ( 123123 - 12313212)");
            expect(
                printKerMLElement(node, {
                    format: { operator_break: "before" },
                    options: { lineWidth: 10 },
                })
            ).toMatchInlineSnapshot(`
"12314
+ (123123
    - 12313212)
"
`);
        });

        it("should break before the operator for operators without surrounding whitespace", async () => {
            const node = await parseExpr("1234567890 ** 1234567890");
            expect(
                printKerMLElement(node, {
                    format: { operator_break: "before" },
                    options: { lineWidth: 10 },
                })
            ).toEqual("1234567890\n    **1234567890\n");
        });
    });

    describe("conditional expressions", () => {
        it("should print them on the same line if they fit", async () => {
            const node = await parseExpr("if 1 ? 2 else 3");
            expect(printKerMLElement(node)).toEqual("if 1 ? 2 else 3\n");
        });

        it("should parenthesize conditional tests", async () => {
            const node = await parseExpr("if (if true ? 0 else 1) ? 2 else 3");
            expect(printKerMLElement(node)).toEqual("if (if true ? 0 else 1) ? 2 else 3\n");
        });

        it("should break them if they don't fit", async () => {
            const node = await parseExpr('if "some long string even longer"  ? 2 else 3');
            expect(printKerMLElement(node, { options: { lineWidth: 15 } })).toEqual(
                'if "some long string even longer"\n    ?    2\n    else 3\n'
            );
        });

        it("should print chained conditional expressions on the same indent", async () => {
            const node = await parseExpr(
                'if "some long string even longer"  ? 2 else if true ? 3 else if false ? 4 else 5'
            );
            expect(printKerMLElement(node, { options: { lineWidth: 15 } })).toMatchInlineSnapshot(`
"if "some long string even longer"
    ?    2
    else if true
    ?    3
    else if false
    ?    4
    else 5
"
`);
        });
    });

    describe.each([
        ["+", "+"],
        ["-", "-"],
        ["~", "~"],
        ["not", "not "],
        ["all", "all "],
    ] as const)("unary %s expressions", (op, expected) => {
        it("should print expressions", async () => {
            const node = await parseExpr(`${op}        '42'`);
            expect(printKerMLElement(node)).toEqual(`${expected}'42'\n`);
        });

        if (op !== "all") {
            it("should parenthesize inner expressions", async () => {
                const node = await parseExpr(`${op}        ('42' + 1)`);
                expect(printKerMLElement(node)).toEqual(`${expected}('42' + 1)\n`);
            });

            it("should not parenthesize inner sequence expressions", async () => {
                const node = await parseExpr(`${op}        ('42', 1)`);
                expect(printKerMLElement(node)).toEqual(`${expected}('42', 1)\n`);
            });
        }
    });

    describe("arrow expressions", () => {
        describe("short expressions", () => {
            it("should print function reference on one line", async () => {
                const node = await parseExpr("42  -> select  'function'");
                expect(printKerMLElement(node)).toEqual("42->select 'function'\n");
            });

            it("should print body expression on one line", async () => {
                const node = await parseExpr("42  -> select   {   }");
                expect(printKerMLElement(node)).toEqual("42->select {}\n");
            });

            it("should print positional argument list on one line", async () => {
                const node = await parseExpr("42  -> select   ( 1, 2,3)");
                expect(printKerMLElement(node)).toEqual("42->select(1, 2, 3)\n");
            });

            it("should print empty parameter lists", async () => {
                const node = await parseExpr("42  -> select   ( )");
                expect(printKerMLElement(node)).toEqual("42->select()\n");
            });

            it("should print named argument list on one line", async () => {
                const node = await parseExpr("42  -> select   ( a=1, b=2,c=3)");
                expect(printKerMLElement(node)).toEqual("42->select(a=1, b=2, c=3)\n");
            });
        });

        describe("long expressions", () => {
            it("should print function reference", async () => {
                const node = await parseExpr("42  -> select  'function'");
                expect(printKerMLElement(node, { options: { lineWidth: 12 } })).toEqual(
                    "42->select\n    'function'\n"
                );
            });

            it("should print body expression on", async () => {
                const node = await parseExpr("42  -> select   {  true }");
                expect(printKerMLElement(node, { options: { lineWidth: 11 } }))
                    .toMatchInlineSnapshot(`
"42->select {
    true
}
"
`);
            });

            it("should print positional argument list", async () => {
                const node = await parseExpr("42  -> select   ( 1,2,3)");
                expect(printKerMLElement(node, { options: { lineWidth: 11 } }))
                    .toMatchInlineSnapshot(`
"42->select(
    1,
    2,
    3
)
"
`);
            });

            it("should print named argument list", async () => {
                const node = await parseExpr("42  -> select   ( a=1, b=2,c=3)");
                expect(printKerMLElement(node, { options: { lineWidth: 12 } }))
                    .toMatchInlineSnapshot(`
"42->select(
    a = 1,
    b = 2,
    c = 3
)
"
`);
            });

            it("should parenthesize compound lhs expression", async () => {
                const node = await parseExpr("(42 + 11)  -> select   {  true }");
                expect(printKerMLElement(node, { options: { lineWidth: 20 } }))
                    .toMatchInlineSnapshot(`
"(42 + 11)->select {
    true
}
"
`);
            });
        });

        it("should print expressions nested inside binary expressions", async () => {
            const node = await parseExpr("42  -> select   ( ) #(1)");
            expect(printKerMLElement(node)).toEqual("42->select()#(1)\n");
        });

        it("should not parenthesize first argument sequence expressions", async () => {
            const node = await parseExpr("(42, 43)  -> select   ( ) #(1)");
            expect(printKerMLElement(node)).toEqual("(42, 43)->select()#(1)\n");
        });
    });

    describe("metadata access expressions", () => {
        it("should print fitting expressions on one line", async () => {
            const node = await parseExpr("val  . metadata");
            expect(printKerMLElement(node)).toEqual("val.metadata\n");
        });

        it("should print breaking expressions", async () => {
            const node = await parseExpr("'some long name that doesnt fit'  . metadata");
            expect(printKerMLElement(node, { options: { lineWidth: 15 } })).toEqual(
                "'some long name that doesnt fit'\n    .metadata\n"
            );
        });
    });

    describe("expressions", () => {
        it("should print short index expressions", async () => {
            const node = await parseExpr("val # ( 500 )");
            expect(printKerMLElement(node)).toEqual("val#(500)\n");
        });

        it("should break long index expressions", async () => {
            const node = await parseExpr("'some long expression' # ( 500 )");
            expect(printKerMLElement(node, { options: { lineWidth: 10 } })).toEqual(
                "'some long expression'#(\n    500\n)\n"
            );
        });
    });

    describe("quantity expressions", () => {
        it("should print short quantity expressions", async () => {
            const node = await parseExpr("val [ meter ]");
            expect(printKerMLElement(node)).toEqual("val [meter]\n");
        });

        it("should break long quantity expressions", async () => {
            const node = await parseExpr("'some long expression' [ meter]");
            expect(printKerMLElement(node, { options: { lineWidth: 10 } })).toEqual(
                "'some long expression' [\n    meter\n]\n"
            );
        });
    });

    describe("sequence expressions", () => {
        it("should print short sequence expressions", async () => {
            const node = await parseExpr("( 1, 2, 3, 4, 5,)");
            expect(printKerMLElement(node)).toEqual("(1, 2, 3, 4, 5)\n");
        });

        it("should not parenthesize inner expressions", async () => {
            const node = await parseExpr("( 1, 2, 3 + 4, 4, 5,)");
            expect(printKerMLElement(node)).toEqual("(1, 2, 3 + 4, 4, 5)\n");
        });

        it("should not parenthesize sequence expressions a second time", async () => {
            const node = await parseExpr("( 1, 2, 3 + 4, 4, 5,) #(0)");
            expect(printKerMLElement(node)).toEqual("(1, 2, 3 + 4, 4, 5)#(0)\n");
        });

        it("should break long sequence expressions", async () => {
            const node = await parseExpr("(long_value1, long_value2, long_value3)");
            expect(printKerMLElement(node, { options: { lineWidth: 10 } })).toEqual(
                `(
    long_value1,
    long_value2,
    long_value3,
)
`
            );
        });

        it("should not add trailing comma to broken expressions if option is not set", async () => {
            const node = await parseExpr("(long_value1, long_value2, long_value3)");
            expect(
                printKerMLElement(node, {
                    format: { sequence_expression_trailing_comma: false },
                    options: { lineWidth: 10 },
                })
            ).toEqual(
                `(
    long_value1,
    long_value2,
    long_value3
)
`
            );
        });
    });

    describe("chain expressions", () => {
        it("should print short expressions", async () => {
            const node = await parseExpr("value1.value2.value3");
            expect(printKerMLElement(node)).toEqual("value1.value2.value3\n");
        });

        it("should break long expressions", async () => {
            const node = await parseExpr("long_value1.long_value2.long_value3.val4");
            expect(printKerMLElement(node, { options: { lineWidth: 25 } })).toEqual(
                "long_value1.long_value2\n    .long_value3.val4\n"
            );
        });

        it("should correctly print references", () => {
            return expectPrinted(
                `
                    calc acc : Acceleration {
                        return a = a_out;
                    }
            
                    calc vel : Velocity {
                        in a = acc.a;
                    }
                `,
                {
                    build: true,
                    lang: "sysml",
                    node: Namespace,
                }
            ).resolves.toMatchInlineSnapshot(`
"calc acc : Acceleration {
    return a = a_out;
}

calc vel : Velocity {
    in a = acc.a;
}
"
`);
        });
    });

    describe.each(["@@", "meta"])("%s expressions", (op) => {
        it("should print short expressions", async () => {
            const node = await parseExpr(`left ${op} right`);
            expect(printKerMLElement(node)).toEqual(`left ${op} right\n`);
        });

        it("should break long expressions", async () => {
            const node = await parseExpr(`left_long_name ${op} right`);
            expect(printKerMLElement(node, { options: { lineWidth: 10 } })).toEqual(
                `left_long_name ${op}\nright\n`
            );
        });
    });

    describe("self reference expressions", () => {
        it("should not print self reference expressions", async () => {
            const node = await parseExpr("as right");
            expect(printKerMLElement(node)).toEqual("as right\n");
        });
    });

    describe("equality expressions", () => {
        it("should print short expressions", async () => {
            const node = await parseExpr("left == middle != right");
            expect(printKerMLElement(node)).toEqual("(left == middle) != right\n");
        });

        it("should break long expressions", async () => {
            const node = await parseExpr("left == middle != right");
            expect(printKerMLElement(node, { options: { lineWidth: 20 } })).toEqual(
                "(left == middle) !=\nright\n"
            );
        });
    });
});

describe("invocation expressions", () => {
    it("should print fitting expressions on one line", async () => {
        const node = await parseExpr("some_func ( 1, 2 , 3)");
        expect(printKerMLElement(node)).toEqual("some_func(1, 2, 3)\n");
    });

    it("should break arguments if they don't fit", async () => {
        const node = await parseExpr("some_func ( 1, 2 , 3)");
        expect(printKerMLElement(node, { options: { lineWidth: 10 } })).toEqual(
            `some_func(
    1,
    2,
    3
)\n`
        );
    });

    it("should break long named arguments", async () => {
        const node = await parseExpr(
            "some_func ( 'some long arg name'=(1,2,3,4,5,6,7,8,9,10), b=2 , c=3)"
        );
        expect(printKerMLElement(node, { options: { lineWidth: 30 } })).toEqual(
            `some_func(
    'some long arg name' = (
        1, 2, 3, 4, 5, 6, 7, 8,
        9, 10,
    ),
    b = 2,
    c = 3
)\n`
        );
    });
});
