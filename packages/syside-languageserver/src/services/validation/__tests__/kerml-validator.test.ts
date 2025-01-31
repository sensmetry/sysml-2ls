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

import { Diagnostic } from "vscode-languageserver";
import {
    emptyDocument,
    parseKerML,
    ParseOptions,
    services,
    TEST_BUILD_OPTIONS,
} from "../../../testing";
import {
    basicIdProvider,
    EdgeContainer,
    ElementMeta,
    ExpressionMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    FunctionMeta,
    ItemFeatureMeta,
    ItemFlowEndMeta,
    ItemFlowMeta,
    namespaceChildren,
    NamespaceMeta,
    ParameterMembershipMeta,
    ResultExpressionMembershipMeta,
    ReturnParameterMembershipMeta,
    SpecializationMeta,
    TypeMeta,
} from "../../../model";
import { ModelDiagnostic } from "../validation-registry";
import { SETTINGS_KEY } from "../../shared";
import { SysMLConfig } from "../../config";

const BUILD_OPTIONS: ParseOptions = { ...TEST_BUILD_OPTIONS, validationChecks: "all" };

export function expectValidations(
    text: string,
    code: string | (string | number | undefined)[],
    buildOptions = BUILD_OPTIONS
): jest.JestMatchers<Promise<Diagnostic[]>> {
    return expect(
        parseKerML(text, { ...BUILD_OPTIONS, ...buildOptions }).then((result) => {
            expect(result.parserErrors).toHaveLength(0);
            if (Array.isArray(code)) return result.diagnostics.filter((d) => code.includes(d.code));
            return result.diagnostics.filter((d) => d.code === code);
        })
    );
}

const Validator = services.KerML.validation.KerMLValidator;

export function expectModelValidations(
    root: ElementMeta,
    code: string | (string | number | undefined)[]
): jest.JestMatchers<ModelDiagnostic[]> {
    return expect(
        services.KerML.validation.DocumentValidator.validateModel(root, root.document).then(
            (ds) => {
                if (Array.isArray(code)) return ds.filter((d) => code.includes(d.info.code));
                return ds.filter((d) => d.info.code === code);
            }
        )
    );
}

test("non-constructed elements with implied relationships trigger validation", () => {
    const accept = jest.fn();
    const doc = emptyDocument();
    const spec = SpecializationMeta.create(basicIdProvider(), doc, {
        isImplied: true,
    });
    Validator.validateElementIsImpliedIncluded(
        TypeMeta.create(basicIdProvider(), doc, {
            heritage: EdgeContainer.make([spec, TypeMeta.create(basicIdProvider(), doc)]),
        }),
        accept
    );
    expect(accept).toHaveBeenCalledTimes(1);
});

describe("Import", () => {
    test("public top level import trigger validation", async () => {
        return expectValidations(
            "public import A;",
            "validateImportTopLevelVisibility"
        ).resolves.toHaveLength(1);
    });

    test("import without visibility indicator trigger validation", async () => {
        return expectValidations(
            "import A;",
            "validateImportExplicitVisibility"
        ).resolves.toHaveLength(1);
    });
});

