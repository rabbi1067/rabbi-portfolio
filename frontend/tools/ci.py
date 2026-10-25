import io
import sys
import unittest

suite = unittest.TestLoader().discover('tests')
stream = io.StringIO()
result = unittest.TextTestRunner(stream=stream, verbosity=2, failfast=False).run(suite)
print(stream.getvalue())
print(f'result={result.wasSuccessful()}')

for kind, pairs in (('ERROR', result.errors), ('FAIL', result.failures)):
    for test, err in pairs:
        lines = f'{kind} : {test} START -> ' + '|'.join(err.strip().splitlines())
        for index in range(0, len(lines), 240):
            print(f'::error::EV{index} {lines[index:index + 240]}')

sys.exit(0 if result.wasSuccessful() else 1)
