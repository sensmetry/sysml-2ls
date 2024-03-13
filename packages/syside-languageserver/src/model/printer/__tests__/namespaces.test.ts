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
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import {
    Type,
    Feature,
    Classifier,
    Expression,
    Invariant,
    Multiplicity,
    MultiplicityRange,
    Namespace,
    Package,
    LibraryPackage,
    PartUsage,
    Association,
    AssociationStructure,
    Behavior,
    BooleanExpression,
    Class,
    DataType,
    Interaction,
    Metaclass,
    Predicate,
    Structure,
    Step,
    SysMLFunction,
    OwningMembership,
} from "../../../generated/ast";
import { expectPrinted as expectPrintedAs } from "./utils";

const expectPrinted = (
    text: string,
    context?: Partial<Parameters<typeof expectPrintedAs>[1]>
): jest.JestMatchers<Promise<string>> => {
    return expectPrintedAs(text, {
        ...context,
        lang: context?.lang ?? "kerml",
        node: context?.node ?? Type,
    });
};

describe("type formatting", () => {
    it("should remove unnesseccery quotes from identifiers", async () => {
        return expectPrinted("type 'a' specializes 'b' { }").resolves.toEqual(
            "type a specializes b {}\n"
        );
    });

    it("should preserve unnesseccery quotes from identifiers", async () => {
        return expectPrinted("type 'a' specializes 'b' { }", {
            format: { strip_unnecessary_quotes: false },
        }).resolves.toEqual("type 'a' specializes 'b' {}\n");
    });

    it("should print fitting declarations on one line", async () => {
        return expectPrinted("abstract #prefix type a specializes b unions c { type d :> e { } }")
            .resolves.toMatchInlineSnapshot(`
"abstract #prefix type a specializes b unions c {
    type d :> e {}
}
"
`);
    });

    it("should break at type declarations first", async () => {
        return expectPrinted("abstract #prefix type a specializes b unions c { type d :> e { } }", {
            options: { lineWidth: 40 },
        }).resolves.toMatchInlineSnapshot(`
"abstract #prefix type a
    specializes b unions c {
    type d :> e {}
}
"
`);
    });

    it("should break long specalization lists", async () => {
        return expectPrinted(
            `feature some_long_identifier_here
            :> some_long_identifier_subsetting
            :>> some_long_identifier_redefinition
            { }`,
            {
                options: { lineWidth: 40 },
                node: Feature,
            }
        ).resolves.toMatchInlineSnapshot(`
"feature some_long_identifier_here
    :> some_long_identifier_subsetting
    :>>
        some_long_identifier_redefinition {}
"
`);
    });

    it("should break modifiers and prefixes if needed", async () => {
        return expectPrinted("abstract #prefix type a specializes b unions c { type d :> e { } }", {
            options: { lineWidth: 20 },
        }).resolves.toMatchInlineSnapshot(`
"abstract #prefix
type a
    specializes b
    unions c {
    type d :> e {}
}
"
`);
    });

    it("should merge mergeable type relationships", async () => {
        return expectPrinted("type a :> b unions c intersects d unions e {}", {
            format: { merge_unioning: true },
        }).resolves.toMatchInlineSnapshot(`
"type a :> b unions c, e intersects d {}
"
`);
    });

    it.each([
        "unions",
        "differences",
        "intersects",
        "disjoint from",
        "featured by",
        "redefines",
        "subsets",
        "typed by",
    ] as const)("should merge sequential %s relationships", async (token) => {
        return expectPrinted(`feature all a ${token} c  ${token} e;`, {
            node: Feature,
        }).resolves.toEqual(`feature all a ${token} c, e;\n`);
    });

    it("should not merge sequential conjugation", async () => {
        return expectPrinted("type a conjugates b ~ c {}", {}).resolves.toMatchInlineSnapshot(`
"type a conjugates b ~ c {}
"
`);
    });

    it("should merge sequential feature chaining", async () => {
        return expectPrinted("feature a chains a chains b {}", { node: Feature }).resolves.toEqual(
            "feature a chains a.b {}\n"
        );
    });

    it.each(["inverse of", "references"] as const)(
        "should not merge sequential %s relationship",
        async (token) => {
            return expectPrinted(`feature a ${token} b ${token} c {}`, {
                node: Feature,
            }).resolves.toEqual(`feature a ${token} b ${token} c {}\n`);
        }
    );

    it.each([
        ["specializes", ":>", "declaration_specialization"],
        ["conjugates", "~", "declaration_conjuation"],
    ] as const)("should replace %s with token", async (_, token, prop) => {
        return expectPrinted(`classifier a ${token} c;`, {
            format: { [prop]: { default: "token" } },
            node: Classifier,
        }).resolves.toEqual(`classifier a ${token} c;\n`);
    });

    it.each([
        [";", "always", " {}"],
        ["{}", "never", ";"],
        ["{}", "preserve", " {}"],
        [";", "preserve", ";"],
    ] as const)(
        "should print empty children block %s with brackets %s",
        async (current, kind, expected) => {
            return expectPrinted(`type a :> b ${current}`, {
                format: {
                    empty_namespace_brackets: {
                        default: kind,
                    },
                },
            }).resolves.toEqual(`type a :> b${expected}\n`);
        }
    );

    it.each([
        [":>", "keyword", "specializes"],
        ["specializes", "token", ":>"],
        ["specializes", "preserve", "specializes"],
        [":>", "preserve", ":>"],
    ] as const)(
        "should print type relationship starting with %s using %s",
        async (current, kind, expected) => {
            return expectPrinted(`type a ${current} b {}`, {
                format: {
                    declaration_specialization: {
                        default: kind,
                    },
                },
            }).resolves.toEqual(`type a ${expected} b {}\n`);
        }
    );

    it("should print conjugated port typings in SysML", async () => {
        return expectPrinted("part a : ~b {}", { lang: "sysml", node: PartUsage }).resolves
            .toMatchInlineSnapshot(`
"part a : ~b {}
"
`);
    });

    it("should break long relationship gruops", async () => {
        return expectPrinted(
            "type a specializes some_long_first_id_here::some_long_qualified_id, some_long_second_id_here, some_long_third_id_here;",
            {
                options: { lineWidth: 40 },
            }
        ).resolves.toMatchInlineSnapshot(`
"type a
    specializes
        some_long_first_id_here
            ::some_long_qualified_id,
        some_long_second_id_here,
        some_long_third_id_here;
"
`);
    });
});

