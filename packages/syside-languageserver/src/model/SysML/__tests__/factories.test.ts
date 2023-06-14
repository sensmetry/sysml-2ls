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

import { LangiumDocument } from "langium";
import { basicIdProvider } from "../../metamodel";
import { patchDocument, services } from "../../../testing/utils";
import { URI } from "vscode-uri";
import { MembershipMeta, NamespaceMeta } from "../../KerML";
import {
    MembershipExposeMeta,
    NamespaceExposeMeta,
    RequirementConstraintMembershipMeta,
    StateSubactionMembershipMeta,
    TransitionFeatureMembershipMeta,
} from "../relationships";
import { ConstraintUsageMeta } from "../constraint-usage";
import { ActionUsageMeta } from "../action-usage";
import { AssertConstraintUsageMeta } from "../assert-constraint-usage";
import { ConnectorAsUsageMeta, ConnectorAsUsageOptions } from "../connector-as-usage";
import { UsageMeta } from "../usage";
import { ConnectionDefinitionOptions } from "../connection-definition";
import { PortDefinitionMeta } from "../port-definition";
import { StateDefinitionMeta } from "../state-definition";
import { StateUsageMeta } from "../state-usage";
import { TransitionUsageMeta } from "../transition-usage";
import { ReferenceUsage } from "../../../generated/ast";

describe("Element factories", () => {
    const id = basicIdProvider();
    let document: LangiumDocument;

    beforeAll(() => {
        document = services.shared.workspace.LangiumDocumentFactory.fromString(
            "",
            URI.file("factory_test.kerml")
        );

        patchDocument(document);
    });

    it("should construct namespace expose", () => {
        const target = NamespaceMeta.create(id, document);
        const imp = NamespaceExposeMeta.create(id, document, {
            target,
            importsAll: false,
            isRecursive: true,
        });

        expect(imp).toMatchObject({ importsAll: true, isRecursive: true });
    });

    it("should construct membership expose", () => {
        const target = MembershipMeta.create(id, document);
        const imp = MembershipExposeMeta.create(id, document, {
            target,
            importsAll: false,
            isRecursive: true,
        });

        expect(imp).toMatchObject({ importsAll: true, isRecursive: true });
    });

    it("should assign kind to requirement constraint membership", () => {
        expect(
            RequirementConstraintMembershipMeta.create(id, document, {
                target: ConstraintUsageMeta.create(id, document),
                kind: "assumption",
            })
        ).toMatchObject({ kind: "assumption" });
    });

    it("should assign kind to state subaction membership", () => {
        expect(
            StateSubactionMembershipMeta.create(id, document, {
                target: ActionUsageMeta.create(id, document),
                kind: "exit",
            })
        ).toMatchObject({ kind: "exit" });
    });

    it("should assign kind to transition feature membership", () => {
        expect(
            TransitionFeatureMembershipMeta.create(id, document, {
                target: ConstraintUsageMeta.create(id, document),
                kind: "guard",
            })
        ).toMatchObject({ kind: "guard" });
    });

    it("should apply invariant options to assert constraint usage", () => {
        expect(AssertConstraintUsageMeta.create(id, document, { isNegated: true })).toMatchObject({
            isNegated: true,
        });
    });

    it("should apply usage options", () => {
        const options: ConnectorAsUsageOptions = {
            isIndividual: true,
            isReference: true,
            isVariation: true,
            portionKind: "timeslice",
        };
        expect(ConnectorAsUsageMeta.create(id, document, options)).toMatchObject(options);
        expect(UsageMeta.create(id, document, options)).toMatchObject(options);
    });

    it("should apply definition options", () => {
        const options: ConnectionDefinitionOptions = {
            isIndividual: true,
            isVariation: true,
        };
        expect(ConnectorAsUsageMeta.create(id, document, options)).toMatchObject(options);
        expect(UsageMeta.create(id, document, options)).toMatchObject(options);
    });

    it("should create port definition with a valid conjugated port definition", () => {
        const port = PortDefinitionMeta.create(id, document, {
            declaredName: "name",
            declaredShortName: "short",
        });

        expect(port.conjugatedDefinition.element()).toMatchObject({
            name: "~name",
            shortName: "~short",
        });
    });

    it.each([StateDefinitionMeta, StateUsageMeta])("should apply state options to %p", (proto) => {
        expect(
            (proto as typeof StateDefinitionMeta).create(id, document, { isParallel: true })
        ).toMatchObject({
            isParallel: true,
        });
    });

    it("should set up implicit transition usage features", () => {
        const tu = TransitionUsageMeta.create(id, document);

        expect(tu["_payload"]?.element()?.nodeType()).toEqual(ReferenceUsage);
        expect(tu["_transitionLinkSource"]?.element()?.nodeType()).toEqual(ReferenceUsage);
    });
});
