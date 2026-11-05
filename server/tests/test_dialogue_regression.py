import unittest
from app.harness.evaluators.regression import load_cases, run_case
from app.agents.scoring import parse_scoring_output


class DialogueRegressionTests(unittest.TestCase):
    def test_all_ten_synthetic_contract_cases(self):
        catalog = load_cases()
        self.assertEqual(len(catalog["cases"]), 10)
        self.assertEqual(len({c["id"] for c in catalog["cases"]}), 10)
        for case in catalog["cases"]:
            with self.subTest(case=case["id"]):
                result = run_case(catalog, case)
                self.assertTrue(result["checksPassed"], result)
                self.assertEqual(result["modelQuality"], "not_run")

    def test_missing_scores_preserve_previous_and_string_false_is_not_success(self):
        previous = {"angerLevel": 3, "trustLevel": 7, "progressLevel": 4}
        for output in ('{}', '{"angerLevel": "Infinity"}',
                       '{"goalUpdates": [{"goalId":"g", "achieved":"false"}]}'):
            result = parse_scoring_output(output, previous)
            self.assertEqual(result["scores"], previous)
            self.assertEqual(result["goalUpdates"], [])