describe("kerml feature formatting", () => {
    it("should print feature modifiers", async () => {
        return expectPrinted("out abstract composite readonly derived end feature c;", {
            node: Feature,
        }).resolves.toEqual("out abstract composite readonly derived end feature c;\n");
    });

    it("should print expr nodes", async () => {
        return expectPrinted("expr fn { public in feature a; \n\ntrue }", {
            node: Expression,
        }).resolves.toEqual(
            `expr fn {
    public in feature a;

    true
}
`
        );
    });

    it("should print feature values", async () => {
        return expectPrinted("feature a = a->select { in x; true };", {
            node: Feature,
            options: { lineWidth: 25 },
        }).resolves.toEqual(
            `feature a = a->select {
    in x;
    true
};
`
        );
    });

    it("should print initial feature values", async () => {
        return expectPrinted("feature a := a->select { in x; true };", {
            node: Feature,
            options: { lineWidth: 25 },
        }).resolves.toEqual(
            `feature a := a->select {
    in x;
    true
};
`
        );
    });

    it("should print default = feature values", async () => {
        return expectPrinted("feature a default = 42;", {
            node: Feature,
        }).resolves.toEqual("feature a default = 42;\n");
    });

    it("should print default feature values", async () => {
        return expectPrinted("feature a default 42;", {
            node: Feature,
        }).resolves.toEqual("feature a default 42;\n");
    });

    it("should print default initial feature values", async () => {
        return expectPrinted("feature a default := 42;", {
            node: Feature,
        }).resolves.toEqual("feature a default := 42;\n");
    });

    it("should print feature values with force broken body expressions", async () => {
        return expectPrinted("feature a = a->select { \nin x; true };", {
            node: Feature,
        }).resolves.toEqual(
            `feature a = a->select {
    in x;
    true
};
`
        );
    });

    it("should break long feature value expressions", () => {
        return expectPrinted(
            "feature redefines totalMass = mass + sum(subcomponents.totalMass.?{in p :> ISQ::mass; p > minMass});",
            {
                node: Feature,
            }
        ).resolves.toEqual(
            `feature redefines totalMass =
    mass + sum(subcomponents.totalMass.?{ in p :> ISQ::mass; p > minMass });
`
        );
    });

    it("should break long feature chain expressions", () => {
        return expectPrinted(
            "feature redefines totalMass = some_long_id_here.some_long_id_next.some_long_id_last;",
            {
                node: Feature,
                options: {
                    lineWidth: 50,
                },
            }
        ).resolves.toEqual(
            `feature redefines totalMass =
    some_long_id_here.some_long_id_next
        .some_long_id_last;
`
        );
    });

    it("should not break at specializations when breaking long invocation expressions", () => {
        return expectPrinted(
            `
        feature
            :>> 'Static Pressure' = 'Ideal Gas Law'(
            Density,
            'Specific Gas Constant',
            'Static Temperature'
        );
        `,
            {
                node: Feature,
            }
        ).resolves.toMatchInlineSnapshot(`
"feature :>> 'Static Pressure' = 'Ideal Gas Law'(
    Density,
    'Specific Gas Constant',
    'Static Temperature'
);
"
`);
    });
});

