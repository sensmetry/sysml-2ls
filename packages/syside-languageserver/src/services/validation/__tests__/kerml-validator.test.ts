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

import { parseKerML, services, TEST_BUILD_OPTIONS } from "../../../testing";
import { SysMLBuildOptions } from "../../shared/workspace/document-builder";

const BUILD_OPTIONS: SysMLBuildOptions = { ...TEST_BUILD_OPTIONS, validationChecks: "all" };

export async function expectValidations(
    text: string,
    message: string | RegExp,
    count = 1,
    buildOptions = BUILD_OPTIONS
): Promise<void> {
    const result = await parseKerML(text, buildOptions);

    expect(result.parserErrors).toHaveLength(0);
    const regex = typeof message === "string" ? new RegExp(message) : message;
    const diagnostics = result.diagnostics.filter((d) => regex.test(d.message));
    expect(diagnostics).toHaveLength(count);
}

describe("Duplicate member names", () => {
    test("duplicate names in the same scope issue a diagnostic", async () => {
        return expectValidations("class A; struct A;", "Duplicate member", 2);
    });

    test("duplicate short names in the same scope issue a diagnostic", async () => {
        return expectValidations("class <A>; struct <A>;", "Duplicate member", 2);
    });

    test("duplicate mixed names in the same scope issue a diagnostic", async () => {
        return expectValidations("class <A>; struct A;", "Duplicate member", 2);
    });

    test.failing("duplicate inherited names issue a diagnostic", async () => {
        return expectValidations(
            "class A { class B; } struct B :> A { struct B; }",
            "must be unique"
        );
    });
});

test.each(["unions", "intersects", "differences"])(
    "it is not allowable for a type to have just one of '%s' relationship",
    async (token: string) => {
        return expectValidations(
            `class A; class B ${token} A;`,
            /A single \w+ relationship is not allowed/
        );
    }
);

test("multiple return parameters trigger a diagnostic", async () => {
    expectValidations(
        "function F { return a : F; return b : F; }",
        /At most one \w+ is allowed/i,
        2
    );
});

describe("Element filter memberships", () => {
    test("user-defined functions trigger validation", async () => {
        return expectValidations(
            "function Fn; import a::*[Fn()];",
            /Invalid filter.*model-level evaluable/
        );
    });

    test("non-boolean filters trigger validation", async () => {
        return expectValidations(
            "import a::*[not 1];",
            /Invalid filter expression, must return boolean/
        );
    });
});

describe("Standard library package validation", () => {
    test("no standard library path triggers validation", async () => {
        return expectValidations("standard library package P {}", "Invalid library package");
    });

    test("documents outside standard library path trigger validation", async () => {
        const config = services.shared.workspace.ConfigurationProvider.get();
        const old = config.standardLibraryPath;
        config.standardLibraryPath = "/some/path";
        return expectValidations(
            "standard library package P {}",
            "Invalid library package"
        ).finally(() => (config.standardLibraryPath = old));
    });
});

describe("Default classifier implicit supertypes", () => {
    test("classifiers without implicit supertype trigger validation", async () => {
        return expectValidations("class A;", /Invalid classifier, .* specialize/);
    });
});

describe("Feature validations", () => {
    test("untyped features trigger validation", async () => {
        return expectValidations("feature a;", /Invalid feature, must be typed/);
    });

    test("multiple reference subsettings trigger validation", async () => {
        return expectValidations(
            "feature a references b references c;",
            /Invalid reference subsetting, at most one/,
            2
        );
    });

    test("features chaining a chain of 1 feature produce a diagnostic", async () => {
        return expectValidations(
            `
        feature a;
        feature b chains a;`,
            "2 or more features"
        );
    });
});

describe("Metadata feature validations", () => {
    test("abstract typings trigger validation", async () => {
        return expectValidations(
            "abstract metaclass M; metadata m : M;",
            /Invalid .* concrete type/
        );
    });

    test("invalid annotated element types trigger validation", async () => {
        return expectValidations(
            `
        package Metaobjects {
            metaclass Metaobject {
                abstract feature annotatedElement: Element[1..*];
            }
        }
        
        package KerML {
            package Kernel {
                metaclass Function;
                metaclass Class;
            }
        }
        
        package P {
            metaclass M :> Metaobjects::Metaobject {
                :> annotatedElement: KerML::Kernel::Function;
            }

            #M class C;
        }`,
            /Invalid metadata .* cannot annotate/,
            1,
            { ...BUILD_OPTIONS, standardLibrary: "local" }
        );
    });

    test("body features must redefine supertype features", async () => {
        return expectValidations(
            `
        metaclass M { feature a; }
        class C {
            @M {
                feature b;
            }
        }`,
            /Invalid metadata .* redefine/
        );
    });

    test("body features with user-defined function values trigger validation", async () => {
        return expectValidations(
            `
        function Fn;
        metaclass M { feature a; }
        class C {
            @M {
                :>> a = Fn();
            }
        }`,
            /Invalid metadata .* model-level evaluable/
        );
    });
});

describe("Feature chaining", () => {
    test("feature chainings are validated", async () => {
        return expectValidations(
            `
            class A; class B;
            feature a featured by A {
                feature b featured by B;
            }
            feature c chains a.b;`,
            /chaining/,
            1
        );
    });
});

describe("Feature chain expressions", () => {
    test("feature chain expressions are validated", async () => {
        return expectValidations(
            `
            class A; class B;
            feature a featured by A {
                member feature b featured by B;
            }
            feature c = a.b;`,
            /chain expression/,
            1
        );
    });
});

