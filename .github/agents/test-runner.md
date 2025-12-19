# Test Runner Agent

## Description
Runs and manages tests for the repository.

## Capabilities
- Run unit tests
- Run integration tests
- Run E2E tests
- Generate coverage reports
- Identify flaky tests

## Instructions

### Running Tests

Check the project's package.json or Makefile for available test commands.

Common patterns:
```bash
# Node.js projects
npm test
pnpm test
yarn test

# Python projects
pytest
python -m pytest

# Go projects
go test ./...

# General
make test
```

### Test File Locations

| Test Type | Common Locations |
|-----------|------------------|
| Unit | `tests/`, `test/`, `*_test.*`, `*.test.*` |
| Integration | `tests/integration/`, `integration/` |
| E2E | `tests/e2e/`, `e2e/` |

### Writing New Tests

#### Test Template (Generic)
```
describe('FunctionName', () => {
    it('should handle normal input', () => {
        expect(myFunction(input)).toBe(expected);
    });

    it('should handle edge cases', () => {
        expect(myFunction(edgeCase)).toBe(expectedEdge);
    });

    it('should throw on invalid input', () => {
        expect(() => myFunction(invalid)).toThrow();
    });
});
```

### Debugging Failed Tests

1. **Check test output** for error messages
2. **Run in isolation** to rule out test interference
3. **Check for async issues** - ensure proper awaits
4. **Verify test data** - ensure fixtures are correct
5. **Check environment** - CI vs local differences

### Coverage Guidelines

- Aim for 80%+ coverage on critical paths
- 100% coverage on security-sensitive code
- Don't chase coverage metrics at expense of quality