describe("invariants", () => {
    it("should preserve true", async () => {
        return expectPrinted("inv true I {}", { node: Invariant }).resolves.toEqual(
            "inv true I {}\n"
        );
    });

    it("should not add true with preserve", async () => {
        return expectPrinted("inv I {}", { node: Invariant }).resolves.toEqual("inv I {}\n");
    });

    it("should print false when negated", async () => {
        return expectPrinted("inv false I {}", { node: Invariant }).resolves.toEqual(
            "inv false I {}\n"
        );
    });

    it("should remove true if not required and option is set", async () => {
        return expectPrinted("inv true I {}", {
            node: Invariant,
            format: {
                invariant_true_keyword: { default: "never" },
            },
        }).resolves.toEqual("inv I {}\n");
    });
});

describe("multiplicity", () => {
    it("should print multiplicity first", async () => {
        return expectPrinted("feature a :> b [1] ordered nonunique;", {
            node: Feature,
            format: { multiplicity_placement: "first" },
        }).resolves.toEqual("feature a [1] ordered nonunique :> b;\n");
    });

    it.each([
        ["type", Type],
        ["class", Class],
        ["classifier", Classifier],
        ["datatype", DataType],
        ["struct", Structure],
        ["assoc", Association],
        ["assoc struct", AssociationStructure],
        ["behavior", Behavior],
        ["function", SysMLFunction],
        ["predicate", Predicate],
        ["interaction", Interaction],
        ["metaclass", Metaclass],
    ] as const)(
        "should always print multiplicity first for non-feature type %s in KerML mode",
        async (kw, type) => {
            return expectPrinted(`${kw} a [1] :> b, c;`, {
                node: type,
                lang: "kerml",
                format: { multiplicity_placement: "last" },
            }).resolves.toEqual(`${kw} a [1] :> b, c;\n`);
        }
    );

    it("should print multiplicity after first specialization", async () => {
        return expectPrinted("feature a :> b :> c [1] ordered nonunique;", {
            node: Feature,
            format: { multiplicity_placement: "first-specialization" },
        }).resolves.toEqual("feature a :> b [1] ordered nonunique :> c;\n");
    });

    it("should print multiplicity last", async () => {
        return expectPrinted("feature a :> b [1] nonunique ordered :>> c;", {
            node: Feature,
            format: { multiplicity_placement: "last" },
        }).resolves.toEqual("feature a :> b :>> c [1] nonunique ordered;\n");
    });

    it("should indent specializations after multiplicity", async () => {
        return expectPrinted(
            `feature some_long_id_here
                :> some_long_id_here [1] nonunique ordered
                :>> some_long_id_here;`,
            {
                node: Feature,
                options: {
                    lineWidth: 50,
                },
            }
        ).resolves.toMatchInlineSnapshot(`
"feature some_long_id_here
    :> some_long_id_here [1] nonunique ordered
    :>> some_long_id_here;
"
`);
    });

    it("should print multiplicity properties", async () => {
        return expectPrinted("feature a :> b nonunique ordered :>> c;", {
            node: Feature,
            format: { multiplicity_placement: "last" },
        }).resolves.toEqual("feature a :> b :>> c nonunique ordered;\n");
    });

    it("should reorder 'ordered' and 'nonunique' with option set to 'ordered'", async () => {
        return expectPrinted("feature a :> b [1] nonunique ordered :>> c;", {
            node: Feature,
            format: {
                multiplicity_placement: "last",
                ordered_nonunique_priority: { default: "ordered" },
            },
        }).resolves.toEqual("feature a :> b :>> c [1] ordered nonunique;\n");
    });

    it("should reorder 'ordered' and 'nonunique' with option set to 'nonunique'", async () => {
        return expectPrinted("feature a :> b [1] ordered nonunique :>> c;", {
            node: Feature,
            format: {
                multiplicity_placement: "last",
                ordered_nonunique_priority: { default: "nonunique" },
            },
        }).resolves.toEqual("feature a :> b :>> c [1] nonunique ordered;\n");
    });

    it("should print multiplicity subset member", async () => {
        return expectPrinted("multiplicity m :> another {}", {
            node: Multiplicity,
        }).resolves.toEqual("multiplicity m :> another {}\n");
    });

    it("should print multiplicity range member", async () => {
        return expectPrinted("multiplicity m [5] {}", {
            node: MultiplicityRange,
        }).resolves.toEqual("multiplicity m [5] {}\n");
    });
});

