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

const formatOriginalDocument = async (
    text: string,
    options: DeepPartial<TestFormattingOptions>
): Promise<FormatOriginalDocumentReturnType> => {
    const formatter = new SysMLFormatter();
    const documentToFormat = await (options.langId === "kerml" ? parseKerML : parseSysML)(text, {
        validationChecks: "none",
    });

    expect(documentToFormat.value.$document).toBeDefined();

    const $document = documentToFormat.value.$document;

    if (!$document) throw new Error("Check line above. Document should be defined.");

    const formatChanges = await formatter.formatDocument($document, {
        options: { ...DefaultFormattingOptions, ...options },
        textDocument: TextDocumentIdentifier.create($document.uri.toString()),
    });

    return { $document, formatChanges };
};

const DefaultFormattingOptions: FormattingOptions = {
    tabSize: 4,
    insertSpaces: true,
};

async function testFormatting(
    text: string,
    expected: string | undefined,
    options: DeepPartial<TestFormattingOptions> = DefaultFormattingOptions
): Promise<void> {
    const { $document, formatChanges } = await formatOriginalDocument(text, options);

    if (expected) {
        expect($document.parseResult.parserErrors).toHaveLength(0);
        expect($document.parseResult.lexerErrors).toHaveLength(0);
        const formatted = TextDocument.applyEdits($document.textDocument, formatChanges);
        expect(formatted).toEqual(expected.trimStart());
    } else {
        expect(formatChanges).toEqual([]);
    }
}

