import pytest
import sys

class FailureLogger:
    def __init__(self):
        self.failures = []

    def pytest_runtest_logreport(self, report):
        if report.failed and report.when == "call":
            self.failures.append(report.nodeid)

logger = FailureLogger()
pytest.main(["backend/tests/", "-v"], plugins=[logger])

print("\n" + "="*50)
print("FAILED TESTS SUMMARY:")
for f in logger.failures:
    print("  - ", f)
print("="*50)
