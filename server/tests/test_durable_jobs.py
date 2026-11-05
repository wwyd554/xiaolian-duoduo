from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from app.config import settings
from app.database import SCHEMA, independent_db
from app.workers import jobs


class DurableJobTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.patch = patch.object(settings, "database_path", Path(self.temp.name) / "test.db")
        self.patch.start()
        self.addCleanup(self.patch.stop)
        traces = patch.object(settings, "trace_dir", Path(self.temp.name) / "traces")
        traces.start()
        self.addCleanup(traces.stop)
        with independent_db() as conn:
            conn.executescript(SCHEMA)
            conn.execute("INSERT INTO sessions VALUES ('s','u','scenario','test','completed',NULL,'t','t')")

    def enqueue(self, retry=False):
        with independent_db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            return jobs.enqueue_review(conn, "s", retry=retry)

    def test_concurrent_enqueue_and_claim_only_once(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda _: self.enqueue(), range(8)))
            claims = list(pool.map(lambda _: jobs.claim(), range(8)))
        self.assertEqual(sum(job is not None for job in claims), 1)
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0], 1)

    def test_expired_job_recovers_and_old_worker_cannot_write(self):
        self.enqueue()
        old = jobs.claim()
        with independent_db() as conn:
            conn.execute("UPDATE jobs SET lease_until=?", (time.time() - 1,))
        replacement = jobs.claim()
        self.assertEqual(replacement["attempt"], 2)
        self.assertFalse(jobs.finish(old, {"bad": "stale"}))
        self.assertTrue(jobs.finish(replacement, {"good": "new"}))
        self.assertEqual(self.enqueue(retry=True), "completed")
        with independent_db() as conn:
            report = conn.execute("SELECT * FROM analysis_reports").fetchone()
            self.assertEqual(json.loads(report["report_json"]), {"good": "new"})

    def test_retries_are_bounded_and_manual_retry_is_explicit(self):
        self.enqueue()
        for _ in range(settings.job_max_attempts):
            with independent_db() as conn:
                conn.execute("UPDATE jobs SET next_run_at=0")
            job = jobs.claim()
            self.assertTrue(jobs.finish(job, error=RuntimeError("secret-sensitive-message")))
        self.assertEqual(self.enqueue(), "failed")
        self.assertIsNone(jobs.claim())
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT error FROM jobs").fetchone()[0], "RuntimeError")
            self.assertEqual(conn.execute("SELECT status FROM analysis_reports").fetchone()[0], "failed")
        self.assertEqual(self.enqueue(retry=True), "processing")
        self.assertEqual(jobs.claim()["attempt"], 1)

    def test_atomic_enqueue_rolls_back_with_completion(self):
        with self.assertRaises(RuntimeError):
            with independent_db() as conn:
                conn.execute("BEGIN IMMEDIATE")
                jobs.enqueue_review(conn, "s")
                raise RuntimeError("transaction failed")
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM analysis_reports").fetchone()[0], 0)

    def test_real_process_crash_and_restart(self):
        self.enqueue()
        env = {**os.environ, "DATABASE_PATH": str(settings.database_path),
               "TRACE_DIR": str(settings.trace_dir), "JOB_LEASE_SECONDS": "3", "JOB_TIMEOUT_SECONDS": "10"}
        crash = subprocess.run([sys.executable, "-c", """
import os
from unittest.mock import patch
from app.workers.jobs import claim, ReviewWorker
with patch('app.services.report._generate', side_effect=lambda _: os._exit(9)):
    ReviewWorker().run(claim())
"""], env=env, capture_output=True, timeout=10)
        self.assertEqual(crash.returncode, 9)
        restart = subprocess.run([sys.executable, "-c", """
import time
from unittest.mock import patch
from app.workers.jobs import claim, ReviewWorker
deadline = time.monotonic() + 7
job = None
while job is None and time.monotonic() < deadline:
    job = claim()
    if job is None: time.sleep(.1)
assert job and job['attempt'] == 2
with patch('app.services.report._generate', return_value={'recovered': True}):
    ReviewWorker().run(job)
"""], env=env, capture_output=True, timeout=10)
        self.assertEqual(restart.returncode, 0, restart.stderr.decode())
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT status FROM jobs").fetchone()[0], "completed")
            self.assertEqual(json.loads(conn.execute("SELECT report_json FROM analysis_reports").fetchone()[0]),
                             {"recovered": True})

    def test_empty_result_never_completes_and_corrupt_cache_can_retry(self):
        self.enqueue()
        jobs.finish(jobs.claim(), None)
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT status FROM analysis_reports").fetchone()[0], "pending")
            conn.execute("UPDATE analysis_reports SET status='completed',report_json='not json'")
            conn.execute("UPDATE jobs SET status='completed'")
        self.assertEqual(self.enqueue(retry=True), "processing")

    def test_legacy_processing_imports_once(self):
        with independent_db() as conn:
            conn.execute("INSERT INTO analysis_reports VALUES ('s','processing',NULL,NULL,'t','t')")
        jobs.recover_legacy()
        jobs.recover_legacy()
        self.assertIsNotNone(jobs.claim())
        self.assertIsNone(jobs.claim())

    def test_absolute_deadline_cannot_be_extended_by_heartbeat(self):
        self.enqueue()
        job = jobs.claim()
        with independent_db() as conn:
            conn.execute("UPDATE jobs SET deadline=?", (time.time() - 1,))
        self.assertFalse(jobs.heartbeat(job))
        self.assertFalse(jobs.finish(job, {"late": True}))
        self.assertEqual(jobs.claim()["attempt"], 2)

    @patch("app.services.report._generate", side_effect=ValueError("bad model output"))
    def test_worker_failure_never_creates_fake_success_report(self, generate):
        self.enqueue()
        jobs.ReviewWorker().run(jobs.claim())
        with independent_db() as conn:
            report = conn.execute("SELECT * FROM analysis_reports").fetchone()
            self.assertEqual(report["status"], "pending")
            self.assertIsNone(report["report_json"])


if __name__ == "__main__":
    unittest.main()