describe("SysMLFormatter", () => {
    describe("document formatting", () => {
        it("should format whole document correctly with 4 tabsize, with spaces", async () => {
            await testFormatting(
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

        it("should format whole document correctly with 2 tabsize, with spaces", async () => {
            await testFormatting(
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

        it("should format whole document correctly with 2 tabsize, with tabs", async () => {
            await testFormatting(
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

        it("should format multiple elements in the root namespace", async () => {
            await testFormatting(
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

        it("should not format documents with parser errors", async () => {
            await testFormatting(
                `
            
            
            part a`,
                undefined
            );
        });

        it("should indent package children in KerML", async () => {
            await testFormatting(
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

        it("should remove any extraneous empty lines to the first child element", async () => {
            await testFormatting(
                `part def A{
            
            

    

    part a: A;
}`,
                `
part def A {
    part a : A;
}`
            );
        });

        it("should leave a single empty line between children element", async () => {
            await testFormatting(
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

        it("should a new line to the first child element", async () => {
            await testFormatting(
                "part def A{part a: A;}",
                `
part def A {
    part a : A;
}`
            );
        });

        it("should remove any whitespace in-between braces if there are no children", async () => {
            await testFormatting(
                `part P {     
    
            }`,
                "part P {}"
            );
        });
    });

    describe("hidden comment formatting", () => {
        it("should remove extraneous lines to single line comments when the comment is the first child element", async () => {
            await testFormatting(
                `part A{
            
            
            
            // comment
        }`,
                `
part A {
    // comment
}`
            );
        });

        it("should remove extraneous lines to multiline comments when the comment is the first child element", async () => {
            await testFormatting(
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

        it("should remove extraneous lines to single line comments when the comment is not the first child element", async () => {
            await testFormatting(
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

        it("should remove extraneous lines to multiline comments when the comment is not the first child element", async () => {
            await testFormatting(
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

        it("should remove any whitespace to the root comment if it's the first element", async () => {
            await testFormatting(
                `
        
        
        // comment
`,
                "// comment\n"
            );
        });

        it("should respect and indent AST continuations intersected by comments", async () => {
            await testFormatting(
                `
            #   // a comment
    
    
    
            Meta part P {
            }`,
                `
# // a comment
    Meta part P {}`
            );
        });

        it("should respect and indent AST continuations intersected by comments and indented by tabs", async () => {
            await testFormatting(
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

        it("should leave a single leading space to end of line comment", async () => {
            await testFormatting("part P {}     // comment", "part P {} // comment");
            await testFormatting("part P {} // comment", "part P {} // comment");
        });

        it("should format comments in the root namespace", async () => {
            await testFormatting(
                `part P {}
            // comment`,
                `
part P {}
// comment`
            );
            await testFormatting(
                `part P {}
    
    
            // comment`,
                `
part P {}

// comment`
            );
        });

        it("should leave a single leading space to end of line multiline comment", async () => {
            await testFormatting("part P {}     //* comment */", "part P {} //* comment */");
        });

        it("should format comments inside a reference", async () => {
            await testFormatting(
                "part P: A::       //* comment */   B {}",
                "part P : A:: //* comment */ B {}"
            );
        });

        it("should format comments inside a multiline reference", async () => {
            await testFormatting(
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
        it("should remove any whitespace to metadata declarators", async () => {
            await testFormatting(
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

        it.each([":", "defined   \nby"])("should format typed by keywords", async (kw) => {
            await testFormatting(
                `part def P { @ M   ${kw}   Meta { }}`,
                `
part def P {
    @M ${kw.replaceAll(/\s+/g, " ")} Meta {}
}`
            );
        });

        it("should format 'about' on an indented line", async () => {
            await testFormatting(
                "  @   M :  Meta about A,   B  , C;",
                `
@M : Meta
    about A, B, C;`
            );
        });
    });

    it("should leave no spaces inside of short name", async () => {
        await testFormatting("part <    a       >;", "part <a>;");
    });

    it("should leave a single space after type keywords", async () => {
        await testFormatting("part    def    a;", "part def a;");
        await testFormatting(
            `part    
        def    a;`,
            "part def a;"
        );
    });

    describe(`${ast.Comment} formatting`, () => {
        it.each(["C", "<C>"])("should preserve `about` on new lines", async (id) => {
            await testFormatting(
                `comment ${id}
        
        about A, B /* comment */`,
                `
comment ${id}
    about A, B
    /* comment */`
            );
        });

        it("should format a single space to `about` on the same line", async () => {
            await testFormatting(
                "comment C   about A, B /* comment */",
                "comment C\n    about A, B\n    /* comment */"
            );
        });

        it("should leave a single space between references or indent them in `about`", async () => {
            await testFormatting(
                "comment C about   A  ,      \tB /* comment */",
                "comment C\n    about A, B\n    /* comment */"
            );

            await testFormatting(
                "comment C about   A  ,      \n\n\tB /* comment */",
                "comment C\n    about A,\n        B\n    /* comment */"
            );
        });

        it("should format 'about' on the same line without identifiers", async () => {
            await testFormatting(
                " comment   \n about  A  /* comment */",
                "comment about A\n    /* comment */"
            );
        });

        describe("multiline comment bodies are formatted and aligned", () => {
            it("should format plain comments", async () => {
                await testFormatting(
                    `
            /* comment
            */`,
                    `
/*
 * comment
 */`
                );
            });

            it("should format comment bodies", async () => {
                await testFormatting(
                    `
        comment /*
                 * a comment
                 */`,
                    `
comment /*
         * a comment
         */`
                );

                await testFormatting(
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

            it("should format doc bodies", async () => {
                await testFormatting(
                    `
        doc /*
                 * a comment
                 */`,
                    `
doc /*
     * a comment
     */`
                );

                await testFormatting(
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

            it("should insert tabs into indented comment bodies", async () => {
                await testFormatting(
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

            it("should not add trailing spaces to empty lines", async () => {
                await testFormatting(
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

    it("should format textual representations", async () => {
        await testFormatting(
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

    it("should leave one space after visibility", async () => {
        await testFormatting("private       part    def P  ;", "private part def P;");
    });

    it("should format Dependency clients and suppliers with an indent", async () => {
        await testFormatting(
            "       protected    #Meta       dependency    Dep  from A,   B to C  ,   D;",
            `
protected #Meta dependency Dep
    from A, B
    to C, D;`
        );

        await testFormatting(
            "       protected    #Meta       dependency    Dep  from A,\n   B to C\n  ,   D;",
            `
protected #Meta dependency Dep
    from A,
        B
    to C, D;`
        );
    });

    it("should format Alias 'for' on a new line with an identifier present", async () => {
        await testFormatting("  alias Alias   for A  ;", "alias Alias\n    for A;");
    });

    it("should format Alias 'for' on the same line without an identifier present", async () => {
        await testFormatting("  alias   for A  ;", "alias for A;");
    });

    describe("KerML type is formatted", () => {
        it("should format 'abstract' on the initial line", async () => {
            await testFormatting(
                "  private       \n abstract  type   T;",
                "private abstract type T;",
                { langId: "kerml" }
            );
        });

        it("should preserve type keyword new line", async () => {
            await testFormatting(
                "  private       \n abstract  \n\ntype   T;",
                "private abstract type T;",
                { langId: "kerml" }
            );

            await testFormatting(
                "  private       \n abstract   #Meta\n type   T;",
                "private abstract #Meta\n    type T;",
                { langId: "kerml" }
            );
        });

        it.concurrent.each([
            "specializes",
            ":>",
            "disjoint from",
            "unions",
            "intersects",
            "differences",
        ])("should format relationship lists with %s", async (token) => {
            await testFormatting(
                `
        private    type    ${token} A,  B  , C  ${token} D;`,
                `private type ${token} A, B, C ${token} D;`,
                { langId: "kerml" }
            );

            await testFormatting(
                `
        private    type    ${token} A,  B  ,\n C \n${token} D;`,
                `
private type ${token} A, B,
        C
    ${token} D;`,
                { langId: "kerml" }
            );
        });

        it("should format one space between 'disjoint' and 'from'", async () => {
            await testFormatting("type  disjoint   from    B,C;", "type disjoint from B, C;", {
                langId: "kerml",
            });
        });

        it("should format 'all' surrounded by spaces", async () => {
            await testFormatting("abstract    type all T;", "abstract type all T;", {
                langId: "kerml",
            });
        });

        it.each(["conjugates", "~"])("should format conjugates relationships", async (token) => {
            await testFormatting(
                `private  type   T  ${token}  A \n${token}  B;`,
                `
private type T ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );

            await testFormatting(
                `private  type   T  ${token}  A \n${token}
                
                B;`,
                `
private type T ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );
        });
    });

    it("should leave one space between 'assoc' and 'struct'", async () => {
        await testFormatting("  assoc   struct   A;", "assoc struct A;", { langId: "kerml" });
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

            it.each(table)(
                "should format single line %s '%s' with '%s'",
                async (kw, id, token, safeToken) => {
                    await testFormatting(
                        `  public   ${kw}   \n${id}  A  ${token}   B { }`,
                        `public ${kw} ${id} A ${safeToken} B {}`,
                        { langId: "kerml" }
                    );
                }
            );

            describe.each(["<S>", "S"])("line breaks are preserved with name '%s'", (name) => {
                it.each(table)(
                    "%s %s should preserve related types line breaks '%s'",
                    async (kw, id, token, safeToken) => {
                        await testFormatting(
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

        it.each(["return", "member"])("should format '%s' keyword", async (kw) => {
            await testFormatting(
                `function F { public   ${kw}    a : Real; }`,
                `
function F {
    public ${kw} a : Real;
}`,
                { langId: "kerml" }
            );
        });

        it("should format 'nonunique' and 'ordered", async () => {
            await testFormatting(
                "part  P [ 0 ]    nonunique \n   ordered;",
                "part P [0] nonunique ordered;"
            );
        });

        describe.each(["in", "out", "inout", ""])(
            "feature modifiers formatting with direction '%s'",
            (direction) => {
                it.each(["composite", "portion"])(
                    "should format feature modifiers onto a single line with '%s'",
                    async (token) => {
                        await testFormatting(
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

        it.each(["composite", "portion", "readonly", "derived", "end"])(
            "should preserve line breaks to prefixes with modifier '%s' present",
            async (modifier) => {
                await testFormatting(
                    `  public ${modifier} \n #Meta  feature   a ;`,
                    `
public ${modifier}
    #Meta feature a;`,
                    { langId: "kerml" }
                );
            }
        );

        it.concurrent.each([
            "subsets",
            ":>",
            "typed by",
            ":",
            "redefines",
            ":>>",
            "references",
            "::>",
            "featured by",
        ])("should format relationship lists with %s", async (token) => {
            await testFormatting(
                `
        private    feature :  X   ${token} A,  B  , C  ${token} D;`,
                `private feature : X ${token} A, B, C ${token} D;`,
                { langId: "kerml" }
            );

            await testFormatting(
                `
        private    feature:X    ${token} A,  B  ,\n C \n${token} D;`,
                `
private feature : X ${token} A, B,
        C
    ${token} D;`,
                { langId: "kerml" }
            );
        });

        it.each(["chains", "inverse of"])("should format '%s' relationships", async (token) => {
            await testFormatting(
                `private  feature   T:X  ${token}  A \n${token}  B;`,
                `
private feature T : X ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );

            await testFormatting(
                `private  feature   T   :  X  ${token}  A \n${token}
                
                B;`,
                `
private feature T : X ${token} A
    ${token} B;`,
                { langId: "kerml" }
            );
        });

        it("should not do additional format on the relationship keyword if the feature starts with it", async () => {
            await testFormatting(
                "part def P { :>> a = 0;}",
                `
part def P {
    :>> a = 0;
}`
            );
        });

        it("should format 'expr' as a feature", async () => {
            await testFormatting(
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
        it.each(["default", "=", ":="])(
            "should format feature values on the same line with '%s'",
            async (token) => {
                await testFormatting(
                    `attribute a   ${token}   1 + 2;`,
                    `attribute a ${token} 1 + 2;`
                );
            }
        );

        it.each(["=", ":="])("should leave one space between 'default' and '%s'", async (token) => {
            await testFormatting(
                `attribute a   default   ${token}   1 + 2;`,
                `attribute a default ${token} 1 + 2;`
            );
        });

        it("should preserve line break to the expression", async () => {
            await testFormatting(
                "attribute a \n= \n 1 + 2;",
                `
attribute a =
    1 + 2;`
            );
        });
    });

    it("should format filters on the same line", async () => {
        await testFormatting("private    filter   \n1 + 2  ;", "private filter 1 + 2;");
    });

    describe(`${ast.LibraryPackage} formatting`, () => {
        it.each([" standard", ""])("should format%s library package ", async (token) => {
            await testFormatting(
                `  public    \n${token}\n  library\n   package P {\n}`,
                `public${token} library package P {}`
            );
        });

        it.each([" standard", ""])(
            "should preserve line break before%s library 'package' with prefixes",
            async (token) => {
                await testFormatting(
                    `  public    \n${token}\n  library   #Meta\npackage P {\n}`,
                    `public${token} library #Meta\n    package P {}`
                );
            }
        );
    });

    describe(`${ast.Multiplicity} formatting`, () => {
        it("should format multiplicity bounds", async () => {
            await testFormatting(
                "  public\n multiplicity M \t[  1  ] { }",
                "public multiplicity M [1] {}",
                { langId: "kerml" }
            );
        });

        it.each([":>", "subsets"])(
            "should format multiplicity subsettings with '%s'",
            async (token) => {
                await testFormatting(
                    `  public\n multiplicity M \t${token} A ,   B{ }`,
                    `public multiplicity M ${token} A, B {}`,
                    { langId: "kerml" }
                );

                await testFormatting(
                    `  public\n multiplicity M \t${token} A ,\n   B{ }`,
                    `public multiplicity M ${token} A,\n        B {}`,
                    { langId: "kerml" }
                );
            }
        );
    });

    describe(`${ast.Import} formatting`, () => {
        it.each(["", "::*", "::**", "::*::**"])(
            "should format simple import statements on one line with '%s'",
            async (suffix) => {
                await testFormatting(
                    `  public   import   A::B  ${suffix} ;`,
                    `public import A::B${suffix};`
                );
                await testFormatting(
                    `  public   import   all   A::B  ${suffix} ;`,
                    `public import all A::B${suffix};`
                );
            }
        );

        it("should format filter conditions", async () => {
            await testFormatting(" import  A::B   [()] [  0 ];", "import A::B[()][0];");
            await testFormatting(" import  A::B   [()]\n[  0 ];", "import A::B[()]\n    [0];");
        });
    });

    it("should add an extra indent to line broken references", async () => {
        await testFormatting(
            "part p : X  ::  \n X {}",
            `
part p : X::
        X {}`
        );
    });

    describe(`${ast.Connector} formatting`, () => {
        it("should format binary connectors", async () => {
            await testFormatting(
                " connector  all  from A to B;",
                `
connector all
    from A
    to B;`,
                { langId: "kerml" }
            );
        });

        it("should format nary connectors", async () => {
            await testFormatting(
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
        it("should format single line nodes", async () => {
            await testFormatting(
                `  private  ${type}  all a   ${binder}   x ;`,
                `private ${type} all a ${binder} x;`,
                { langId: "kerml" }
            );
        });

        it("should preserve line breaks between ends", async () => {
            await testFormatting(
                `  private  ${type}  all \n${prefix}   a   ${binder} \n  x ;`,
                `
private ${type} all
    ${prefix} a ${binder} x;`,
                { langId: "kerml" }
            );

            await testFormatting(
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

        it("should format single line nodes", async () => {
            await testFormatting(
                `  private  ${type}   a   ${binder}   x ;`,
                `private ${safeType} a ${binder} x;`,
                options
            );

            await testFormatting(
                `  private  ${type}      of  K ${prefix} a   ${binder}   x ;`,
                `private ${safeType} of K ${prefix} a ${binder} x;`,
                options
            );
        });

        it("should preserve line breaks between ends", async () => {
            await testFormatting(
                `  private  ${type}   \n   a   ${binder} \n  x ;`,
                `
private ${safeType}
    a ${binder} x;`,
                options
            );

            await testFormatting(
                `  private  ${type}  \nof K \n${prefix}   a   ${binder} \n  x ;`,
                `
private ${safeType} of K
    ${prefix} a ${binder} x;`,
                options
            );

            await testFormatting(
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
        it.each(["true", "false"])("should format '%s' next to the keyword", async (token) => {
            await testFormatting(`  private   inv \n ${token} { }`, `private inv ${token} {}`, {
                langId: "kerml",
            });
        });
    });

    describe(`${ast.Expression} formatting`, () => {
        it("should format null expressions", async () => {
            await testFormatting("attribute a = (   );", "attribute a = ();");
        });

        it("should leave no spaces between empty brackets in expressions", async () => {
            await testFormatting("part a = (    );", "part a = ();");
            await testFormatting(
                `part a = (    
    
            );`,
                "part a = ();"
            );
        });

        it.each([
            ["select", ".?"],
            ["collect", "."],
        ])("should format %s expression", async (_, operator) => {
            await testFormatting(
                `part  x =  A  ${operator}   {   in v ;  v  !=  null } ;`,
                `
part x = A${operator}{
        in v;
        v != null
    };`
            );
        });

        it("should format body expression", async () => {
            await testFormatting(
                " item  x =   \n{ in v;  v  !=  null  } ;",
                `
item x = {
        in v;
        v != null
    };`
            );
        });

        describe("feature chain expressions", () => {
            it("should format single line expressions", async () => {
                await testFormatting(" part  x  =  A  .  x  ;", "part x = A.x;");
            });

            it("should format preserve line breaks", async () => {
                await testFormatting(
                    " part  x  =  A  .\n  x  ;",
                    `
part x = A.
        x;`
                );
            });
        });

        it("should format named arguments", async () => {
            await testFormatting(
                " part  x  =  A  ( x   =   0,  y =  1  ) ;",
                `
part x = A(
        x=0,
        y=1
    );`
            );
        });

        describe("positional arguments", () => {
            it("should format arguments on the same line", async () => {
                await testFormatting("part x =  A ( 0 ,   1,2    );", "part x = A(0, 1, 2);");
            });

            it("should handle line breaks", async () => {
                await testFormatting(
                    "part x =  A ( 0 ,\n   1,2    );",
                    `
part x = A(
        0,
        1, 2
    );`
                );
            });

            it("should format empty lists", async () => {
                await testFormatting("part x =   A  (    \n) ;", "part x = A();");
            });

            it("should handle outer braces", async () => {
                await testFormatting(
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

        it("should format metadata access expression", async () => {
            await testFormatting("part x =  A   .   metadata;", "part x = A.metadata;");
        });

        describe("arrow invocation expression", () => {
            it("should format body expressions", async () => {
                await testFormatting(
                    "part x = A   ->  sum { in v; v };",
                    `
part x = A->sum{
        in v;
        v
    };`
                );
            });

            it("should format function reference arg", async () => {
                await testFormatting("part x = A  -> sum  AddOne ;", "part x = A->sum AddOne;");
            });

            it("should format argument lists", async () => {
                await testFormatting(
                    "part x = A   ->  sum ( 0,  2 , 3);",
                    "part x = A->sum(0, 2, 3);"
                );
            });
        });

        describe("operator expressions", () => {
            describe.each([
                ["extent", ".."],
                ["exponentiation", "**"],
                ["exponentiation", "^"],
            ])("%s expressions", (_, op) => {
                it("should format single line expressions", async () => {
                    await testFormatting(`item x = 2   ${op}   4 ;`, `item x = 2${op}4;`);
                });

                it("should format multi-line expressions", async () => {
                    await testFormatting(
                        `item x = 2   ${op} \n  4 ;`,
                        `
item x = 2${op}
        4;`
                    );
                });
            });

            describe("sequence expressions", () => {
                it("should format single line expressions", async () => {
                    await testFormatting("item x =  (  0,  1,  2  , 3);", "item x = (0, 1, 2, 3);");
                });

                it("should format multi-line expressions", async () => {
                    await testFormatting(
                        "item x =  (  0,  1,  \n2  , 3);",
                        `
item x = (
        0, 1,
        2, 3
    );`
                    );
                });
            });

            it("should format conditional expressions", async () => {
                await testFormatting(
                    "part x = if   1  ?  0 else   \n\n1 ;",
                    `
part x = if 1
        ? 0
        else 1;`
                );
            });

            describe("indexing expressions", () => {
                it("should format single line expressions", async () => {
                    await testFormatting("part x  =  A  [  0  ] ;", "part x = A[0];");
                });

                it("should format multi-line expressions", async () => {
                    await testFormatting(
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
                it("should format single line expressions", async () => {
                    await testFormatting(`part x =  A  ${op}  B ;`, `part x = A ${op} B;`);
                });

                it("should format multi-line expressions", async () => {
                    await testFormatting(
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
                it("should format single line expressions", async () => {
                    await testFormatting(`part x =  ${op}  A ;`, `part x = ${op}${space}A;`);
                });
            });
        });
    });

    describe("SysML keywords", () => {
        it("should format conjugated port references", async () => {
            await testFormatting("part a defined   by  ~  \nPort {}", "part a defined by ~Port {}");
            await testFormatting("part a    :  ~  \nPort {}", "part a : ~Port {}");
        });

        it("should format 'defined by' in usages", async () => {
            await testFormatting("part a  defined   by  A ;", "part a defined by A;");
        });

        it("should format 'variation'", async () => {
            await testFormatting("  variation  part  def A;", "variation part def A;");
            await testFormatting("  variation  part   A;", "variation part A;");
        });

        it("should format 'individual'", async () => {
            await testFormatting(
                "  individual  occurrence  def A;",
                "individual occurrence def A;"
            );
            await testFormatting("  individual  occurrence   A;", "individual occurrence A;");
        });

        it("should format 'variant'", async () => {
            await testFormatting(
                " part def P {  variant  part   A; }",
                `
part def P {
    variant part A;
}`
            );
        });

        it.each(["timeslice", "snapshot"])("should format portion kind '%s'", async (tok) => {
            await testFormatting(`  ${tok}  occurrence   A;`, `${tok} occurrence A;`);
        });

        it("should format metadata body usage", async () => {
            await testFormatting(
                `  metadata  Meta  :  M{
            Ref;
        }`,
                `
metadata Meta : M {
    Ref;
}`
            );
        });

        it("should format 'ref'", async () => {
            await testFormatting("  ref  part   A;", "ref part A;");
        });

        it("should format reference usages", async () => {
            await testFormatting("  ref A :   B;", "ref A : B;");
        });

        it("should format enumeration definition", async () => {
            await testFormatting(
                "enum def Color {R;G;B;}",
                `
enum def Color {
    R;
    G;
    B;
}`
            );
        });

        it("should format extended definition", async () => {
            await testFormatting("  #Meta   def  P { }", "#Meta def P {}");
        });

        it("should format extended usage", async () => {
            await testFormatting("  #Meta     P { }", "#Meta P {}");
        });

        it("should format event occurrence usage", async () => {
            await testFormatting("  event\noccurrence \nA :  B {}", "event occurrence A : B {}");
            await testFormatting("  event\nA :  B {}", "event A : B {}");
        });

        it("should format empty succession usage", async () => {
            await testFormatting(
                "part def P  { then    [ * ]    occurrence O : A {} }",
                `
part def P {
    then [*] occurrence O : A {}
}`
            );
        });

        it("should format 'subject'", async () => {
            await testFormatting(
                "  requirement  def  R { public   subject   S:X   ; }",
                `
requirement def R {
    public subject S : X;
}`
            );
        });

        it("should format 'frame'", async () => {
            await testFormatting(
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
        it("should format single line nodes", async () => {
            await testFormatting(
                `  private  ${type}  ${prefix} a   ${binder}   x ;`,
                `private ${type} ${prefix} a ${binder} x;`
            );
        });

        it("should preserve line breaks between ends", async () => {
            await testFormatting(
                `  private  ${type}   \n${prefix}   a   ${binder} \n  x ;`,
                `
private ${type}
    ${prefix} a ${binder} x;`
            );
        });
    });

    describe(`${ast.ConnectionUsage} formatting`, () => {
        it("should format single line nodes", async () => {
            await testFormatting(
                "  private  connection   connect a   to   x ;",
                `
private connection
    connect a
    to x;`
            );
        });

        it("should format 'connect' on the same line if there is no 'connection'", async () => {
            await testFormatting(
                "  private     connect a   to   x ;",
                `
private connect a
    to x;`
            );
        });

        it("should format end lists", async () => {
            await testFormatting(
                "  private connect (  a ,  b , \n  d )  {  }",
                `
private connect (
        a, b,
        d
    ) {}`
            );
        });

        it("should preserve line breaks between ends", async () => {
            await testFormatting(
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
        it("should format single line nodes", async () => {
            await testFormatting(
                `  private  ${kw}   ${connect} a   to   x ;`,
                `
private ${kw}
    ${connect} a
    to x;`
            );
        });

        it("should format end lists", async () => {
            await testFormatting(
                `  private  ${kw}  ${connect} (  a ,  b , \n  d )  {  }`,
                `
private ${kw} ${connect} (
        a, b,
        d
    ) {}`
            );
        });

        it("should preserve line breaks between ends", async () => {
            await testFormatting(
                `  private  ${kw}   \n${connect}   a   to \n  x ;`,
                `
private ${kw}
    ${connect} a
    to x;`
            );
        });
    });

    describe(`${ast.PerformActionUsage} formatting`, () => {
        it("should leave one space after 'perform'", async () => {
            await testFormatting("  perform   \t action  A ;", "perform action A;");
            await testFormatting("  perform   \t  A ;", "perform A;");
        });
    });

    describe("Action nodes formatting", () => {
        it(`should format ${ast.InitialNode}`, async () => {
            await testFormatting(
                " action  A {  private   first   B  {}}",
                `
action A {
    private first B {}
}`
            );
        });

        it(`should format ${ast.AcceptActionUsage}`, async () => {
            await testFormatting(
                " action  A {  private   action  AA:X accept   B   at  0  via C{}}",
                `
action A {
    private action AA : X
        accept B at 0
        via C {}
}`
            );
        });

        it(`should format ${ast.SendActionUsage}`, async () => {
            await testFormatting(
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
                it("should format single line nodes", async () => {
                    await testFormatting(
                        ` action A { private  ${type}  ${prefix} a   ${binder}   x ; }`,
                        `
action A {
    private ${type} ${prefix} a ${binder} x;
}`
                    );
                });

                it("should preserve line breaks between ends", async () => {
                    await testFormatting(
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

        it(`should format ${ast.IfActionUsage}`, async () => {
            await testFormatting(
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
            it("should format 'while'", async () => {
                await testFormatting(
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

            it("should format 'loop'", async () => {
                await testFormatting(
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
            it("should format for loop", async () => {
                await testFormatting(
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
                it("should format control node", async () => {
                    await testFormatting(
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
        it("should format guarded target succession", async () => {
            await testFormatting(
                "action A { private    if  true   then   A ; }",
                `
action A {
    private
        if true
        then A;
}`
            );
        });

        it("should format default target succession", async () => {
            await testFormatting(
                "action A { private    else    A   ; }",
                `
action A {
    private
        else A;
}`
            );
        });

        it("should format transition usage", async () => {
            await testFormatting(
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
        it.each([["entry", "do", "exit"]])("should format '%s' subaction", async (kw) => {
            await testFormatting(
                `state def S { public    \n${kw}    action{}}`,
                `
state def S {
    public ${kw} action {}
}`
            );
        });
    });

    describe(`${ast.AssertConstraintUsage} formatting`, () => {
        it("should format 'assert' statements", async () => {
            await testFormatting("  public   assert   A  ;", "public assert A;");
        });

        it("should format 'assert not' statements", async () => {
            await testFormatting(
                "  public   assert   not     constraint   A  ;",
                "public assert not constraint A;"
            );
        });

        it("should format 'assert' constraint statements", async () => {
            await testFormatting(
                "  public   assert   constraint   A  ;",
                "public assert constraint A;"
            );
        });

        it("should format 'assert not' constraint statements", async () => {
            await testFormatting(
                "  public   assert   not     constraint   A  ;",
                "public assert not constraint A;"
            );
        });
    });

    describe(`${ast.ConstraintUsage} formatting`, () => {
        it.each(["assume", "require"])("should format constraint kind '%s'", async (kind) => {
            await testFormatting(
                `  requirement R {public   ${kind}\n   constraint;}`,
                `
requirement R {
    public ${kind} constraint;
}`
            );
        });
    });

    describe(`${ast.PartUsage} formatting`, () => {
        it.each(["actor", "stakeholder"])("should format parameter kind '%s'", async (kind) => {
            await testFormatting(
                `  requirement R {public   ${kind}\n   P;}`,
                `
requirement R {
    public ${kind} P;
}`
            );
        });
    });

    describe(`${ast.SatisfyRequirementUsage} formatting`, () => {
        it("should format 'satisfy'", async () => {
            await testFormatting(
                "  requirement R {public   assert   not  \nsatisfy  requirement R;}",
                `
requirement R {
    public assert not satisfy requirement R;
}`
            );
        });

        it("should format 'by'", async () => {
            await testFormatting(
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
        it.each([
            ["objective", "case"],
            ["verify", "requirement"],
        ])("should format requirement kind '%s'", async (kind, type) => {
            await testFormatting(
                `  ${type} def R {public   ${kind}\n    #  Meta;}`,
                `
${type} def R {
    public ${kind} #Meta;
}`
            );
        });
    });

    describe("Use case formatting", () => {
        it("should format 'use case'", async () => {
            await testFormatting("  use   case   def   U;", "use case def U;");
            await testFormatting("  use   case   U;", "use case U;");
            await testFormatting("  include   use   case   U;", "include use case U;");
        });
    });
});
