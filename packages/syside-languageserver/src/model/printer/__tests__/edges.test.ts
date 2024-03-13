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

import { expectPrinted as expectPrintedAs, printKerMLElement } from "./utils";
import {
    Specialization,
    Subclassification,
    Conjugation,
    Disjoining,
    FeatureInverting,
    FeatureTyping,
    Redefinition,
    Subsetting,
    TypeFeaturing,
    Dependency,
    Import,
    Expose,
    Type,
    Element,
    MembershipImport,
    NamespaceImport,
    ActorMembership,
    FeatureMembership,
    FramedConcernMembership,
    ObjectiveMembership,
    Membership,
    ElementFilterMembership,
    RequirementConstraintMembership,
    RequirementVerificationMembership,
    SubjectMembership,
    StakeholderMembership,
    ReturnParameterMembership,
    VariantMembership,
    ViewRenderingMembership,
    OwningMembership,
    Feature,
} from "../../../generated/ast";
import { SubtypeKeys } from "../../../services";
import { parsedNode } from "../../../testing/utils";

const expectPrinted: typeof expectPrintedAs = (text, context?) => {
    return expectPrintedAs(text, {
        ...context,
        lang: context?.lang ?? "kerml",
        node: context?.node ?? Type,
    });
};

describe("imports", () => {
    describe("membership imports", () => {
        it("should print non-recursive imports without children", async () => {
            const node = await parsedNode("import M;", { node: MembershipImport });
            expect(printKerMLElement(node.$meta)).toEqual("import M;\n");
        });

        it("should print recursive imports without children", async () => {
            const node = await parsedNode("import M ::**;", { node: MembershipImport });
            expect(printKerMLElement(node.$meta)).toEqual("import M::**;\n");
        });

        it("should print imports with children", async () => {
            const node = await parsedNode("import all M { /* comment */ }", {
                node: MembershipImport,
            });
            expect(printKerMLElement(node.$meta)).toEqual(`import all M {
    /*
     * comment
     */
}\n`);
        });
    });

    describe("namespace imports", () => {
        it("should print non-recursive imports without children", async () => {
            const node = await parsedNode("import M::*;", { node: NamespaceImport });
            expect(printKerMLElement(node.$meta)).toEqual("import M::*;\n");
        });

        it("should print recursive imports without children", async () => {
            const node = await parsedNode("import M ::* ::**;", { node: NamespaceImport });
            expect(printKerMLElement(node.$meta)).toEqual("import M::*::**;\n");
        });

        it("should print recursive membership imports with filters", async () => {
            const node = await parsedNode("import M ::**[true];", { node: NamespaceImport });
            expect(printKerMLElement(node.$meta)).toEqual("import M::**[true];\n");
        });

        it("should print imports with children", async () => {
            const node = await parsedNode("import all M::* { /* comment */ }", {
                node: NamespaceImport,
            });
            expect(printKerMLElement(node.$meta)).toEqual(`import all M::* {
    /*
     * comment
     */
}\n`);
        });

        it("should print filtered imports", async () => {
            const node = await parsedNode("import M ::* ::** [@Safety][hastype T];", {
                node: NamespaceImport,
            });
            expect(printKerMLElement(node.$meta)).toEqual(
                "import M::*::**[@ Safety][hastype T];\n"
            );
        });

        it("should break filtered imports", async () => {
            const node = await parsedNode("import M ::* ::** [@Safety][hastype T];", {
                node: NamespaceImport,
            });
            expect(printKerMLElement(node.$meta, { options: { lineWidth: 20 } })).toEqual(
                `import M::*::**[
        @ Safety
    ][hastype T];\n`
            );
        });
    });
});

