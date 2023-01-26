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

import { formatString } from "typescript-string-operations";
import {
    parseKerML,
    NO_ERRORS,
    sanitizeTree,
    withQualifiedName,
    anything,
} from "../../../../testing";
import { SpecializationKind } from "../../../model";
import { SysMLBuildOptions } from "../../../services/shared/workspace/document-builder";
import { Type } from "../../../generated/ast";

const Base = `
package {0} {
    abstract {1} {2};
    abstract feature {3} : {2}[*];
}
`;

const BinaryAssocBody = `
    type X;
    end feature x : X;
    end feature y : X;
`;
const NaryAssocBody =
    BinaryAssocBody +
    `
    end feature z : X;
`;

const TABLE = [
    ["", "datatype", "Base", "DataValue", "dataValues", ""],
    ["", "class", "Occurrences", "Occurrence", "occurrences", ""],
    ["", "struct", "Objects", "Object", "objects", ""],
    ["nary ", "assoc", "Links", "Link", "links", NaryAssocBody],
    ["binary ", "assoc", "Links", "BinaryLink", "binaryLinks", BinaryAssocBody],
    ["nary ", "assoc struct", "Objects", "LinkObject", "linkObjects", NaryAssocBody],
    [
        "binary ",
        "assoc struct",
        "Objects",
        "BinaryLinkObject",
        "binaryLinkObjects",
        BinaryAssocBody,
    ],
];

const BUILD_OPTIONS: SysMLBuildOptions = {
    standardLibrary: "local",
    ignoreMetamodelErrors: true,
    standalone: true,
};

test.concurrent.each(TABLE)(
    "%s%s without explicit specializations implicitly specializes %s::%s",
    async (_, classifier: string, pack: string, klass: string, feature: string, body: string) => {
        const str = formatString(
            Base +
                `
{1} A {
    {4}
}`,
            pack,
            classifier,
            klass,
            feature,
            body
        );
        const result = await parseKerML(str, BUILD_OPTIONS);
        expect(result).toMatchObject(NO_ERRORS);

        const type = result.value.elements[1] as Type;
        expect(sanitizeTree(type.$meta.specializations())).toMatchObject([
            {
                type: withQualifiedName(`${pack}::${klass}`),
                kind: SpecializationKind.Subclassification,
                isImplicit: true,
            },
        ]);
    }
);

test.concurrent.each(TABLE)(
    "%s%s with explicit specializations does not implicitly specializes %s::%s",
    async (_, classifier: string, pack: string, klass: string, feature: string, body: string) => {
        const str = formatString(
            Base +
                `
{1} B {
    {4}
}
{1} A specializes B;`,
            pack,
            classifier,
            klass,
            feature,
            body
        );
        const result = await parseKerML(str, BUILD_OPTIONS);

        expect(result).toMatchObject(NO_ERRORS);
        expect(
            sanitizeTree((result.value.elements[2] as Type).$meta.specializations())
        ).toMatchObject([
            {
                type: withQualifiedName("B"),
                kind: SpecializationKind.Subclassification,
                isImplicit: false,
            },
        ]);
    }
);

// TODO: chapter 7 may be wrong and only connector features subset links rather
// than all features, same as the pilot implementation
test.concurrent.each(TABLE.filter((v) => !v[1].startsWith("assoc")))(
    "features typed by %s%s implicitly subset related standard library feature",
    async (_, classifier: string, pack: string, klass: string, feature: string, body: string) => {
        const str = formatString(
            Base +
                `
        feature x : {0}::{2};`,
            pack,
            classifier,
            klass,
            feature,
            body
        );
        const result = await parseKerML(str, BUILD_OPTIONS);

        expect(result).toMatchObject(NO_ERRORS);
        expect(sanitizeTree(result.value.features[0].$meta.specializations())).toMatchObject([
            ...anything(1),
            {
                type: withQualifiedName(`${pack}::${feature}`),
                kind: SpecializationKind.Subsetting,
                isImplicit: true,
            },
        ]);
    }
);