describe("namespaces", () => {
    it("should print bare namespace", async () => {
        return expectPrinted("namespace NS {}", {
            node: Namespace,
        }).resolves.toEqual("namespace NS {}\n");
    });

    it("should print packages", async () => {
        return expectPrinted("#prefix package NS {}", {
            node: Package,
        }).resolves.toEqual("#prefix package NS {}\n");
    });

    it("should print library packages", async () => {
        return expectPrinted("standard library #prefix package NS {}", {
            node: LibraryPackage,
        }).resolves.toEqual("standard library #prefix package NS {}\n");
    });

    it("should print leading notes attached to prefixes", async () => {
        return expectPrinted("// note\n#prefix package NS {}", {
            node: OwningMembership,
        }).resolves.toEqual("// note\n#prefix package NS {}\n");
    });

    it("should print trailing notes attached to prefixes", async () => {
        return expectPrinted("#prefix // note\npackage NS {}", {
            node: OwningMembership,
        }).resolves.toEqual("#prefix // note\npackage NS {}\n");
    });
});

describe.each([
    [Association, "assoc"],
    [AssociationStructure, "assoc struct"],
    [Behavior, "behavior"],
    [BooleanExpression, "bool"],
    [Class, "class"],
    [Classifier, "classifier"],
    [DataType, "datatype"],
    [Interaction, "interaction"],
    [Metaclass, "metaclass"],
    [Predicate, "predicate"],
    [Step, "step"],
    [Structure, "struct"],
    [SysMLFunction, "function"],
    [Type, "type"],
] as const)("%s type", (type, kw) => {
    it("should print element", async () => {
        return expectPrinted(`abstract ${kw} Element :> A {}`, { node: type }).resolves.toEqual(
            `abstract ${kw} Element :> A {}\n`
        );
    });
});
