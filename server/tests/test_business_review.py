import copy
import json
import unittest
from unittest.mock import patch

from app.services.business_review import (
    MAX_TRANSCRIPT_CHARS,
    build_rubric_snapshot,
    evaluate_business_review,
    parse_business_review,
)


MESSAGES = [
    {"id": "c1", "role": "npc", "content": "我担心迁移太麻烦，我们只有十分钟。"},
    {"id": "s1", "role": "user", "content": "我想了解迁移顾虑，您现在方便用十分钟聊一下吗？"},
    {"id": "c2", "role": "npc", "content": "可以，主要担心员工重新学。"},
    {"id": "s2", "role": "user", "content": "所以主要是团队学习成本，而不是功能不足，对吗？"},
    {"id": "c3", "role": "npc", "content": "对，我们现在最忙，不能抽时间培训。"},
    {"id": "s3", "role": "user", "content": "资料中的分组培训可以分时安排，但仍需要员工投入时间。"},
    {"id": "c4", "role": "npc", "content": "这样更合适，等月底忙完再考虑。"},
    {"id": "s4", "role": "user", "content": "我周五三点发培训安排，您当天确认参与岗位，可以吗？"},
    {"id": "c5", "role": "npc", "content": "可以，我周五确认岗位。"},
]


def cite(message_id):
    message = next(m for m in MESSAGES if m["id"] == message_id)
    return {"messageId": message_id, "speaker": message["role"], "quote": message["content"]}


def fixture():
    pairs = [("s1", "c2"), ("s2", "c3"), ("s3", "c4"), ("s2", "c1"), ("s4", "c5")]
    return {"criteria": [
        {"id": f"S{i}", "status": "assessed", "score": 1,
         "reason": "已说明部分内容，但还需要核对关键条件。",
         "evidence": [cite(s), cite(c)],
         "checkedRange": {"firstMessageId": "c1", "lastMessageId": "c5"},
         "missingBehavior": "补充并核对关键条件。", "nextPractice": "先追问客户具体担忧，再确认理解。",
         "opportunity": "observed" if i == 4 else None}
        for i, (s, c) in enumerate(pairs, 1)
    ], "risks": []}


class BusinessReviewTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = build_rubric_snapshot({})
        self.raw = fixture()

    def parse(self):
        return parse_business_review(json.dumps(self.raw, ensure_ascii=False), MESSAGES, self.snapshot)

    def test_total_uses_frozen_weights_and_half_up_rounding(self):
        for criterion, score in zip(self.raw["criteria"], [2, 0, 1, 1, 2]):
            criterion["score"] = score
        result = self.parse()
        self.assertEqual(result["totalScore"], 48)
        self.assertEqual(result["coverage"], {"assessed": 5, "applicable": 5})
        self.assertEqual(result["coaching"]["focusCriterionId"], "S2")
        self.assertEqual(result["criteria"][1]["checkedMessageIds"], [m["id"] for m in MESSAGES])

    def test_zero_is_a_real_result_not_missing(self):
        for c in self.raw["criteria"]:
            c["score"] = 0
        self.assertEqual(self.parse()["totalScore"], 0)

    def test_missing_item_duplicate_and_extra_cannot_reduce_denominator(self):
        original = copy.deepcopy(self.raw)
        for replacement in (original["criteria"][:-1], original["criteria"][:-1] + [original["criteria"][0]],
                            original["criteria"][:-1] + [{**original["criteria"][-1], "id": "S6"}]):
            with self.subTest(replacement=replacement):
                self.raw["criteria"] = replacement
                with self.assertRaises(ValueError):
                    self.parse()

    def test_insufficient_evidence_keeps_total_unavailable(self):
        self.raw["criteria"][0].update(status="insufficient_evidence", score=None)
        result = self.parse()
        self.assertIsNone(result["totalScore"])
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["coverage"], {"assessed": 4, "applicable": 5})

    def test_s4_can_only_be_na_with_absent_opportunity_and_full_check(self):
        self.raw["criteria"][3].update(status="not_applicable", score=None, opportunity="absent", evidence=[])
        result = self.parse()
        self.assertEqual(result["totalScore"], 50)
        self.assertEqual(result["coverage"], {"assessed": 4, "applicable": 4})
        for modification in (dict(objectionRequired=True),):
            self.snapshot = build_rubric_snapshot({"rubricConfig": modification})
            with self.assertRaises(ValueError):
                self.parse()

    def test_non_optional_criteria_cannot_be_na(self):
        self.raw["criteria"][1].update(status="not_applicable", score=None, opportunity="absent")
        with self.assertRaises(ValueError):
            self.parse()

    def test_bad_quote_wrong_role_and_unknown_message_rejected(self):
        original = copy.deepcopy(self.raw)
        for update in ({"quote": "完全没有说过的话。"}, {"speaker": "npc"}, {"messageId": "outside-session"}):
            self.raw = copy.deepcopy(original)
            self.raw["criteria"][0]["evidence"][0].update(update)
            with self.subTest(update=update), self.assertRaises(ValueError):
                self.parse()

    def test_clipped_condition_rejected_even_if_substring_exists(self):
        self.raw["criteria"][2]["evidence"][0]["quote"] = "但仍需要员工投入时间。"
        with self.assertRaises(ValueError):
            self.parse()

    def test_customer_only_evidence_cannot_award_sales_points(self):
        self.raw["criteria"][0]["evidence"] = [cite("c2")]
        with self.assertRaises(ValueError):
            self.parse()

    def test_full_discovery_requires_customer_confirmation_evidence(self):
        self.raw["criteria"][1].update(score=2, evidence=[cite("s2")])
        with self.assertRaises(ValueError):
            self.parse()

    def test_zero_requires_complete_range(self):
        self.raw["criteria"][0].update(score=0, evidence=[], checkedRange={"firstMessageId": "s1", "lastMessageId": "c5"})
        with self.assertRaises(ValueError):
            self.parse()

    def test_evidence_must_be_within_declared_range(self):
        self.raw["criteria"][0]["checkedRange"] = {"firstMessageId": "s4", "lastMessageId": "c5"}
        with self.assertRaises(ValueError):
            self.parse()

    def test_no_facts_does_not_penalize_value_expression_or_claim_fact_verification(self):
        self.raw["criteria"][2]["score"] = 2
        result = self.parse()
        self.assertEqual(result["criteria"][2]["score"], 2)
        self.assertEqual(result["totalScore"], 63)
        self.assertIn("未核实", result["riskChecks"]["limitations"])
        self.assertEqual(result["riskChecks"]["status"], "not_checked")

    def test_full_value_expression_needs_customer_confirmation(self):
        self.raw["criteria"][2].update(score=2, evidence=[cite("s3")])
        with self.assertRaises(ValueError):
            self.parse()

    def test_sales_risk_quote_is_preserved_for_review_not_blocked_as_advice(self):
        messages = copy.deepcopy(MESSAGES)
        bad_claim = "我保证保本保息。"
        next(m for m in messages if m["id"] == "s3")["content"] = bad_claim
        evidence = {"messageId": "s3", "speaker": "user", "quote": bad_claim}
        self.raw["criteria"][2]["evidence"][0] = evidence
        self.raw["risks"] = [{"type": "unauthorized_promise", "reason": "需要核对这项承诺，不能当作已验证的收益保证。", "evidence": [evidence]}]
        result = parse_business_review(json.dumps(self.raw, ensure_ascii=False), messages, self.snapshot)
        self.assertEqual(result["riskChecks"]["findings"][0]["evidence"][0]["quote"], bad_claim)
        self.assertEqual(result["riskChecks"]["status"], "review_required")

    def test_routine_followup_commitment_is_not_fabricated_into_product_risk(self):
        messages = copy.deepcopy(MESSAGES)
        followup = "我理解您希望先看清实际价值再决定。我明天下午三点把上期使用记录和费用逐项明细发给您，由我来跟进，您看完告诉我哪些项目还需要说明，我们再约时间核对，可以吗？"
        next(m for m in messages if m["id"] == "s4")["content"] = followup
        self.raw["criteria"][4]["evidence"][0] = {"messageId": "s4", "speaker": "user", "quote": followup}
        self.raw["criteria"][4]["score"] = 2
        self.raw["risks"] = []
        with patch("app.services.business_review.call_model", return_value=json.dumps(self.raw, ensure_ascii=False)) as model:
            result = evaluate_business_review({}, messages)
        self.assertEqual(result["criteria"][4]["score"], 2)
        self.assertEqual(result["riskChecks"]["findings"], [])
        self.assertIn("产品事实及承诺授权尚未核实", result["riskChecks"]["limitations"])
        # The evaluator receives the action as data and the counterexample as policy;
        # lack of a product facts pack must not create an automatic risk finding.
        sent = json.loads(model.call_args.kwargs["messages"][0]["content"])
        self.assertFalse(sent["rubric"]["productFactsVerified"])
        self.assertEqual(next(m for m in sent["messages"] if m["id"] == "s4")["content"], followup)
        policy = model.call_args.kwargs["system"]
        self.assertIn("正常的下一步行动承诺", policy)
        self.assertIn("缺少产品资料本身仅属于全局核查限制", policy)

    def test_specific_product_guarantee_remains_reviewable_with_followup_action(self):
        messages = copy.deepcopy(MESSAGES)
        statement = "我明天发使用记录。使用后保证成本降低50%，不用审批直接给您五折。"
        next(m for m in messages if m["id"] == "s4")["content"] = statement
        full_evidence = {"messageId": "s4", "speaker": "user", "quote": statement}
        self.raw["criteria"][4]["evidence"][0] = full_evidence
        self.raw["risks"] = [{
            "type": "unauthorized_promise", "reason": "具体效果保证和折扣审批权限需要核查。",
            "evidence": [{**full_evidence, "quote": "使用后保证成本降低50%，不用审批直接给您五折。"}],
        }]
        result = parse_business_review(json.dumps(self.raw, ensure_ascii=False), messages, self.snapshot)
        self.assertEqual(result["riskChecks"]["status"], "review_required")
        self.assertEqual(result["riskChecks"]["findings"][0]["status"], "pending_review")
        self.assertEqual(len(result["riskChecks"]["findings"]), 1)

    def test_verified_facts_can_support_full_value_score(self):
        self.snapshot = build_rubric_snapshot({"rubricConfig": {"productFacts": ["提供分组培训，需要投入学习时间。"], "productFactsVerified": True}})
        self.raw["criteria"][2]["score"] = 2
        self.assertEqual(self.parse()["totalScore"], 63)

    def test_pending_risk_requires_real_sales_quote(self):
        self.raw["risks"] = [{"type": "product_claim", "reason": "需要核对分组培训是否属于服务范围。", "evidence": [cite("s3")]}]
        result = self.parse()
        self.assertEqual(result["riskChecks"]["status"], "review_required")
        self.assertEqual(result["riskChecks"]["findings"][0]["status"], "pending_review")
        self.raw["risks"][0]["type"] = "customer_boundary"
        with self.assertRaises(ValueError):
            self.parse()

    def test_score_bool_float_and_out_of_range_are_invalid(self):
        for bad in (True, 1.5, "2", 3, -1):
            self.raw["criteria"][0]["score"] = bad
            with self.subTest(score=bad), self.assertRaises(ValueError):
                self.parse()

    def test_model_cannot_override_total_or_weights(self):
        self.raw["totalScore"] = 100
        with self.assertRaises(ValueError):
            self.parse()

    def test_explicit_scope_is_frozen_not_inferred(self):
        scenario = {"rubricConfig": {"criterionIds": ["S4"], "objectionRequired": True}}
        snapshot = build_rubric_snapshot(scenario)
        scenario["rubricConfig"]["criterionIds"].append("S5")
        self.assertEqual(snapshot["criterionIds"], ["S4"])
        self.snapshot = snapshot
        self.raw["criteria"] = [self.raw["criteria"][3]]
        self.assertEqual(self.parse()["totalScore"], 50)

    def test_invalid_or_tampered_snapshot_rejected(self):
        for ids in ([], ["S9"], ["S1", "S1"], "S1"):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                build_rubric_snapshot({}, criterion_ids=ids)
        self.snapshot["criteria"][0]["weight"] = 999
        with self.assertRaises(ValueError):
            self.parse()

    def test_no_participants_and_truncated_transcript_never_call_model(self):
        with patch("app.services.business_review.call_model") as model:
            for messages in ([], [MESSAGES[1]]):
                result = evaluate_business_review({}, messages)
                self.assertIsNone(result["totalScore"])
                self.assertEqual(result["status"], "incomplete")
            result = evaluate_business_review({"rubricConfig": {"transcriptComplete": False}}, MESSAGES, imported=True)
            self.assertIsNone(result["totalScore"])
            huge = [dict(MESSAGES[0], content="字" * (MAX_TRANSCRIPT_CHARS + 1)), MESSAGES[1]]
            self.assertIsNone(evaluate_business_review({}, huge)["totalScore"])
            model.assert_not_called()

    def test_llm_failure_propagates_instead_of_default_score(self):
        with patch("app.services.business_review.call_model", side_effect=RuntimeError("offline")):
            with self.assertRaises(RuntimeError):
                evaluate_business_review({}, MESSAGES)
        with patch("app.services.business_review.call_model", return_value="not json"):
            with self.assertRaises(ValueError):
                evaluate_business_review({}, MESSAGES)

    def test_real_evaluation_pipeline_uses_snapshot_and_all_messages(self):
        with patch("app.services.business_review.call_model", return_value=json.dumps(self.raw)) as model:
            result = evaluate_business_review({"title": "迁移顾虑", "secret": "do-not-send"}, MESSAGES, rubric_snapshot=self.snapshot, imported=True)
        self.assertEqual(result["totalScore"], 50)
        payload = json.loads(model.call_args.kwargs["messages"][0]["content"])
        self.assertEqual(payload["messages"], MESSAGES)
        self.assertEqual(payload["source"], "imported")
        self.assertNotIn("secret", payload["scenario"])


if __name__ == "__main__":
    unittest.main()