describe("member relationships", () => {
    describe.each([
        [
            Specialization,
            "specialization",
            "subtype",
            "specializes",
            ":>",
            "specialization_keyword_specialization",
        ],
        [
            Subclassification,
            "specialization",
            "subclassifier",
            "specializes",
            ":>",
            "specialization_keyword_subclassification",
        ],
        [Conjugation, "conjugation", "conjugate", "conjugates", "~", "conjugation_keyword"],
        [Disjoining, "disjoining", "disjoint", "from", "", "disjoining_keyword"],
        [FeatureInverting, "inverting", "inverse", "of", "", "inverting_keyword"],
        [
            FeatureTyping,
            "specialization",
            "typing",
            "typed by",
            ":",
            "specialization_keyword_feature_typing",
        ],
        [
            Redefinition,
            "specialization",
            "redefinition",
            "redefines",
            ":>>",
            "specialization_keyword_redefinition",
        ],
        [
            Subsetting,
            "specialization",
            "subset",
            "subsets",
            ":>",
            "specialization_keyword_subsetting",
        ],
    ] as const)("%s", (type, prefix, src, keyword, token, prop) => {
        if (token) {
            it("should preserve keyword formatting", async () => {
                return expectPrinted(`${prefix} ${src} a ${keyword} b { doc /* doc */}`, {
                    node: type,
                    // need to make sure that build has no effect on printing
                    // AST references
                    build: true,
                }).resolves.toEqual(`${prefix} ${src} a ${keyword} b {
    doc
    /*
     * doc
     */
}
`);
            });

            it("should preserve token formatting", async () => {
                return expectPrinted(`${prefix} ${src} a ${token} b { doc /* doc */}`, {
                    node: type,
                }).resolves.toEqual(`${prefix} ${src} a ${token} b {
    doc
    /*
     * doc
     */
}
`);
            });
        }

        it("should remove leading keyword if it is not required and option is set", async () => {
            return expectPrinted(`${prefix} ${src} a ${keyword} b {}`, {
                node: type,
                format: {
                    [prop]: {
                        default: "as_needed",
                    },
                },
            }).resolves.toEqual(`${src} a ${keyword} b {}\n`);
        });

        it("should add leading keyword if it is not required and option is set", async () => {
            return expectPrinted(`${src} a ${keyword} b {}`, {
                node: type,
                format: {
                    [prop]: {
                        default: "always",
                    },
                },
            }).resolves.toEqual(`${prefix} ${src} a ${keyword} b {}\n`);
        });

        it("should retain leading keyword if it is required", async () => {
            return expectPrinted(`${prefix} r ${src} a ${keyword} b {}`, {
                node: type,
                format: {
                    [prop]: {
                        default: "as_needed",
                    },
                },
            }).resolves.toEqual(`${prefix} r ${src} a ${keyword} b {}\n`);
        });

        it("should break related elements group off", async () => {
            return expectPrinted(`${prefix} 'some long identifier....' ${src} a ${keyword} b {}`, {
                node: type,
                options: { lineWidth: 40 },
            }).resolves.toEqual(`${prefix} 'some long identifier....'
    ${src} a ${keyword} b {}\n`);
        });

        it("should break related elements group internally", async () => {
            return expectPrinted(`${prefix} 'some long identifier....' ${src} a ${keyword} b {}`, {
                node: type,
                options: { lineWidth: 20 },
            }).resolves.toEqual(`${prefix} 'some long identifier....'
    ${src} a
    ${keyword} b {}\n`);
        });
    });

    it.each([
        ["specialization", "subtype", "specializes", Specialization],
        ["specialization", "subset", "subsets", Subsetting],
        ["specialization", "redefinition", "redefines", Redefinition],
        ["inverting", "inverse", "of", FeatureInverting],
        ["conjugation", "conjugate", "conjugates", Conjugation],
        ["disjoining", "disjoint", "from", Disjoining],
    ] as const)("should print %s %s chained features", async (left, mid, right, type) => {
        return expectPrinted(`${left} a ${mid} b.c.d ${right} e.f.g {}`, {
            node: type,
        }).resolves.toEqual(`${left} a ${mid} b.c.d ${right} e.f.g {}\n`);
    });

    it.each(["unions", "differences", "intersects", "chains"] as const)(
        "should print %s chained features",
        async (token) => {
            return expectPrinted(`feature a ${token} b.c.d {}`, {
                node: Feature,
            }).resolves.toEqual(`feature a ${token} b.c.d {}\n`);
        }
    );

    describe("TypeFeaturing", () => {
        it("should remove keyword if it is not required and option is set", async () => {
            return expectPrinted(`featuring of a by b {}`, {
                node: TypeFeaturing,
                format: {
                    featuring_of_keyword: {
                        default: "as_needed",
                    },
                },
            }).resolves.toEqual(`featuring a by b {}\n`);
        });

        it("should add keyword if it is not required and option is set", async () => {
            return expectPrinted(`featuring a by b {}`, {
                node: TypeFeaturing,
                format: {
                    featuring_of_keyword: {
                        default: "always",
                    },
                },
            }).resolves.toEqual(`featuring of a by b {}\n`);
        });

        it("should retain leading keyword if it is required", async () => {
            return expectPrinted(`featuring f of a by b {}`, {
                node: TypeFeaturing,
                format: {
                    featuring_of_keyword: {
                        default: "as_needed",
                    },
                },
            }).resolves.toEqual(`featuring f of a by b {}\n`);
        });
    });
});