describe("Duplicate member names", () => {
    test("duplicate names in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "class A; struct A;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test("indentical short and regular names don't trigger validation", async () => {
        return expectValidations(
            "struct <A> A;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(0);
    });

    test("duplicate short names in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "class <A>; struct <A>;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test("duplicates names and imports in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "package P { class A; } import P::A; struct <A>;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test("recursively importing member doesn't trigger validation", async () => {
        return expectValidations(
            "package P { class A; } import P::**;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(0);
    });

    test("duplicate mixed names in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "class <A>; struct A;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test.failing("duplicate inherited names issue a diagnostic", async () => {
        return expectValidations(
            "class A { class B; } struct B :> A { struct B; }",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(1);
    });
});

test.failing("mixed specializations and conjugations trigger validation", () => {
    return expectValidations(
        "feature A :> B ~ C;",
        "validateSpecializationSpecificNotConjugated"
    ).resolves.toHaveLength(1);
});

test.failing("multiple conjugations trigger validation", () => {
    return expectValidations(
        "feature A ~ B ~ C;",
        "validateTypeAtMostOneConjugator"
    ).resolves.toHaveLength(2);
});

test.each([
    ["unions", "validateTypeOwnedUnioningNotOne"],
    ["intersects", "validateTypeOwnedIntersectingNotOne"],
    ["differences", "validateTypeOwnedDifferencingNotOne"],
    ["chains", "validateFeatureChainingFeatureNotOne"],
])("it is not allowable for a type to have just one of '%s' relationship", async (token, code) => {
    return expectValidations(`feature B ${token} A;`, code).resolves.toHaveLength(1);
});

test.each([
    ["unions", "validateTypeUnioningTypesNotSelf"],
    ["intersects", "validateTypeIntersectingTypesNotSelf"],
    ["differences", "validateTypeDifferencingTypesNotSelf"],
    ["chains", "validateFeatureChainingFeaturesNotSelf"],
])("it is not allowable for a type to have just one of '%s' relationship", async (token, code) => {
    return expectValidations(`feature B ${token} B;`, code).resolves.toHaveLength(1);
});

describe("Multiplicity", () => {
    test("multiple multiplicities trigger validation", async () => {
        return expectValidations(
            "class C [1] { multiplicity m [2]; }",
            "validateTypeOwnedMultiplicity"
        ).resolves.toHaveLength(1);
    });

    it("multiplicities with featuring types owned by non-features trigger validation", () => {
        return expectValidations(
            "class A { multiplicity multi [1]; } class B; featuring A::multi by B;",
            "validateClassifierMultiplicityDomain"
        ).resolves.toHaveLength(1);
    });

    it("multiplicities with different featuring types owned by features trigger validation", () => {
        return expectValidations(
            "feature A { multiplicity multi [1]; } class B; featuring A::multi by B;",
            "validateFeatureMultiplicityDomain"
        ).resolves.toHaveLength(1);
    });
});

describe("Feature validations", () => {
    test("untyped features trigger validation", async () => {
        return expectValidations("feature a;", "validateFeatureTyping").resolves.toHaveLength(1);
    });

    test("multiple reference subsettings trigger validation", async () => {
        return expectValidations(
            "feature a references b references c;",
            "validateFeatureOwnedReferenceSubsetting"
        ).resolves.toHaveLength(2);
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
            "validateFeatureChainingFeatureConformance"
        ).resolves.toHaveLength(1);
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
                "validateSubsettingUniquenessConformance"
            ).resolves.toHaveLength(1);
        }
    );

    test("redefining features must have greater or equal lower multiplicity bound", async () => {
        return expectValidations(
            `class A {feature a[5..10]; }
        class B :> A {
            :>> a[0..2];
        }`,
            "validateRedefinitionMultiplicityConformance"
        ).resolves.toHaveLength(1);
    });

    test("subsetting features must have lower or equal upper multiplicity bound", async () => {
        return expectValidations(
            `class A {feature a[5..10]; }
        class B :> A {
            feature c :> a[0..100];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(1);
    });

    test("infinity bounds don't trigger upper bound validation", async () => {
        return expectValidations(
            `class A {feature a : A [*]; }
        class B :> A {
            feature c : a[0..100];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(0);
    });

    test("0..1 bounds don't trigger upper bound validation", async () => {
        return expectValidations(
            `class A {feature a[0..1]; }
        class B :> A {
            feature c :> a[1];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(0);
    });

    test("subsetted end feature doesn't trigger multiplicity validation", async () => {
        return expectValidations(
            `class A { end feature a[5..10]; }
        class B :> A {
            feature c :> a[0..100];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(0);
    });

    test("redefining feature from the owning type triggers validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            feature b :>> A::a featured by A;`,
            "validateRedefinitionFeaturingTypes"
        ).resolves.toHaveLength(1);
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
            "validateRedefinitionFeaturingTypes"
        ).resolves.toHaveLength(0);
    });

    test("redefining package feature triggers validation", async () => {
        return expectValidations(
            `
            feature a : A;
            feature b :>> a;`,
            "validateRedefinitionFeaturingTypes"
        ).resolves.toHaveLength(1);
    });

    test("subsetting a feature with different featuring types triggers validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            feature b :>> A::a;`,
            "validateSubsettingFeaturingTypes"
        ).resolves.toHaveLength(1);
    });

    test.failing(
        "redefining features with incompatible directions triggers validation ",
        async () => {
            return expectValidations(
                `
        function A {
            in feature a;
            out feature b;
            inout feature c;
        }
        feature a : A {
            :>> a = 2;
            :>> b = 2;
            :>> c = 2;
        }`,
                "validateRedefinitionDirectionConformance"
            ).resolves.toHaveLength(3);
        }
    );
});

describe("DataType", () => {
    test.each(["class", "assoc"])("specializing %s triggers validation", (tok) => {
        return expectValidations(
            `${tok} A; datatype B :> A;`,
            "validateDatatypeSpecialization"
        ).resolves.toHaveLength(1);
    });
});

describe("Class", () => {
    test.each(["datatype", "assoc"])("specializing %s triggers validation", (tok) => {
        return expectValidations(
            `${tok} A; class B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(1);
    });
});

describe.each([
    ["AssocStruct", "assoc struct"],
    ["Interaction", "interaction"],
])("%s", (_, tok) => {
    test("specializing datatype triggers validation", () => {
        return expectValidations(
            `datatype A; ${tok} B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(1);
    });

    test("specializing assoc does not trigger validation", () => {
        return expectValidations(
            `assoc A; ${tok} B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(0);
    });
});

describe.each([
    ["connector", ":", "validateConnectorBinarySpecialization"],
    ["assoc", ":>", "validateAssociationBinarySpecialization"],
])("Invalid binary %s", (tok, spec, code) => {
    it("nary ends should trigger validation", () => {
        return expectValidations(
            `package Links { class BinaryLink; } ${tok} A ${spec} Links::BinaryLink {end a; end b; end c;}`,
            code,
            { standardLibrary: "local" }
        ).resolves.toHaveLength(1);
    });

    it("binary ends should not trigger validation", () => {
        return expectValidations(
            `package Links { class BinaryLink; } ${tok} A ${spec} Links::BinaryLink {end a; end b; }`,
            code,
            { standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });

    it("inherited ends should not trigger validation", () => {
        return expectValidations(
            `package Links { class BinaryLink; } ${tok} A ${spec} Links::BinaryLink {end a; end b; end c;} ${tok} B :> A;`,
            code,
            { standardLibrary: "local" }
        ).resolves.toHaveLength(1);
    });
});

describe.each([
    ["connector", "validateConnectorRelatedFeatures"],
    ["assoc", "validateAssociationRelatedTypes"],
])("%s related types", (tok, code) => {
    test("concrete types with less than 2 ends trigger validation", async () => {
        return expectValidations(`${tok} A;`, code).resolves.toHaveLength(1);
    });

    test("abstract types do not trigger validation", async () => {
        return expectValidations(`abstract ${tok} A;`, code).resolves.toHaveLength(0);
    });
});

describe("binding connectors", () => {
    it("should trigger validation for >2 ends", () => {
        return expectValidations(
            "binding of a = b { end c; }",
            "validateBindingConnectorIsBinary"
        ).resolves.toHaveLength(1);
    });

    test("binding connectors with non-conforming end types trigger validation", async () => {
        return expectValidations(
            `
            class A; class B;
            feature a : A; feature b : B;
            binding of a = b;`,
            "validateBindingConnectorTypeConformance"
        ).resolves.toHaveLength(1);
    });
});

describe("Connectors", () => {
    test("referenced features without featuring types don't trigger validation", async () => {
        return expectValidations(
            "feature a; feature b; connector C from a to b;",
            "checkConnectorTypeFeaturing"
        ).resolves.toHaveLength(0);
    });

    test("referenced features featured by conforming types trigger validation", async () => {
        return expectValidations(
            "class A; feature a featured by A; feature b featured by A; connector C featured by A from a to b;",
            "checkConnectorTypeFeaturing"
        ).resolves.toHaveLength(0);
    });

    test("referenced features featured by different types trigger validation", async () => {
        return expectValidations(
            "feature a; feature b featured by a; connector C from a to b;",
            "checkConnectorTypeFeaturing"
        ).resolves.toHaveLength(1);
    });
});

describe("parameter memberships", () => {
    it("parameter membership should trigger validation for invalid owning types", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = NamespaceMeta.create(id, doc, {
            children: namespaceChildren([
                ParameterMembershipMeta.create(id, doc),
                FeatureMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(
            ns,
            "validateParameterMembershipOwningType"
        ).resolves.toHaveLength(1);
    });

    it.each([
        ["function", FunctionMeta, "validateFunctionReturnParameterMembership"],
        ["expression", ExpressionMeta, "validateExpressionReturnParameterMembership"],
    ] as const)("multiple result expressions trigger %s validation", (_, type, code) => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = (type as typeof FeatureMeta).create(id, doc, {
            children: namespaceChildren(
                [ReturnParameterMembershipMeta.create(id, doc), ExpressionMeta.create(id, doc)],
                [ReturnParameterMembershipMeta.create(id, doc), ExpressionMeta.create(id, doc)]
            ),
        });

        return expectModelValidations(ns, code).resolves.toHaveLength(2);
    });

    it.each([
        ["result", ResultExpressionMembershipMeta, "validateResultExpressionMembershipOwningType"],
        ["return", ReturnParameterMembershipMeta, "validateReturnParameterMembershipOwningType"],
    ] as const)(
        "%s parameter membership should trigger validation for invalid owning types",
        (_, type, code) => {
            const doc = emptyDocument();
            const id = basicIdProvider();
            const ns = NamespaceMeta.create(id, doc, {
                children: namespaceChildren([
                    (type as typeof ParameterMembershipMeta).create(id, doc),
                    ExpressionMeta.create(id, doc),
                ]),
            });

            return expectModelValidations(ns, code).resolves.toHaveLength(1);
        }
    );
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
            "validateFeatureChainExpressionFeatureConformance"
        ).resolves.toHaveLength(1);
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
            "validateInvocationExpressionNoDuplicateParameterRedefinition"
        ).resolves.toHaveLength(1);
    });

    test("redefining an out parameter triggers validation", async () => {
        return expectValidations(
            `
        function A {
            in feature a;
            out feature b;
        }
        feature a = A(a=1,b=2);`,
            "validateInvocationExpressionParameterRedefinition"
        ).resolves.toHaveLength(1);
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
            "validateOperatorExpressionCastConformance"
        ).resolves.toHaveLength(1);
    });

    test("square brackets trigger validation", async () => {
        return expectValidations(
            "feature a = 1 [0];",
            "validateOperatorExpressionBracketOperator"
        ).resolves.toHaveLength(1);
    });
});

describe("Item flows", () => {
    it("should trigger validation for multiple item features", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = ItemFlowMeta.create(id, doc, {
            item: [FeatureMembershipMeta.create(id, doc), ItemFeatureMeta.create(id, doc)],
            children: namespaceChildren([
                FeatureMembershipMeta.create(id, doc),
                ItemFeatureMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(ns, "validateItemFlowItemFeature").resolves.toHaveLength(2);
    });

    it("should trigger validation for item flow ends without owned features", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = ItemFlowEndMeta.create(id, doc, {});

        return expectModelValidations(ns, "validateItemFlowEndNestedFeature").resolves.toHaveLength(
            1
        );
    });

    it("should trigger validation for invalid item feature owning type", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = NamespaceMeta.create(id, doc, {
            children: namespaceChildren([
                FeatureMembershipMeta.create(id, doc),
                ItemFlowEndMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(ns, "validateItemFlowEndOwningType").resolves.toHaveLength(1);
    });

    test("invalid implicit subsetting triggers validation", async () => {
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
            "validateItemFlowEndImplicitSubsetting",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(2);
    });

    test("ends referencing non-nested features with qualified names trigger validation", async () => {
        return expectValidations(
            `
            feature a;
            feature b;
            flow from a to b;`,
            "validateItemFlowEndSubsetting"
        ).resolves.toHaveLength(2);
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
            [
                "checkConnectorTypeFeaturing",
                "validateItemFlowEndSubsetting",
                "validateItemFlowEndImplicitSubsetting",
            ]
        ).resolves.toHaveLength(0);
    });
});

describe("feature values", () => {
    it("should  trigger validation when redefining feature with a non-default value", async () => {
        return expectValidations(
            `
            class A {
                feature a = 3;
            }
            class B :> A {
                :>> a = 4;
            }
            `,
            "validateFeatureValueOverriding"
        ).resolves.toHaveLength(1);
    });
});

describe("multiplicity range return type", () => {
    it("should trigger validation for non-integer types", () => {
        return expectValidations(
            "class A; feature [0 as A];",
            "validateMultiplicityRangeBoundResultTypes"
        ).resolves.toHaveLength(1);
    });

    it.each(["-", "+", "*", "**", "^"])(
        "%s should not trigger validation with integer types",
        (op) => {
            return expectValidations(
                `class A; feature [0 ${op} 1];`,
                "validateMultiplicityRangeBoundResultTypes"
            ).resolves.toHaveLength(0);
        }
    );

    it("should not trigger validation for integer extent expressions", () => {
        return expectValidations(
            "class A; feature [0..1];",
            "validateMultiplicityRangeBoundResultTypes"
        ).resolves.toHaveLength(0);
    });

    it("should not trigger validation for conforming referenced features", () => {
        return expectValidations(
            "package ScalarValues { datatype Integer; } feature bound : ScalarValues::Integer; feature [bound];",
            "validateMultiplicityRangeBoundResultTypes",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });
});

describe("Metadata feature validations", () => {
    test("missing metaclass typing triggers validation", async () => {
        return expectValidations(
            "class M; metadata m : M;",
            "validateMetadataFeatureMetaclass"
        ).resolves.toHaveLength(1);
    });

    test("abstract typings trigger validation", async () => {
        return expectValidations(
            "abstract metaclass M; metadata m : M;",
            "validateMetadataFeatureMetaclassNotAbstract"
        ).resolves.toHaveLength(1);
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
            "validateMetadataFeatureAnnotatedElement",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(1);
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
            "validateMetadataFeatureBody"
        ).resolves.toHaveLength(1);
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
            "validateMetadataFeatureBody"
        ).resolves.toHaveLength(1);
    });
});

describe("Element filter memberships", () => {
    test("user-defined functions trigger validation", async () => {
        return expectValidations(
            "function Fn; import a::*[Fn()];",
            "validatePackageElementFilterIsModelLevelEvaluable"
        ).resolves.toHaveLength(1);
    });

    test("non-boolean filters trigger validation", async () => {
        return expectValidations(
            "import a::*[not 1];",
            "validatePackageElementFilterIsBoolean"
        ).resolves.toHaveLength(1);
    });

    test("boolean filters don't trigger validation", async () => {
        return expectValidations(
            `
            package ScalarValues {
                datatype Boolean;
            }
            package BaseFunctions {
                abstract function '@'{ 
                    return : ScalarValues::Boolean[1];
                }
            }
            import a::*[@Safety];`,
            "validatePackageElementFilterIsBoolean",
            { ...BUILD_OPTIONS, standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });
});

describe("Standard library package validation", () => {
    let settings: SysMLConfig;
    beforeAll(() => (settings = services.shared.workspace.ConfigurationProvider.get()));
    afterEach(() =>
        services.shared.workspace.ConfigurationProvider.updateConfiguration({
            settings: { [SETTINGS_KEY]: settings },
        })
    );

    test("no standard library path triggers validation", async () => {
        return expectValidations(
            "standard library package P {}",
            "validateLibraryPackageNotStandard"
        ).resolves.toHaveLength(1);
    });

    test("non standard library packages don't trigger validation", async () => {
        return expectValidations(
            "library package P {}",
            "validateLibraryPackageNotStandard"
        ).resolves.toHaveLength(0);
    });

    test("documents outside standard library path trigger validation", async () => {
        const config = { ...settings };
        config.standardLibraryPath = "/some/path";
        services.shared.workspace.ConfigurationProvider.updateConfiguration({
            settings: { [SETTINGS_KEY]: config },
        });
        return expectValidations(
            "standard library package P {}",
            "validateLibraryPackageNotStandard"
        ).resolves.toHaveLength(1);
    });
});
