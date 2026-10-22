import io
import sys
import unittest
from pathlib import Path

suite = unittest.TestLoader().discover('tests')
stream = io.StringIO()
result = unittest.TextTestRunner(stream=stream, verbosity=2, failfast=False).run(suite)
print(stream.getvalue())
print(f'result={result.wasSuccessful()}')

for kind, pairs in (('ERROR', result.errors), ('FAIL', result.failures)):
    for test, err in pairs:
        chunk = f'{kind} {test} :: {err}'[:1500]
        for index in range(0, len(chunk), 600):
            print(f'::error::CI-EVENT ::{chunk[index:index + 600]}')

sys.exit(0 if result.wasSuccessful() else 1)
