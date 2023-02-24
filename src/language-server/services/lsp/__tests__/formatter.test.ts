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

import { FormattingOptions, TextDocumentIdentifier } from "vscode-languageserver";
import { SysMLFormatter } from "../formatter";
import { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import type { LangiumDocument, AstNode, DeepPartial } from "langium";
import { parseKerML, parseSysML } from "../../../../testing";
import * as ast from "../../../generated/ast";

const unformattedSysMLExample = `
part def Camera {import PictureTaking::*;perform action takePicture[*] :> PictureTaking::takePicture;
part focusingSubsystem {perform takePicture.focus;}
part imagingSubsystem {perform takePicture.shoot;}
}
`;

interface FormatOriginalDocumentReturnType {
    $document: LangiumDocument<AstNode>;
    formatChanges: TextEdit[];
}

interface TestFormattingOptions extends FormattingOptions {
    langId?: "kerml" | "sysml";
}

const formatter = new SysMLFormatter();

async function formatDocument(
    document: LangiumDocument,
    options: Partial<FormattingOptions>
): Promise<TextEdit[]> {
    return formatter.formatDocument(document, {
        options: { ...DefaultFormattingOptions, ...options },
        textDocument: TextDocumentIdentifier.create(document.uriString),
    });
}

const formatOriginalDocument = async (
    text: string,
    options: DeepPartial<TestFormattingOptions>
): Promise<FormatOriginalDocumentReturnType> => {
    const documentToFormat = await (options.langId === "kerml" ? parseKerML : parseSysML)(text, {
        validationChecks: "none",
    });

    expect(documentToFormat.value.$document).toBeDefined();

    const $document = documentToFormat.value.$document;

    if (!$document) throw new Error("Check line above. Document should be defined.");

    const formatChanges = await formatDocument($document, options);

    return { $document, formatChanges };
};

const DefaultFormattingOptions: FormattingOptions = {
    tabSize: 4,
    insertSpaces: true,
};

function testFormatting(
    text: string,
    expected: string | undefined,
    options: DeepPartial<TestFormattingOptions> = DefaultFormattingOptions
): void {
    if (expected) {
        expected = expected.trimStart();
        const expectFormatted = async (text: string): Promise<void> => {
            const { $document, formatChanges } = await formatOriginalDocument(text, options);

            expect($document.parseResult.parserErrors).toHaveLength(0);
            expect($document.parseResult.lexerErrors).toHaveLength(0);
            const formatted = TextDocument.applyEdits($document.textDocument, formatChanges);
            expect(formatted).toEqual(expected);
        };

        it("should format the document as expected", async () => {
            await expectFormatted(text);
        });
        test("formatting should be stable", async () => {
            await expectFormatted(expected as string);
        });
    } else {
        it("should not format the document", async () => {
            const { formatChanges } = await formatOriginalDocument(text, options);
            expect(formatChanges).toEqual([]);
        });
    }
}

describe("SysMLFormatter", () => {
    describe("document formatting", () => {
        describe("should format whole document correctly with 4 tabsize, with spaces", () => {
            testFormatting(
                unformattedSysMLExample,
                `
part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :> PictureTaking::takePicture;
    part focusingSubsystem {
        perform takePicture.focus;
    }
    part imagingSubsystem {
        perform takePicture.shoot;
    }
}
`
            );
        });

        describe("should format whole document correctly with 2 tabsize, with spaces", () => {
            testFormatting(
                unformattedSysMLExample,
                `
part def Camera {
  import PictureTaking::*;
  perform action takePicture [*] :> PictureTaking::takePicture;
  part focusingSubsystem {
    perform takePicture.focus;
  }
  part imagingSubsystem {
    perform takePicture.shoot;
  }
}
`,
                {
                    tabSize: 2,
                    insertSpaces: true,
                }
            );
        });

        describe("should format whole document correctly with 2 tabsize, with tabs", () => {
            testFormatting(
                unformattedSysMLExample,
                `
part def Camera {
	import PictureTaking::*;
	perform action takePicture [*] :> PictureTaking::takePicture;
	part focusingSubsystem {
		perform takePicture.focus;
	}
	part imagingSubsystem {
		perform takePicture.shoot;
	}
}
`,
                {
                    tabSize: 2,
                    insertSpaces: false,
                }
            );
        });

        describe("should format multiple elements in the root namespace", () => {
            testFormatting(
                `
    
            // comment
            part def A;
            
            
            
            part def B;part def C;`,
                `
// comment
part def A;

part def B;
part def C;`
            );
        });

        describe("should not format documents with parser errors", () => {
            testFormatting(
                `
            
            
            part a`,
                undefined
            );
        });

        describe("should indent package children in KerML", () => {
            testFormatting(
                `
        library package Pack {
            abstract class <klass> Klass;
            alias KK for Klass;
            
            comment Comment /* comment */
            
            type Type {
            doc /* doc */
            }
            }`,
                `
library package Pack {
    abstract class <klass> Klass;
    alias KK
        for Klass;

    comment Comment
        /* comment */

    type Type {
        doc /* doc */
    }
}`,
                { langId: "kerml" }
            );
        });

        describe("should remove any extraneous empty lines to the first child element", () => {
            testFormatting(
                `part def A{
            
            

    

    part a: A;
}`,
                `
part def A {
    part a : A;
}`
            );
        });

        describe("should leave a single empty line between children element", () => {
            testFormatting(
                `part def A{
    part a: A;





    part b: A;
}`,
                `
part def A {
    part a : A;

    part b : A;
}`
            );
        });

        describe("should a new line to the first child element", () => {
            testFormatting(
                "part def A{part a: A;}",
                `
part def A {
    part a : A;
}`
            );
        });

        describe("should remove any whitespace in-between braces if there are no children", () => {
            testFormatting(
                `part P {     
    
            }`,
                "part P {}"
            );
        });
    });

    describe("hidden comment formatting", () => {
        describe("should remove extraneous lines to single line comments when the comment is the first child element", () => {
            testFormatting(
                `part A{
            
            
            
            // comment
        }`,
                `
part A {
    // comment
}`
            );
        });

        describe("should remove extraneous lines to multiline comments when the comment is the first child element", () => {
            testFormatting(
                `part A{
            
            
            
            //* comment
            */
        }`,
                `
part A {
    //* comment
    */
}`
            );
        });

        describe("should remove extraneous lines to single line comments when the comment is not the first child element", () => {
            testFormatting(
                `part A{part a: A;
            
            
            
            // comment
        }`,
                `
part A {
    part a : A;

    // comment
}`
            );
        });

        describe("should remove extraneous lines to multiline comments when the comment is not the first child element", () => {
            testFormatting(
                `part A{part a: A;
            
            
            
            //* comment
            */
        }`,
                `
part A {
    part a : A;

    //* comment
    */
}`
            );
        });

        describe("should remove any whitespace to the root comment if it's the first element", () => {
            testFormatting(
                `
        
        
        // comment
`,
                "// comment\n"
            );
        });

        describe("should respect and indent AST continuations intersected by comments", () => {
            testFormatting(
                `
            #   // a comment
    
    
    
            Meta part P {
            }`,
                `
# // a comment
    Meta part P {}`
            );
        });

        describe("should respect and indent AST continuations intersected by comments and indented by tabs", () => {
            testFormatting(
                `
            #   // a comment
    
    
    
            Meta part P {
            }`,
                `
# // a comment
\tMeta part P {}`,
                { ...DefaultFormattingOptions, insertSpaces: false }
            );
        });

        describe("should leave a single leading space to end of line comment", () => {
            testFormatting("part P {}     // comment", "part P {} // comment");
            testFormatting("part P {} // comment", "part P {} // comment");
        });

        describe("should format comments in the root namespace", () => {
            testFormatting(
                `part P {}
            // comment`,
                `
part P {}
// comment`
            );
            testFormatting(
                `part P {}
    
    
            // comment`,
                `
part P {}

// comment`
            );
        });

        describe("should leave a single leading space to end of line multiline comment", () => {
            testFormatting("part P {}     //* comment */", "part P {} //* comment */");
        });

        describe("should format comments inside a reference", () => {
            testFormatting(
                "part P: A::       //* comment */   B {}",
                "part P : A:: //* comment */ B {}"
            );
        });

        describe("should format comments inside a multiline reference", () => {
            testFormatting(
                `
            part P: A::       // comment
            
                B {}`,
                `
part P : A:: // comment
            B {}`
            );
        });
    });

    describe(`${ast.MetadataFeature} formatting`, () => {
        describe("should remove any whitespace to metadata declarators", () => {
            testFormatting(
                `#     Meta part P {
                @
                
                Meta;
            }`,
                `
#Meta part P {
    @Meta;
}`
            );
        });

        describe.each([":", "defined   \nby"])("should format typed by keywords", (kw) => {
            testFormatting(
                `part def P { @ M   ${kw}   Meta { }}`,
                `
part def P {
    @M ${kw.replaceAll(/\s+/g, " ")} Meta {}
}`
            );
        });

        describe("should format 'about' on an indented line", () => {
            testFormatting(
                "  @   M :  Meta about A,   B  , C;",
                `
@M : Meta
    about A, B, C;`
            );
        });
    });

    describe("should leave no spaces inside of short name", () => {
        testFormatting("part <    a       >;", "part <a>;");
    });

    describe("should leave a single space after type keywords", () => {
        testFormatting("part    def    a;", "part def a;");
        testFormatting(
            `part    
        def    a;`,
            "part def a;"
        );
    });

    describe(`${ast.Comment} formatting`, () => {
        describe.each(["C", "<C>"])("should preserve `about` on new lines", (id) => {
            testFormatting(
                `comment ${id}
        
        about A, B /* comment */`,
                `
comment ${id}
    about A, B
    /* comment */`
            );
        });

        describe("should format a single space to `about` on the same line", () => {
            testFormatting(
                "comment C   about A, B /* comment */",
                "comment C\n    about A, B\n    /* comment */"
            );
        });

        describe("should leave a single space between references or indent them in `about`", () => {
            testFormatting(
                "comment C about   A  ,      \tB /* comment */",
                "comment C\n    about A, B\n    /* comment */"
            );

            testFormatting(
                "comment C about   A  ,      \n\n\tB /* comment */",
                "comment C\n    about A,\n        B\n    /* comment */"
            );
        });

        describe("should format 'about' on the same line without identifiers", () => {
            testFormatting(
                " comment   \n about  A  /* comment */",
                "comment about A\n    /* comment */"
            );
        });

        describe("multiline comment bodies are formatted and aligned", () => {
            describe("should format plain comments", () => {
                testFormatting(
                    `
            /* comment
            */`,
                    `
/*
 * comment
 */`
                );
            });

            describe("should format comment bodies", () => {
                testFormatting(
                    `
        comment /*
                 * a comment
                 */`,
                    `
comment /*
         * a comment
         */`
                );

                testFormatting(
                    `
        comment Comment /*
                 * a comment
                 */`,
                    `
comment Comment
    /*
     * a comment
     */`
                );
            });

            describe("should format doc bodies", () => {
                testFormatting(
                    `
        doc /*
                 * a comment
                 */`,
                    `
doc /*
     * a comment
     */`
                );

                testFormatting(
                    `
        doc Doc /*
                 * a comment
                 */`,
                    `
doc Doc
    /*
     * a comment
     */`
                );
            });

            describe("should insert tabs into indented comment bodies", () => {
                testFormatting(
                    `
            part def P {
                comment 
                
                /*
                        * a comment
                */
            }`,
                    `
part def P {
\tcomment /*
\t         * a comment
\t         */
}`,
                    { insertSpaces: false }
                );
            });

            describe("should not add trailing spaces to empty lines", () => {
                testFormatting(
                    `
            /* 1
            *
            * 2
            */`,
                    `
/*
 * 1
 *
 * 2
 */`
                );
            });
        });
    });

    describe("should format textual representations", () => {
        testFormatting(
            `
        rep     Rep language    "lang"  /*
        statement;
        */`,
            `
rep Rep language "lang"
    /*
     * statement;
     */`
        );
    });

    describe("should leave one space after visibility", () => {
        testFormatting("private       part    def P  ;", "private part def P;");
    });

    describe("should format Dependency clients and suppliers with an indent", () => {
        testFormatting(
            "       protected    #Meta       dependency    Dep  from A,   B to C  ,   D;",
            `
protected #Meta dependency Dep
    from A, B
    to C, D;`
        );

        testFormatting(
            "       protected    #Meta       dependency    Dep  from A,\n   B to C\n  ,   D;",
            `
protected #Meta dependency Dep
    from A,
        B
    to C, D;`
        );
    });

    describe("should format Alias 'for' on a new line with an identifier present", () => {
        testFormatting("  alias Alias   for A  ;", "alias Alias\n    for A;");
    });

    describe("should format Alias 'for' on the same line without an identifier present", () => {
        testFormatting("  alias   for A  ;", "alias for A;");
    });

    describe("KerML type is formatted", () => {
        describe("should format 'abstract' on the initial line", () => {
            testFormatting("  private       \n abstract  type   T;", "private abstract type T;", {
                langId: "kerml",
            });
        });

        describe("should preserve type keyword new line", () => {
            testFormatting(
                "  private       \n abstract  \n\ntype   T;",
                "private abstract type T;",
                { langId: "kerml" }
            );

            testFormatting(
                "  private       \n abstract   #Meta\n type   T;",
                "private abstract #Meta\n    type T;",
                { langId: "kerml" }
            );
        });

        describe.each([
            "specializes",
            ":>",
            "disjoint from",
            "unions",
            "intersects",
            "differences",
        ])("should format relationship lists with %s", (token) => {
            testFormatting(
                `
        private    type    ${token} A,  B  , C  ${token} D;`,
                `private type ${token} A, B, C ${token} D;`,
                { langId: "kerml" }
            );

            testFormatting(
                `
        private    type    ${token} A,  B  ,\n C \n${token} D;`,
                `
private type ${token} A, B,
        C
    ${token} D;`,
                { langId: "kerml" }
            );
        });

        describe("should format one space between 'disjoint' and 'from'", () => {
            testFormatting("type  disjoint   from    B,C;", "type disjoint from B, C;", {
                langId: "kerml",
            });
        });

        describe("should format 'all' surrounded by spaces", () => {
            testFormatting("abstract    type all T;", "abstract type all T;", {
                langId: "kerml",
            });
        });

        describe.each(["conjugates", "~"])("should format conjugates relationships", (token) => {
            testFormatting(
                `private  type   T  ${token}  A \n${token}  B;`,
                `
private type T ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );

            testFormatting(
                `private  type   T  ${token}  A \n${token}
                
                B;`,
                `
private type T ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );
        });
    });

    describe("should leave one space between 'assoc' and 'struct'", () => {
        testFormatting("  assoc   struct   A;", "assoc struct A;", { langId: "kerml" });
    });

    describe(`${ast.Feature} formatting`, () => {
        describe("explicit specialization formatting", () => {
            const table = [
                ["specialization", "typing", ":"],
                ["specialization", "typing", "typed   by"],
                ["specialization", "subclassifier", ":>"],
                ["specialization", "subclassifier", "specializes"],
                ["specialization", "subset", ":>"],
                ["specialization", "subset", "subsets"],
                ["specialization", "redefinition", "redefines"],
                ["specialization", "redefinition", ":>>"],
                ["specialization", "subtype", "specializes"],
                ["specialization", "subtype", ":>"],
                ["conjugation", "conjugate", "~"],
                ["conjugation", "conjugate", "conjugates"],
                ["disjoining", "disjoint", "from"],
                ["inverting", "inverse", "of"],
                ["featuring", "of", "by"],
            ];

            for (const items of table) {
                items.push(items[2].replaceAll(/\s+/g, " "));
            }

            describe.each(table)(
                "should format single line %s '%s' with '%s'",
                (kw, id, token, safeToken) => {
                    testFormatting(
                        `  public   ${kw}   \n${id}  A  ${token}   B { }`,
                        `public ${kw} ${id} A ${safeToken} B {}`,
                        { langId: "kerml" }
                    );
                }
            );

            describe.each(["<S>", "S"])("line breaks are preserved with name '%s'", (name) => {
                describe.each(table)(
                    "%s %s should preserve related types line breaks '%s'",
                    (kw, id, token, safeToken) => {
                        testFormatting(
                            `  public ${kw}   ${name}  \n ${id}    A\n${token} B;`,
                            `
public ${kw} ${name}
    ${id} A
    ${safeToken} B;`,
                            { langId: "kerml" }
                        );
                    }
                );
            });
        });

        describe.each(["return", "member"])("should format '%s' keyword", (kw) => {
            testFormatting(
                `function F { public   ${kw}    a : Real; }`,
                `
function F {
    public ${kw} a : Real;
}`,
                { langId: "kerml" }
            );
        });

        describe("should format 'nonunique' and 'ordered", () => {
            testFormatting(
                "part  P [ 0 ]    nonunique \n   ordered;",
                "part P [0] nonunique ordered;"
            );
        });

        describe.each(["in", "out", "inout", ""])(
            "feature modifiers formatting with direction '%s'",
            (direction) => {
                describe.each(["composite", "portion"])(
                    "should format feature modifiers onto a single line with '%s'",
                    (token) => {
                        testFormatting(
                            `  public  \n${direction}\t\n\t  abstract ${token}\treadonly   derived     end   feature   a  ;`,
                            `public${
                                direction.length === 0 ? "" : " " + direction
                            } abstract ${token} readonly derived end feature a;`,
                            { langId: "kerml" }
                        );
                    }
                );
            }
        );

        describe.each(["composite", "portion", "readonly", "derived", "end"])(
            "should preserve line breaks to prefixes with modifier '%s' present",
            (modifier) => {
                testFormatting(
                    `  public ${modifier} \n #Meta  feature   a ;`,
                    `
public ${modifier}
    #Meta feature a;`,
                    { langId: "kerml" }
                );
            }
        );

        describe.each([
            "subsets",
            ":>",
            "typed by",
            ":",
            "redefines",
            ":>>",
            "references",
            "::>",
            "featured by",
        ])("should format relationship lists with %s", (token) => {
            testFormatting(
                `
        private    feature :  X   ${token} A,  B  , C  ${token} D;`,
                `private feature : X ${token} A, B, C ${token} D;`,
                { langId: "kerml" }
            );

            testFormatting(
                `
        private    feature:X    ${token} A,  B  ,\n C \n${token} D;`,
                `
private feature : X ${token} A, B,
        C
    ${token} D;`,
                { langId: "kerml" }
            );
        });

        describe.each(["chains", "inverse of"])("should format '%s' relationships", (token) => {
            testFormatting(
                `private  feature   T:X  ${token}  A \n${token}  B;`,
                `
private feature T : X ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );

            testFormatting(
                `private  feature   T   :  X  ${token}  A \n${token}
                
                B;`,
                `
private feature T : X ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );
        });

        describe("should not do additional format on the relationship keyword if the feature starts with it", () => {
            testFormatting(
                "part def P { :>> a = 0;}",
                `
part def P {
    :>> a = 0;
}`
            );
        });

        describe("should format 'expr' as a feature", () => {
            testFormatting(
                "  abstract   expr  E  {  in x: A; x }",
                `
abstract expr E {
    in x : A;
    x
}`,
                { langId: "kerml" }
            );
        });
    });

    describe(`${ast.FeatureValue} formatting`, () => {
        describe.each(["default", "=", ":="])(
            "should format feature values on the same line with '%s'",
            (token) => {
                testFormatting(`attribute a   ${token}   1 + 2;`, `attribute a ${token} 1 + 2;`);
            }
        );

        describe.each(["=", ":="])("should leave one space between 'default' and '%s'", (token) => {
            testFormatting(
                `attribute a   default   ${token}   1 + 2;`,
                `attribute a default ${token} 1 + 2;`
            );
        });

        describe("should preserve line break to the expression", () => {
            testFormatting(
                "attribute a \n= \n 1 + 2;",
                `
attribute a =
    1 + 2;`
            );
        });
    });

    describe("should format filters on the same line", () => {
        testFormatting("private    filter   \n1 + 2  ;", "private filter 1 + 2;");
    });

    describe(`${ast.LibraryPackage} formatting`, () => {
        describe.each([" standard", ""])("should format%s library package ", (token) => {
            testFormatting(
                `  public    \n${token}\n  library\n   package P {\n}`,
                `public${token} library package P {}`
            );
        });

        describe.each([" standard", ""])(
            "should preserve line break before%s library 'package' with prefixes",
            (token) => {
                testFormatting(
                    `  public    \n${token}\n  library   #Meta\npackage P {\n}`,
                    `public${token} library #Meta\n    package P {}`
                );
            }
        );
    });

    describe(`${ast.Multiplicity} formatting`, () => {
        describe("should format multiplicity bounds", () => {
            testFormatting(
                "  public\n multiplicity M \t[  1  ] { }",
                "public multiplicity M [1] {}",
                { langId: "kerml" }
            );
        });

        describe.each([":>", "subsets"])(
            "should format multiplicity subsettings with '%s'",
            (token) => {
                testFormatting(
                    `  public\n multiplicity M \t${token} A ,   B{ }`,
                    `public multiplicity M ${token} A, B {}`,
                    { langId: "kerml" }
                );

                testFormatting(
                    `  public\n multiplicity M \t${token} A ,\n   B{ }`,
                    `public multiplicity M ${token} A,\n        B {}`,
                    { langId: "kerml" }
                );
            }
        );
    });

    describe(`${ast.Import} formatting`, () => {
        describe.each(["", "::*", "::**", "::*::**"])(
            "should format simple import statements on one line with '%s'",
            (suffix) => {
                testFormatting(
                    `  public   import   A::B  ${suffix} ;`,
                    `public import A::B${suffix};`
                );
                testFormatting(
                    `  public   import   all   A::B  ${suffix} ;`,
                    `public import all A::B${suffix};`
                );
            }
        );

        describe("should format filter conditions", () => {
            testFormatting(" import  A::B   [()] [  0 ];", "import A::B[()][0];");
            testFormatting(" import  A::B   [()]\n[  0 ];", "import A::B[()]\n    [0];");
        });
    });

    describe("should add an extra indent to line broken references", () => {
        testFormatting(
            "part p : X  ::  \n X {}",
            `
part p : X::
        X {}`
        );
    });

    describe(`${ast.Connector} formatting`, () => {
        describe("should format binary connectors", () => {
            testFormatting(
                " connector  all  from A to B;",
                `
connector all
    from A
    to B;`,
                { langId: "kerml" }
            );
        });

        describe("should format nary connectors", () => {
            testFormatting(
                " connector   (A, B,   C  ,  \nD  );",
                `
connector (
        A, B, C,
        D
    );`,
                { langId: "kerml" }
            );
        });
    });

    describe.each([
        [ast.BindingConnector, "binding", "of", "="],
        [ast.Succession, "succession", "first", "then"],
    ])("%s formatting", (_, type, prefix, binder) => {
        describe("should format single line nodes", () => {
            testFormatting(
                `  private  ${type}  all a   ${binder}   x ;`,
                `private ${type} all a ${binder} x;`,
                { langId: "kerml" }
            );
        });

        describe("should preserve line breaks between ends", () => {
            testFormatting(
                `  private  ${type}  all \n${prefix}   a   ${binder} \n  x ;`,
                `
private ${type} all
    ${prefix} a ${binder} x;`,
                { langId: "kerml" }
            );

            testFormatting(
                `  private  ${type}  all \n   a   ${binder} \n  x ;`,
                `
private ${type} all
    a ${binder} x;`,
                { langId: "kerml" }
            );
        });
    });

    describe.each([
        [ast.ItemFlow, "flow", "from", "to", true],
        [ast.SuccessionItemFlow, "succession    flow", "from", "to", true],
        [ast.FlowConnectionUsage, "message", "from", "to", false],
        [ast.FlowConnectionUsage, "flow", "from", "to", false],
        [ast.FlowConnectionUsage, "succession   flow", "from", "to", false],
    ])("%s formatting: '%s'", (_, type, prefix, binder, kerml) => {
        const safeType = type.replace(/\s+/, " ");
        const options: DeepPartial<TestFormattingOptions> = { langId: kerml ? "kerml" : "sysml" };

        describe("should format single line nodes", () => {
            testFormatting(
                `  private  ${type}   a   ${binder}   x ;`,
                `private ${safeType} a ${binder} x;`,
                options
            );

            testFormatting(
                `  private  ${type}      of  K ${prefix} a   ${binder}   x ;`,
                `private ${safeType} of K ${prefix} a ${binder} x;`,
                options
            );
        });

        describe("should preserve line breaks between ends", () => {
            testFormatting(
                `  private  ${type}   \n   a   ${binder} \n  x ;`,
                `
private ${safeType}
    a ${binder} x;`,
                options
            );

            testFormatting(
                `  private  ${type}  \nof K \n${prefix}   a   ${binder} \n  x ;`,
                `
private ${safeType} of K
    ${prefix} a ${binder} x;`,
                options
            );

            testFormatting(
                `  private  ${type}  : X\nof K \n${prefix}   a   ${binder} \n  x ;`,
                `
private ${safeType} : X
    of K
    ${prefix} a ${binder} x;`,
                options
            );
        });
    });

    describe(`${ast.Invariant} formatting`, () => {
        describe.each(["true", "false"])("should format '%s' next to the keyword", (token) => {
            testFormatting(`  private   inv \n ${token} { }`, `private inv ${token} {}`, {
                langId: "kerml",
            });
        });
    });

    describe(`${ast.Expression} formatting`, () => {
        describe("should format null expressions", () => {
            testFormatting("attribute a = (   );", "attribute a = ();");
        });

        describe("should leave no spaces between empty brackets in expressions", () => {
            testFormatting("part a = (    );", "part a = ();");
            testFormatting(
                `part a = (    
    
            );`,
                "part a = ();"
            );
        });

        describe.each([
            ["select", ".?"],
            ["collect", "."],
        ])("should format %s expression", (_, operator) => {
            testFormatting(
                `part  x =  A  ${operator}   {   in v ;  v  !=  null } ;`,
                `
part x = A${operator}{
        in v;
        v != null
    };`
            );
        });

        describe("should format body expression", () => {
            testFormatting(
                " item  x =   \n{ in v;  v  !=  null  } ;",
                `
item x = {
        in v;
        v != null
    };`
            );
        });

        describe("feature chain expressions", () => {
            describe("should format single line expressions", () => {
                testFormatting(" part  x  =  A  .  x  ;", "part x = A.x;");
            });

            describe("should format preserve line breaks", () => {
                testFormatting(
                    " part  x  =  A  .\n  x  ;",
                    `
part x = A.
        x;`
                );
            });
        });

        describe("should format named arguments", () => {
            testFormatting(
                " part  x  =  A  ( x   =   0,  y =  1  ) ;",
                `
part x = A(
        x=0,
        y=1
    );`
            );
        });

        describe("positional arguments", () => {
            describe("should format arguments on the same line", () => {
                testFormatting("part x =  A ( 0 ,   1,2    );", "part x = A(0, 1, 2);");
            });

            describe("should handle line breaks", () => {
                testFormatting(
                    "part x =  A ( 0 ,\n   1,2    );",
                    `
part x = A(
        0,
        1, 2
    );`
                );
            });

            describe("should format empty lists", () => {
                testFormatting("part x =   A  (    \n) ;", "part x = A();");
            });

            describe("should handle outer braces", () => {
                testFormatting(
                    "part x =  (  A ( 0 ,\n   1,2    )  );",
                    `
part x = (
        A(
            0,
            1, 2
        )
    );`
                );
            });
        });

        describe("should format metadata access expression", () => {
            testFormatting("part x =  A   .   metadata;", "part x = A.metadata;");
        });

        describe("arrow invocation expression", () => {
            describe("should format body expressions", () => {
                testFormatting(
                    "part x = A   ->  sum { in v; v };",
                    `
part x = A->sum{
        in v;
        v
    };`
                );
            });

            describe("should format function reference arg", () => {
                testFormatting("part x = A  -> sum  AddOne ;", "part x = A->sum AddOne;");
            });

            describe("should format argument lists", () => {
                testFormatting("part x = A   ->  sum ( 0,  2 , 3);", "part x = A->sum(0, 2, 3);");
            });
        });

        describe("operator expressions", () => {
            describe.each([
                ["extent", ".."],
                ["exponentiation", "**"],
                ["exponentiation", "^"],
            ])("%s expressions", (_, op) => {
                describe("should format single line expressions", () => {
                    testFormatting(`item x = 2   ${op}   4 ;`, `item x = 2${op}4;`);
                });

                describe("should format multi-line expressions", () => {
                    testFormatting(
                        `item x = 2   ${op} \n  4 ;`,
                        `
item x = 2${op}
        4;`
                    );
                });
            });

            describe("sequence expressions", () => {
                describe("should format single line expressions", () => {
                    testFormatting("item x =  (  0,  1,  2  , 3);", "item x = (0, 1, 2, 3);");
                });

                describe("should format multi-line expressions", () => {
                    testFormatting(
                        "item x =  (  0,  1,  \n2  , 3);",
                        `
item x = (
        0, 1,
        2, 3
    );`
                    );
                });
            });

            describe("should format conditional expressions", () => {
                testFormatting(
                    "part x = if   1  ?  0 else   \n\n1 ;",
                    `
part x = if 1
        ? 0
        else 1;`
                );
            });

            describe("indexing expressions", () => {
                describe("should format single line expressions", () => {
                    testFormatting("part x  =  A  [  0  ] ;", "part x = A[0];");
                });

                describe("should format multi-line expressions", () => {
                    testFormatting(
                        "part x  =  A  [  A.\nx  ] ;",
                        `
part x = A[
        A.
            x
    ];`
                    );
                });
            });

            describe.each([
                "??",
                "implies",
                "|",
                "or",
                "xor",
                "&",
                "and",
                "as",
                "istype",
                "hastype",
                "@",
                "@@",
                "meta",
                "+",
                "-",
                "*",
                "/",
                "%",
            ])("binary '%s' expressions", (op) => {
                describe("should format single line expressions", () => {
                    testFormatting(`part x =  A  ${op}  B ;`, `part x = A ${op} B;`);
                });

                describe("should format multi-line expressions", () => {
                    testFormatting(
                        `part x =  A  \n ${op} B ;`,
                        `
part x = A
    ${op} B;`
                    );
                });
            });

            describe.each([
                ["all", " "],
                ["not", " "],
                ["+", ""],
                ["-", ""],
                ["~", ""],
            ])("'%s' expressions", (op, space) => {
                describe("should format single line expressions", () => {
                    testFormatting(`part x =  ${op}  A ;`, `part x = ${op}${space}A;`);
                });
            });
        });
    });

    describe("SysML keywords", () => {
        describe("should format conjugated port references", () => {
            testFormatting("part a defined   by  ~  \nPort {}", "part a defined by ~Port {}");
            testFormatting("part a    :  ~  \nPort {}", "part a : ~Port {}");
        });

        describe("should format 'defined by' in usages", () => {
            testFormatting("part a  defined   by  A ;", "part a defined by A;");
        });

        describe("should format 'variation'", () => {
            testFormatting("  variation  part  def A;", "variation part def A;");
            testFormatting("  variation  part   A;", "variation part A;");
        });

        describe("should format 'individual'", () => {
            testFormatting("  individual  occurrence  def A;", "individual occurrence def A;");
            testFormatting("  individual  occurrence   A;", "individual occurrence A;");
        });

        describe("should format 'variant'", () => {
            testFormatting(
                " part def P {  variant  part   A; }",
                `
part def P {
    variant part A;
}`
            );
        });

        describe.each(["timeslice", "snapshot"])("should format portion kind '%s'", (tok) => {
            testFormatting(`  ${tok}  occurrence   A;`, `${tok} occurrence A;`);
        });

        describe("should format metadata body usage", () => {
            testFormatting(
                `  metadata  Meta  :  M{
            Ref;
        }`,
                `
metadata Meta : M {
    Ref;
}`
            );
        });

        describe("should format 'ref'", () => {
            testFormatting("  ref  part   A;", "ref part A;");
        });

        describe("should format reference usages", () => {
            testFormatting("  ref A :   B;", "ref A : B;");
        });

        describe("should format enumeration definition", () => {
            testFormatting(
                "enum def Color {R;G;B;}",
                `
enum def Color {
    R;
    G;
    B;
}`
            );
        });

        describe("should format extended definition", () => {
            testFormatting("  #Meta   def  P { }", "#Meta def P {}");
        });

        describe("should format extended usage", () => {
            testFormatting("  #Meta     P { }", "#Meta P {}");
        });

        describe("should format event occurrence usage", () => {
            testFormatting("  event\noccurrence \nA :  B {}", "event occurrence A : B {}");
            testFormatting("  event\nA :  B {}", "event A : B {}");
        });

        describe("should format empty succession usage", () => {
            testFormatting(
                "part def P  { then    [ * ]    occurrence O : A {} }",
                `
part def P {
    then [*] occurrence O : A {}
}`
            );
        });

        describe("should format 'subject'", () => {
            testFormatting(
                "  requirement  def  R { public   subject   S:X   ; }",
                `
requirement def R {
    public subject S : X;
}`
            );
        });

        describe("should format 'frame'", () => {
            testFormatting(
                "  requirement  def  R { public   frame  concern   C:X   ; }",
                `
requirement def R {
    public frame concern C : X;
}`
            );
        });
    });

    describe.each([
        [ast.BindingConnectorAsUsage, "binding", "bind", "="],
        [ast.SuccessionAsUsage, "succession", "first", "then"],
    ])("%s formatting", (_, type, prefix, binder) => {
        describe("should format single line nodes", () => {
            testFormatting(
                `  private  ${type}  ${prefix} a   ${binder}   x ;`,
                `private ${type} ${prefix} a ${binder} x;`
            );
        });

        describe("should preserve line breaks between ends", () => {
            testFormatting(
                `  private  ${type}   \n${prefix}   a   ${binder} \n  x ;`,
                `
private ${type}
    ${prefix} a ${binder} x;`
            );
        });
    });

    describe(`${ast.ConnectionUsage} formatting`, () => {
        describe("should format single line nodes", () => {
            testFormatting(
                "  private  connection   connect a   to   x ;",
                `
private connection
    connect a
    to x;`
            );
        });

        describe("should format 'connect' on the same line if there is no 'connection'", () => {
            testFormatting(
                "  private     connect a   to   x ;",
                `
private connect a
    to x;`
            );
        });

        describe("should format end lists", () => {
            testFormatting(
                "  private connect (  a ,  b , \n  d )  {  }",
                `
private connect (
        a, b,
        d
    ) {}`
            );
        });

        describe("should preserve line breaks between ends", () => {
            testFormatting(
                "  private  connection   \nconnect   a   to \n  x ;",
                `
private connection
    connect a
    to x;`
            );
        });
    });

    describe.each([
        [ast.InterfaceUsage, "interface", "connect"],
        [ast.AllocationUsage, "allocation", "allocate"],
    ])("%s formatting", (_, kw, connect) => {
        describe("should format single line nodes", () => {
            testFormatting(
                `  private  ${kw}   ${connect} a   to   x ;`,
                `
private ${kw}
    ${connect} a
    to x;`
            );
        });

        describe("should format end lists", () => {
            testFormatting(
                `  private  ${kw}  ${connect} (  a ,  b , \n  d )  {  }`,
                `
private ${kw} ${connect} (
        a, b,
        d
    ) {}`
            );
        });

        describe("should preserve line breaks between ends", () => {
            testFormatting(
                `  private  ${kw}   \n${connect}   a   to \n  x ;`,
                `
private ${kw}
    ${connect} a
    to x;`
            );
        });
    });

    describe(`${ast.PerformActionUsage} formatting`, () => {
        describe("should leave one space after 'perform'", () => {
            testFormatting("  perform   \t action  A ;", "perform action A;");
            testFormatting("  perform   \t  A ;", "perform A;");
        });
    });

    describe("Action nodes formatting", () => {
        describe(`should format ${ast.InitialNode}`, () => {
            testFormatting(
                " action  A {  private   first   B  {}}",
                `
action A {
    private first B {}
}`
            );
        });

        describe(`should format ${ast.AcceptActionUsage}`, () => {
            testFormatting(
                " action  A {  private   action  AA:X accept   B   at  0  via C{}}",
                `
action A {
    private action AA : X
        accept B at 0
        via C {}
}`
            );
        });

        describe(`should format ${ast.SendActionUsage}`, () => {
            testFormatting(
                " action  A {  private   action  AA:X send   B     via C  to \nD{}}",
                `
action A {
    private action AA : X
        send B
        via C
        to D {}
}`
            );
        });

        describe.each([[ast.AssignmentActionUsage, "action", "assign", ":="]])(
            "%s formatting",
            (_, type, prefix, binder) => {
                describe("should format single line nodes", () => {
                    testFormatting(
                        ` action A { private  ${type}  ${prefix} a   ${binder}   x ; }`,
                        `
action A {
    private ${type} ${prefix} a ${binder} x;
}`
                    );
                });

                describe("should preserve line breaks between ends", () => {
                    testFormatting(
                        `  action A{private  ${type}   \n${prefix}   a   ${binder} \n  x ;}`,
                        `
action A {
    private ${type}
        ${prefix} a ${binder} x;
}`
                    );
                });
            }
        );

        describe(`should format ${ast.IfActionUsage}`, () => {
            testFormatting(
                " action   A { public  action  if  true  action   { action Sub;}   else  action  { action Sub;}  }",
                `
action A {
    public action
        if true
            action {
                action Sub;
            }
        else action {
                action Sub;
            }
}`
            );
        });

        describe(`${ast.WhileLoopActionUsage} formatting`, () => {
            describe("should format 'while'", () => {
                testFormatting(
                    "  action A  { private  action  W  while   ( 1  +  1  \n >  0)   action { action Sub;}   until   false ;}",
                    `
action A {
    private action W
        while (
            1 + 1
            > 0
        )
            action {
                action Sub;
            }
        until false;
}`
                );
            });

            describe("should format 'loop'", () => {
                testFormatting(
                    "  action A  { private  action  W  loop   action { action Sub;}   until   false ;}",
                    `
action A {
    private action W
        loop
            action {
                action Sub;
            }
        until false;
}`
                );
            });
        });

        describe(`${ast.ForLoopActionUsage} formatting`, () => {
            describe("should format for loop", () => {
                testFormatting(
                    "  action A  { private  action  L  for   i:Integer   in   List    action { action Sub;} }",
                    `
action A {
    private action L
        for i : Integer in List
            action {
                action Sub;
            }
}`
                );
            });
        });

        describe.each(["merge", "decide", "join", "fork"])(
            `${ast.ControlNode} '%s' formatting`,
            (kw) => {
                describe("should format control node", () => {
                    testFormatting(
                        ` action A  {  private   individual  ${kw}   Node:N {   }  }`,
                        `
action A {
    private individual ${kw} Node : N {}
}`
                    );
                });
            }
        );
    });

    describe(`${ast.TransitionUsage} formatting`, () => {
        describe("should format guarded target succession", () => {
            testFormatting(
                "action A { private    if  true   then   A ; }",
                `
action A {
    private
        if true
        then A;
}`
            );
        });

        describe("should format default target succession", () => {
            testFormatting(
                "action A { private    else    A   ; }",
                `
action A {
    private
        else A;
}`
            );
        });

        describe("should format transition usage", () => {
            testFormatting(
                `
            state     def   S{ public   transition  T:X   first  A   
                accept  B    if   false   do    action AA{}  then    C{}}`,
                `
state def S {
    public transition T : X
        first A
        accept B
        if false
        do action AA {}
        then C {}
}`
            );
        });
    });

    describe(`${ast.StateUsage} formatting`, () => {
        describe.each([["entry", "do", "exit"]])("should format '%s' subaction", (kw) => {
            testFormatting(
                `state def S { public    \n${kw}    action{}}`,
                `
state def S {
    public ${kw} action {}
}`
            );
        });
    });

    describe(`${ast.AssertConstraintUsage} formatting`, () => {
        describe("should format 'assert' statements", () => {
            testFormatting("  public   assert   A  ;", "public assert A;");
        });

        describe("should format 'assert not' statements", () => {
            testFormatting(
                "  public   assert   not     constraint   A  ;",
                "public assert not constraint A;"
            );
        });

        describe("should format 'assert' constraint statements", () => {
            testFormatting("  public   assert   constraint   A  ;", "public assert constraint A;");
        });

        describe("should format 'assert not' constraint statements", () => {
            testFormatting(
                "  public   assert   not     constraint   A  ;",
                "public assert not constraint A;"
            );
        });
    });

    describe(`${ast.ConstraintUsage} formatting`, () => {
        describe.each(["assume", "require"])("should format constraint kind '%s'", (kind) => {
            testFormatting(
                `  requirement R {public   ${kind}\n   constraint;}`,
                `
requirement R {
    public ${kind} constraint;
}`
            );
        });
    });

    describe(`${ast.PartUsage} formatting`, () => {
        describe.each(["actor", "stakeholder"])("should format parameter kind '%s'", (kind) => {
            testFormatting(
                `  requirement R {public   ${kind}\n   P;}`,
                `
requirement R {
    public ${kind} P;
}`
            );
        });
    });

    describe(`${ast.SatisfyRequirementUsage} formatting`, () => {
        describe("should format 'satisfy'", () => {
            testFormatting(
                "  requirement R {public   assert   not  \nsatisfy  requirement R;}",
                `
requirement R {
    public assert not satisfy requirement R;
}`
            );
        });

        describe("should format 'by'", () => {
            testFormatting(
                "  requirement R {public   assert     \nsatisfy  requirement R\n\nby     X   ;}",
                `
requirement R {
    public assert satisfy requirement R
        by X;
}`
            );
        });
    });

    describe(`${ast.RequirementUsage} formatting`, () => {
        describe.each([
            ["objective", "case"],
            ["verify", "requirement"],
        ])("should format requirement kind '%s'", (kind, type) => {
            testFormatting(
                `  ${type} def R {public   ${kind}\n    #  Meta;}`,
                `
${type} def R {
    public ${kind} #Meta;
}`
            );
        });
    });

    describe("Use case formatting", () => {
        describe("should format 'use case'", () => {
            testFormatting("  use   case   def   U;", "use case def U;");
            testFormatting("  use   case   U;", "use case U;");
            testFormatting("  include   use   case   U;", "include use case U;");
        });
    });
});
