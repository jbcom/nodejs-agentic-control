# Contributing

Thank you for your interest in contributing to agentic-control!

## Development Setup

### TypeScript Core

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm run test

# Format code
pnpm run format

# Lint
pnpm run lint
```

### Python CrewAI

```bash
cd python

# Install dependencies with uv
uv sync --extra tests --extra docs

# Run tests
uv run pytest tests/ -v

# Lint and format
uvx ruff check --fix src/ tests/
uvx ruff format src/ tests/
```

## Code Style

### TypeScript

- Use Prettier for formatting
- Follow ESLint rules
- Use TypeScript strict mode

### Python

- Use Ruff for linting and formatting
- Follow PEP 8 guidelines
- Use type hints throughout

## Commit Messages

Use conventional commits format:

- `feat(fleet): new fleet feature` → minor version bump
- `feat(crew): Python crew feature` → minor version bump
- `fix(triage): bug fix` → patch version bump
- `docs: update documentation` → no version bump
- `chore: maintenance tasks` → no version bump

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure tests pass
5. Submit a pull request

## Documentation

### Building Documentation

```bash
# From the project root
uv run --project python sphinx-build -b html docs docs/_build/html
```

### Documentation Standards

- Use Google-style docstrings for Python
- Use TSDoc comments for TypeScript
- Include examples where helpful
- Keep documentation up to date with code changes
