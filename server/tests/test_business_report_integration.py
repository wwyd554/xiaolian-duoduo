import copy
import json
import sqlite3
import unittest
from contextlib import contextmanager
from unittest.mock import patch

from app.database import SCHEMA
from app.services.business_review import build_rubric_snapshot
from app.services.report import _generate, _practice_comparison, get_cached_report
from app.api.reviews import list_reviews
from app.auth.jwt import UserInfo


class BusinessReportIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(':memory:')
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.scene = {'id': 'renewal', 'title': '续约谈判', 'description': '确认续约顾虑',
                      'initialMessage': '续约太贵了。', 'npc': {'name': '李经理'}, 'goals': []}
        self.conn.execute('INSERT INTO scenarios (id,data) VALUES (?,?)', ('renewal', json.dumps(self.scene)))
        self.conn.execute("INSERT INTO sessions (id,user_id,scenario_id,title,status,created_at,updated_at) VALUES ('s','u','renewal','练习','completed','t','t')")
        self.conn.execute("INSERT INTO messages (id,session_id,role,content,created_at) VALUES ('u1','s','user','您是觉得预算有压力，还是效果不明确？','t')")
        self.conn.execute("INSERT INTO messages (id,session_id,role,content,created_at) VALUES ('n1','s','npc','主要是预算。','t')")
        self.conn.commit()

        @contextmanager
        def database():
            try:
                yield self.conn
                self.conn.commit()
            except Exception:
                self.conn.rollback()
                raise
        self.patches = [patch('app.services.report.db', database), patch('app.api.reviews.db', database)]
        for p in self.patches:
            p.start()
        self.review = {'rubricId': 'xiaolian-sales-core', 'rubricVersion': '1.0.0',
                       'status': 'completed', 'totalScore': 0,
                       'criteria': [{'id': 'S4', 'status': 'assessed', 'score': 0}],
                       'coaching': {'keep': '', 'fix': '继续确认顾虑', 'nextPractice': '练习澄清价格异议', 'focusCriterionId': 'S4'}}

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.conn.close()

    def test_new_report_uses_program_score_and_stable_opening_evidence(self):
        with patch('app.services.report.evaluate_business_review', return_value=self.review) as evaluate:
            report = _generate('s')
        self.assertEqual(report['feedback']['scores'], {'overall': 0})
        self.assertEqual(report['businessReview']['totalScore'], 0)
        self.assertNotIn('detailedAnalysis', report['feedback'])
        self.assertEqual(report['messages'][0]['messageId'], 'opening:s')
        self.assertEqual(report['messages'][0]['content'], '续约太贵了。')
        self.assertEqual([m['id'] for m in evaluate.call_args.args[1]], ['opening:s', 'u1', 'n1'])
        state = json.loads(self.conn.execute('SELECT state_json FROM session_states').fetchone()[0])
        self.assertEqual(state['rubricSnapshot'], report['rubricSnapshot'])

    def test_rule_snapshot_survives_scenario_edit_and_model_failure(self):
        with patch('app.services.report.evaluate_business_review', side_effect=ValueError('provider unavailable')):
            with self.assertRaises(ValueError):
                _generate('s')
        stored = json.loads(self.conn.execute('SELECT state_json FROM session_states').fetchone()[0])
        changed = {**self.scene, 'title': '已更改', 'rubricConfig': {'criterionIds': ['S2']}}
        self.conn.execute('UPDATE scenarios SET data=?', (json.dumps(changed),))
        self.conn.commit()
        with patch('app.services.report.evaluate_business_review', return_value=self.review) as evaluate:
            report = _generate('s')
        self.assertEqual(report['rubricSnapshot'], stored['rubricSnapshot'])
        self.assertEqual(evaluate.call_args.args[0]['title'], '续约谈判')

    def test_incomplete_never_appears_as_zero_in_history(self):
        incomplete = {**self.review, 'status': 'incomplete', 'totalScore': None}
        with patch('app.services.report.evaluate_business_review', return_value=incomplete):
            report = _generate('s')
        self.conn.execute("INSERT INTO analysis_reports VALUES ('s','completed',?,NULL,'t','t')", (json.dumps(report),))
        self.conn.commit()
        item = list_reviews('practice', 1, UserInfo(user_id='u', nickname='u', is_admin=False), 'completed')['items'][0]
        self.assertIsNone(item['overall_score'])
        self.assertEqual(item['business_review_status'], 'incomplete')
        self.assertEqual(item['key_finding'], '继续确认顾虑')

    def test_cached_legacy_report_is_not_rescored(self):
        legacy = {'feedback': {'scores': {'overall': 82}}}
        self.conn.execute("INSERT INTO analysis_reports VALUES ('s','completed',?,NULL,'t','t')", (json.dumps(legacy),))
        self.conn.commit()
        with patch('app.services.report.evaluate_business_review') as evaluate:
            self.assertEqual(get_cached_report('s'), legacy)
        evaluate.assert_not_called()

    def test_comparison_requires_matching_version_and_assessed_items(self):
        snapshot = build_rubric_snapshot(self.scene)
        previous = {'businessReview': self.review, 'rubricSnapshot': snapshot}
        current = copy.deepcopy(self.review)
        current['criteria'][0]['score'] = 1
        focus = {'sourceSessionId': 'old', 'criterionId': 'S4', 'previousScore': 2}
        comparison = _practice_comparison(focus, current, snapshot, previous)
        self.assertTrue(comparison['comparable'])
        self.assertEqual(comparison['previousScore'], 0)  # never trust the client/focus score
        self.assertEqual(comparison['delta'], 1)
        different = {**snapshot, 'rubricVersion': '99.0.0'}
        self.assertFalse(_practice_comparison(focus, current, different, previous)['comparable'])
        current['criteria'][0].update(status='insufficient_evidence', score=None)
        self.assertIsNone(_practice_comparison(focus, current, snapshot, previous)['delta'])


if __name__ == '__main__':
    unittest.main()
