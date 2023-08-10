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
import { emptyDocument } from "../../../testing/utils";
import {
    MembershipExposeMeta,
    NamespaceExposeMeta,
    RequirementConstraintMembershipMeta,
    StateSubactionMembershipMeta,
} from "../relationships";
import { AssertConstraintUsageMeta } from "../assert-constraint-usage";
import { ConnectorAsUsageMeta, ConnectorAsUsageOptions } from "../connector-as-usage";
import { UsageMeta, UsageOptions } from "../usage";
import { PortDefinitionMeta } from "../port-definition";
import { StateDefinitionMeta } from "../state-definition";
import { StateUsageMeta } from "../state-usage";
import { TransitionUsageMeta } from "../transition-usage";
import { ReferenceUsage } from "../../../generated/ast";
import { FlowConnectionUsageMeta } from "../flow-connection-usage";
import { EndFeatureMembershipMeta, ItemFlowEndMeta, ParameterMembershipMeta } from "../../KerML";
import { EventOccurrenceUsageMeta } from "../event-occurrence-usage";

describe("Element factories", () => {
    const id = basicIdProvider();
    let document: LangiumDocument;

    beforeAll(() => {
        document = emptyDocument("factory_test", ".kerml");
    });

    it("should construct namespace expose", () => {
        const imp = NamespaceExposeMeta.create(id, document, {
            importsAll: false,
            isRecursive: true,
        });

        expect(imp).toMatchObject({ importsAll: true, isRecursive: true });
    });

    it("should construct membership expose", () => {
        const imp = MembershipExposeMeta.create(id, document, {
            importsAll: false,
            isRecursive: true,
        });

        expect(imp).toMatchObject({ importsAll: true, isRecursive: true });
    });

    it("should assign kind to requirement constraint membership", () => {
        expect(
            RequirementConstraintMembershipMeta.create(id, document, {
                kind: "assumption",
            })
        ).toMatchObject({ kind: "assumption" });
    });

    it("should assign kind to state subaction membership", () => {
        expect(
            StateSubactionMembershipMeta.create(id, document, {
                kind: "exit",
            })
        ).toMatchObject({ kind: "exit" });
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
        const options: UsageOptions = {
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

        expect(port.conjugatedDefinition?.element()).toMatchObject({
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

    it("should add ends to flow connection usage", () => {
        const fc = FlowConnectionUsageMeta.create(id, document, {
            ends: [
                [
                    EndFeatureMembershipMeta.create(id, document),
                    ItemFlowEndMeta.create(id, document),
                ],
            ],
        });

        expect(fc.ends).toHaveLength(1);
    });

    it("should add messages to flow connection usage", () => {
        const fc = FlowConnectionUsageMeta.create(id, document, {
            messages: [
                [
                    ParameterMembershipMeta.create(id, document),
                    EventOccurrenceUsageMeta.create(id, document),
                ],
            ],
        });

        expect(fc.messages).toHaveLength(1);
    });
});