describe("dependencies", () => {
    it("should print fitting dependencies on one line", async () => {
        return expectPrinted("#dep dependency dep from a to b {}", {
            node: Dependency,
        }).resolves.toEqual("#dep dependency dep from a to b {}\n");
    });

    it("should break references", async () => {
        return expectPrinted("#dep dependency 'some long id' from a to b {}", {
            node: Dependency,
            options: { lineWidth: 35 },
        }).resolves.toEqual(`#dep dependency 'some long id'
    from a
    to b {}\n`);
    });

    it("should not print 'from' if it is not required and option is set", async () => {
        return expectPrinted("dependency from a to b {}", {
            node: Dependency,
            format: { dependency_from_keyword: { default: "as_needed" } },
        }).resolves.toEqual("dependency a to b {}\n");
    });

    it("should print 'from' if it is required", async () => {
        return expectPrinted("dependency dep from a to b {}", {
            node: Dependency,
            format: { dependency_from_keyword: { default: "as_needed" } },
        }).resolves.toEqual("dependency dep from a to b {}\n");
    });

    it("should preserve 'from' if it is not required and option is set", async () => {
        return expectPrinted("dependency from a to b {}", {
            node: Dependency,
            format: { dependency_from_keyword: { default: "preserve" } },
        }).resolves.toEqual("dependency from a to b {}\n");
    });
});

describe.each([
    ["import", Import, "kerml", (text: string): string => text],
    ["expose", Expose, "sysml", (text: string): string => `view { ${text} }`],
] as const)("%s", (kw, type, lang, transform) => {
    it("should print non-recursive membership imports", async () => {
        return expectPrinted(transform(`${kw} M { /* comment */ }`), {
            lang,
            node: ("Membership" + type) as SubtypeKeys<Element>,
        }).resolves.toEqual(`${kw} M {
    /*
     * comment
     */
}\n`);
    });

    it("should print recursive membership imports", async () => {
        return expectPrinted(transform(`${kw} M::** { /* comment */ }`), {
            lang,
            node: ("Membership" + type) as SubtypeKeys<Element>,
        }).resolves.toEqual(`${kw} M::** {
    /*
     * comment
     */
}\n`);
    });

    it("should print non-recursive namespace imports", async () => {
        return expectPrinted(transform(`${kw} M::* { /* comment */ }`), {
            lang,
            node: ("Namespace" + type) as SubtypeKeys<Element>,
        }).resolves.toEqual(`${kw} M::* {
    /*
     * comment
     */
}\n`);
    });

    it("should print recursive namespace imports", async () => {
        return expectPrinted(transform(`${kw} M::*::** { /* comment */ }`), {
            lang,
            node: ("Namespace" + type) as SubtypeKeys<Element>,
        }).resolves.toEqual(`${kw} M::*::** {
    /*
     * comment
     */
}\n`);
    });

    it("should print namespace imports with filters", async () => {
        return expectPrinted(transform(`${kw} M::* [@Safety][hastype T]{ /* comment */ }`), {
            lang,
            node: ("Namespace" + type) as SubtypeKeys<Element>,
            options: { lineWidth: 20 },
        }).resolves.toEqual(`${kw} M::*[
        @ Safety
    ][hastype T] {
    /*
     * comment
     */
}\n`);
    });
});