describe("Invocation expressions", () => {
    test("redefining the same parameter twice triggers validation", async () => {
        return expectValidations(
            `
        function A {
            in feature a;
            out feature b;
        }
        feature a = A(a=1,a=2);`,
            /invocation expression argument,.* multiple/,
            1
        );
    });

    test("redefining an out parameter triggers validation", async () => {
        return expectValidations(
            `
        function A {
            in feature a;
            out feature b;
        }
        feature a = A(a=1,b=2);`,
            /invocation expression argument,.* output/,
            1
        );
    });
});

describe("Operator expressions", () => {
    test("casting non-conforming types triggers validation", async () => {
        return expectValidations(
            `
        class A; feature a : A;
        class B;
        feature x = a as B;
        `,
            /cast expression/,
            1
        );
    });

    test("square brackets trigger validation", async () => {
        return expectValidations("feature a = 1 [0];", "Invalid index expression");
    });
});

describe("Multiplicity", () => {
    test("multiple multiplicities trigger validation", async () => {
        return expectValidations("class C [1] { multiplicity m [2]; }", /multi/, 1);
    });
});

describe("Connectors", () => {
    test("concrete connectors with less than 2 ends trigger validation", async () => {
        return expectValidations("connector C;", /connector.*2 related/i, 1);
    });

    test("abstract connectors do not trigger validation", async () => {
        return expectValidations("abstract connector C;", /connector.*2 related/i, 0);
    });

    test("referenced features without featuring types don't trigger validation", async () => {
        return expectValidations(
            "feature a; feature b; connector C from a to b;",
            /connector end/,
            0
        );
    });

    test("referenced features featured by conforming types trigger validation", async () => {
        return expectValidations(
            "class A; feature a featured by A; feature b featured by A; connector C featured by A from a to b;",
            /connector end/,
            0
        );
    });

    test("referenced features featured by different types trigger validation", async () => {
        return expectValidations(
            "feature a; feature b featured by a; connector C from a to b;",
            /connector end.* accessible/,
            1
        );
    });

    test("binding connectors with non-conforming end types trigger validation", async () => {
        return expectValidations(
            `
            class A; class B;
            feature a : A; feature b : B;
            binding of a = b;`,
            /binding connector,.* conforming/,
            1
        );
    });
});

describe("Item flows", () => {
    test("ends referencing nested features with qualified names trigger validation", async () => {
        return expectValidations(
            `
            package Transfers {
                class Transfer {
                    end feature source {
                        out feature sourceOutput;
                    }
                    end feature target {
                        in feature targetInput; 
                    }
                }
            }

            feature a { feature x; }
            feature b { feature y; }
            flow from a::x to b::y;`,
            /end,.* should use dot/,
            2
        );
    });

    test("ends referencing non-nested features with qualified names trigger validation", async () => {
        return expectValidations(
            `
            feature a;
            feature b;
            flow from a to b;`,
            /end,.* cannot identify/,
            2
        );
    });

    test("ends referencing nested features with chains do not trigger validation", async () => {
        return expectValidations(
            `
            package Transfers {
                class Transfer {
                    end feature source {
                        out feature sourceOutput;
                    }
                    end feature target {
                        in feature targetInput; 
                    }
                }
            }

            feature a { feature x; }
            feature b { feature y; }
            flow from a.x to b.y;`,
            /end,.* should use dot/,
            0
        );
    });
});

describe("Subsettings", () => {
    test.each(["subsets a;", "; subset b :> a;"])(
        "nonunique feature subsetting unique feature issues a diagnostic",
        async (suffix: string) => {
            return expectValidations(
                `
        feature a[*];
        feature b[*] nonunique ${suffix}`,
                "must be unique"
            );
        }
    );

    test("redefining features must have greater or equal lower multiplicity bound", async () => {
        return expectValidations(
            `class A {feature a[5..10]; }
        class B :> A {
            :>> a[0..2];
        }`,
            "should be at least as large"
        );
    });

    test("subsetting features must have lower or equal upper multiplicity bound", async () => {
        return expectValidations(
            `class A {feature a[5..10]; }
        class B :> A {
            feature c :> a[0..100];
        }`,
            "should not be larger"
        );
    });

    test("infinity bounds don't trigger upper bound validation", async () => {
        return expectValidations(
            `class A {feature a[*]; }
        class B :> A {
            feature c :> a[0..100];
        }`,
            "should not be larger",
            0
        );
    });

    test("0..1 bounds don't trigger upper bound validation", async () => {
        return expectValidations(
            `class A {feature a[0..1]; }
        class B :> A {
            feature c :> a[1];
        }`,
            "should not be larger",
            0
        );
    });

    test("redefining feature from the owning type triggers validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            feature b :>> A::a featured by A;`,
            /redefinition, owner/,
            1
        );
    });

    test("redefining base type feature with the same name does not trigger validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            class B :> A {
                feature a :>> a;
            }`,
            /redefinition, owner/,
            0
        );
    });

    test("redefining package feature triggers validation", async () => {
        return expectValidations(
            `
            feature a : A;
            feature b :>> a;`,
            /redefinition/,
            1
        );
    });

    test("subsetting a feat./ure with different featuring types triggers validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            feature b :>> A::a;`,
            /subsetting.* accessible feature/,
            1
        );
    });
});
