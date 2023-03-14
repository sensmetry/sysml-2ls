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

import { DefaultDocumentBuilder, LangiumDocument, BuildOptions } from "langium";
import {
    InterfaceType,
    isArrayType,
    isInterfaceType,
    isPrimitiveType,
    isPropertyUnion,
    Property,
    PropertyType,
    TypeOption,
} from "langium/lib/grammar/type-system";
import { CancellationToken } from "vscode";

const build = DefaultDocumentBuilder.prototype.build;
DefaultDocumentBuilder.prototype.build = async function (
    this: DefaultDocumentBuilder,
    documents: LangiumDocument[],
    options?: BuildOptions,
    cancelToken?: CancellationToken
): Promise<void> {
    await build.call(this, documents, options, cancelToken);
    documents.forEach((doc) => {
        doc.diagnostics = doc.diagnostics?.filter(
            (diagnostic) => !/is not compatible/.test(diagnostic.message)
        );
    });
};

// patching infinite recursion
InterfaceType.prototype["getSubTypeProperties"] = function (
    this: InterfaceType,
    type: TypeOption,
    map: Map<string, Property>,
    visited?: Set<TypeOption>
): void {
    visited ??= new Set();
    if (visited.has(type)) return;
    visited.add(type);

    const props = isInterfaceType(type) ? type.properties : [];
    for (const prop of props) {
        if (!map.has(prop.name)) {
            map.set(prop.name, prop);
        }
    }
    for (const subType of type.subTypes) {
        this["getSubTypeProperties"](subType, map, visited);
    }
};

// patching infinite recursion and false positive diagnostics
function getSuperProperties(
    type: InterfaceType,
    map: Map<string, Property>,
    visited: Set<InterfaceType>
): void {
    if (visited.has(type)) return;
    visited.add(type);

    for (const property of type.properties) {
        map.set(property.name, property);
    }
    for (const superType of type.interfaceSuperTypes) {
        getSuperProperties(superType, map, visited);
    }
}

Object.defineProperty(InterfaceType.prototype, "superProperties", {
    get: function (): Property[] {
        const map = new Map<string, Property>();
        getSuperProperties(this, map, new Set());
        const isOptional = (type: PropertyType): boolean => {
            return isArrayType(type) || (isPrimitiveType(type) && type.primitive === "boolean");
        };

        return Array.from(map.values()).map((prop) => {
            const p = {
                ...prop,
                optional:
                    prop.optional ||
                    // arrays and boolean will be created automatically, no
                    // issues with them missing
                    isOptional(prop.type) ||
                    (isPropertyUnion(prop.type) && !prop.type.types.some((p) => !isOptional(p))),
            };

            return p;
        });
    },
    configurable: true,
});

function buildType(type: InterfaceType): void {
    // Recursively collect all subtype names
    const visited = new Set<TypeOption>();
    const collect = (type: TypeOption): void => {
        if (visited.has(type)) return;
        visited.add(type);
        type.typeNames.add(type.name);
        for (const subtype of type.subTypes) {
            collect(subtype);
            subtype.typeNames.forEach((n) => type.typeNames.add(n));
        }
    };
    collect(type);
}

const toAstTypesString = InterfaceType.prototype.toAstTypesString;
InterfaceType.prototype.toAstTypesString = function (reflectionInfo: boolean): string {
    // $type inference seems to be broken currently
    buildType(this);
    return toAstTypesString.call(this, reflectionInfo);
};

async function generate(): Promise<void> {
    import("langium-cli/lib/langium");
}

async function main(): Promise<void> {
    await generate();
}

main().catch((reason) => {
    console.error(`Langium generate failed with ${reason}`);
    if (reason instanceof Error) console.error(reason.stack);
    process.exit(-1);
});