describe("membership", () => {
    it.each([
        ["actor", ActorMembership],
        ["subject", SubjectMembership],
        ["stakeholder", StakeholderMembership],
    ] as const)("should print %s memberships", async (kw, type) => {
        return expectPrinted(`requirement def { protected ${kw} #prefix a {}  }`, {
            node: type,
            lang: "sysml",
        }).resolves.toEqual(`protected ${kw} #prefix a {}\n`);
    });

    it("should print feature memberships", async () => {
        return expectPrinted("requirement def { private #prefix part a {}  }", {
            node: FeatureMembership,
            lang: "sysml",
        }).resolves.toEqual("private #prefix part a {}\n");
    });

    describe.each([
        ["framed concern", "frame", "concern", FramedConcernMembership],
        ["requirement verification", "verify", "requirement", RequirementVerificationMembership],
        [
            "requirement constraint assumption",
            "assume",
            "constraint",
            RequirementConstraintMembership,
        ],
        [
            "requirement constraint requirement",
            "require",
            "constraint",
            RequirementConstraintMembership,
        ],
    ] as const)("%s membership", (_, member, target, type) => {
        it("should print shorthand", async () => {
            return expectPrinted(`requirement def { ${member} f {}  }`, {
                node: type,
                lang: "sysml",
            }).resolves.toEqual(`${member} f {}\n`);
        });

        it(`should print ${target} keyword`, async () => {
            return expectPrinted(`requirement def { ${member} ${target} f {}  }`, {
                node: type,
                lang: "sysml",
            }).resolves.toEqual(`${member} ${target} f {}\n`);
        });

        it("should print with prefixes", async () => {
            return expectPrinted(`requirement def { ${member} #prefix f {}  }`, {
                node: type,
                lang: "sysml",
            }).resolves.toEqual(`${member} #prefix f {}\n`);
        });
    });

    it("should print objective memberships", async () => {
        return expectPrinted("case def { protected objective #prefix a = 1 {}  }", {
            node: ObjectiveMembership,
            lang: "sysml",
        }).resolves.toEqual("protected objective #prefix a = 1 {}\n");
    });

    it("should print alias memberships", async () => {
        return expectPrinted("alias a for b {}", {
            node: Membership,
            lang: "sysml",
        }).resolves.toEqual("alias a for b {}\n");
    });

    it("should print initial node members", async () => {
        return expectPrinted("action def { first a {} }", {
            node: Membership,
            lang: "sysml",
        }).resolves.toEqual("first a {}\n");
    });

    it("should print element filter memberships", async () => {
        return expectPrinted(
            "public filter some_long_lhs_value_herer > some_long_rhs_value_here;",
            {
                node: ElementFilterMembership,
                lang: "sysml",
                options: {
                    lineWidth: 40,
                },
            }
        ).resolves.toMatchInlineSnapshot(`
"public filter (
    some_long_lhs_value_herer >
    some_long_rhs_value_here
);
"
`);
    });

    it("should print return members", async () => {
        return expectPrinted("calc def { return a = 1; }", {
            node: ReturnParameterMembership,
            lang: "sysml",
        }).resolves.toEqual("return a = 1;\n");
    });

    describe("variant memberships", () => {
        it("should print regular members", async () => {
            return expectPrinted("calc def { variant ref a = 1; }", {
                node: VariantMembership,
                lang: "sysml",
            }).resolves.toEqual("variant ref a = 1;\n");
        });

        it("should print enum members", async () => {
            return expectPrinted("enum def { enum = 1; }", {
                node: VariantMembership,
                lang: "sysml",
            }).resolves.toEqual("enum = 1;\n");
        });
    });

    it("should print view rendering memberships", async () => {
        return expectPrinted("view def { render x :> xx; }", {
            node: ViewRenderingMembership,
            lang: "sysml",
        }).resolves.toEqual("render x :> xx;\n");
    });
});

describe("notes", () => {
    it("should print leading notes correctly", () => {
        return expectPrinted(
            `
        // leading
        private class A; // trailing`,
            { node: OwningMembership, lang: "kerml" }
        ).resolves.toEqual(`// leading
private class A; // trailing\n`);
    });
});

describe("KerML member features", () => {
    it("should print member features", () => {
        return expectPrintedAs(`class { member a; }`, {
            node: OwningMembership,
            index: 1,
            lang: "kerml",
        }).resolves.toEqual("member a;\n");
    });

    it("should print member metadata features", () => {
        return expectPrintedAs(`class { @a; }`, {
            node: OwningMembership,
            index: 1,
            lang: "kerml",
        }).resolves.toEqual("@a;\n");
    });

    it("should print member multiplicity subset", () => {
        return expectPrintedAs(`class { multiplicity a :> b; }`, {
            node: OwningMembership,
            index: 1,
            lang: "kerml",
        }).resolves.toEqual("multiplicity a :> b;\n");
    });

    it("should print member multiplicity range", () => {
        return expectPrintedAs(`class { multiplicity a [0]; }`, {
            node: OwningMembership,
            index: 1,
            lang: "kerml",
        }).resolves.toEqual("multiplicity a [0];\n");
    });
});
