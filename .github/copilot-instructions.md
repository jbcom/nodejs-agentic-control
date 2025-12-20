# Copilot Instructions

> **Repository-specific instructions should be in `.github/copilot-instructions-local.md`**
> This file provides common patterns. Local instructions take precedence.

## Before Starting Any Task

1. **Read the issue/PR description completely**
2. **Check for existing patterns** in the codebase before creating new ones
3. **Run the test suite** before and after changes
4. **Follow the repository's established conventions**

## Code Quality Requirements

### All Changes Must:
- [ ] Pass linting (`npm run lint` / `uv run ruff check`)
- [ ] Pass tests (`npm test` / `uv run pytest`)
- [ ] Include tests for new functionality
- [ ] Follow existing code style and patterns
- [ ] Have clear, descriptive commit messages

### Commit Message Format
```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
```

## Common Patterns

### Error Handling
- Always handle errors explicitly
- Log errors with context
- Throw typed errors when possible

### Testing
- Write tests FIRST when fixing bugs (TDD)
- Test edge cases, not just happy paths
- Mock external dependencies

### Documentation
- Update README if adding features
- Add JSDoc/docstrings to public APIs
- Include usage examples

## Issue Resolution Workflow

1. **Understand**: Read issue, check related code
2. **Reproduce**: If bug, write failing test first
3. **Implement**: Make minimal changes to fix/add feature
4. **Test**: Ensure all tests pass
5. **Document**: Update docs if needed
6. **Commit**: Clear message referencing issue

## What NOT To Do

- ❌ Don't refactor unrelated code
- ❌ Don't add dependencies without justification
- ❌ Don't skip tests
- ❌ Don't change formatting of untouched code
- ❌ Don't make breaking changes without discussion

## Getting Help

If blocked:
1. Check `memory-bank/` for project context
2. Check `docs/` for architecture decisions
3. Look at recent PRs for patterns
4. Ask in the issue for clarification
