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
import {
    AcceptActionUsage,
    AssignmentActionUsage,
    ForLoopActionUsage,
    IfActionUsage,
    SatisfyRequirementUsage,
    SendActionUsage,
    TransitionUsage,
} from "../../../generated/ast";
import { emptyDocument } from "../../../testing";
import {
    ExpressionMeta,
    FeatureMeta,
    MembershipMeta,
    OwningMembershipMeta,
    ParameterMembershipMeta,
} from "../../KerML";
import { testChildProperty } from "../../KerML/__tests__/utils";
import { basicIdProvider } from "../../metamodel";
import { AcceptActionUsageMeta } from "../accept-action-usage";
import { ActionUsageMeta } from "../action-usage";
import { AssignmentActionUsageMeta } from "../assignment-action-usage";
import { ForLoopActionUsageMeta } from "../for-loop-action-usage";
import { IfActionUsageMeta } from "../if-action-usage";
import { ReferenceUsageMeta } from "../reference-usage";
import { SubjectMembershipMeta, TransitionFeatureMembershipMeta } from "../relationships";
import { SatisfyRequirementUsageMeta } from "../satisfy-requirement-usage";
import { SendActionUsageMeta } from "../send-action-usage";
import { SuccessionAsUsageMeta } from "../succession-as-usage";
import { TransitionUsageMeta, TransitionUsageOptions } from "../transition-usage";

describe("Model elements", () => {
    describe(`${AcceptActionUsage} elements`, () => {
        describe.each(["payload", "receiver"] as const)("%s item", (prop) => {
            testChildProperty<AcceptActionUsageMeta>({
                proto: AcceptActionUsageMeta,
                edgeProto: ParameterMembershipMeta,
                targetProto: ReferenceUsageMeta,
                property: prop,
            });
        });
    });

    describe(`${AssignmentActionUsage} elements`, () => {
        describe.each(["target", "targetMember", "assignedValue"] as const)("%s item", (prop) => {
            testChildProperty<AssignmentActionUsageMeta>({
                proto: AssignmentActionUsageMeta,
                edgeProto: ParameterMembershipMeta,
                targetProto: ReferenceUsageMeta,
                property: prop,
            });
        });
    });

    describe(`${ForLoopActionUsage} elements`, () => {
        describe.each([
            ["variable", ReferenceUsageMeta],
            ["sequence", ReferenceUsageMeta],
            ["body", ActionUsageMeta],
        ] as const)("%s item", (prop, target) => {
            testChildProperty<ForLoopActionUsageMeta>({
                proto: ForLoopActionUsageMeta,
                edgeProto: ParameterMembershipMeta,
                targetProto: target,
                property: prop,
            });
        });
    });

    describe(`${IfActionUsage} elements`, () => {
        describe.each([
            ["condition", ExpressionMeta],
            ["then", ActionUsageMeta],
            ["else", ActionUsageMeta],
        ] as const)("%s item", (prop, target) => {
            testChildProperty<IfActionUsageMeta>({
                proto: IfActionUsageMeta,
                edgeProto: ParameterMembershipMeta,
                targetProto: target,
                property: prop,
            });
        });
    });

    describe(`${SatisfyRequirementUsage} elements`, () => {
        describe("satisfaction subject item", () => {
            testChildProperty<SatisfyRequirementUsageMeta>({
                proto: SatisfyRequirementUsageMeta,
                edgeProto: SubjectMembershipMeta,
                targetProto: ReferenceUsageMeta,
                property: "satisfactionSubject",
            });
        });
    });

    describe(`${SendActionUsage} elements`, () => {
        describe.each(["payload", "sender", "receiver"] as const)("%s item", (prop) => {
            testChildProperty<SendActionUsageMeta>({
                proto: SendActionUsageMeta,
                edgeProto: ParameterMembershipMeta,
                targetProto: ReferenceUsageMeta,
                property: prop,
            });
        });
    });

    describe(`${TransitionUsage} elements`, () => {
        const id = basicIdProvider();
        let document: LangiumDocument;

        beforeAll(() => {
            document = emptyDocument("model_test", ".kerml");
        });

        describe.each([
            ["source", MembershipMeta, FeatureMeta],
            ["transitionLinkSource", ParameterMembershipMeta, ReferenceUsageMeta],
            [
                "payload",
                ParameterMembershipMeta,
                ReferenceUsageMeta,
                (): TransitionUsageOptions => ({
                    accepter: [
                        TransitionFeatureMembershipMeta.create(id, document),
                        AcceptActionUsageMeta.create(id, document),
                    ],
                }),
            ],
            ["accepter", TransitionFeatureMembershipMeta, AcceptActionUsageMeta],
            ["guard", TransitionFeatureMembershipMeta, ExpressionMeta],
            ["effect", TransitionFeatureMembershipMeta, ActionUsageMeta],
            ["then", OwningMembershipMeta, SuccessionAsUsageMeta],
            ["else", OwningMembershipMeta, SuccessionAsUsageMeta],
        ] as const)("%s item", (prop, edge, target, options?) => {
            testChildProperty<TransitionUsageMeta>({
                proto: TransitionUsageMeta,
                edgeProto: edge,
                targetProto: target,
                property: prop,
                options,
            });
        });
    });
});
