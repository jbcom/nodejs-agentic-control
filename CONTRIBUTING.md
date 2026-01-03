---
version: 1.0.1
last_updated: 2026-01-03T02:21:30Z
sync_type: always
---

# Contributing to Control Center

Thank you for your interest in contributing! We are **stewards and servants of the open source community FIRST**.

## Our Standards

We **mandate** these standards because we believe in leading by example:

### Conventional Commits (REQUIRED)

Every commit MUST follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

| Type | Description | Triggers Release |
|------|-------------|------------------|
| `feat` | New feature | Minor bump |
| `fix` | Bug fix | Patch bump |
| `docs` | Documentation only | No |
| `style` | Formatting, no code change | No |
| `refactor` | Code change without feat/fix | No |
| `perf` | Performance improvement | Patch bump |
| `test` | Adding/fixing tests | No |
| `build` | Build system or dependencies | No |
| `ci` | CI/CD configuration | No |
| `chore` | Maintenance tasks | No |
| `deps` | Dependency updates | Patch bump |
| `revert` | Revert previous commit | Patch bump |

#### Breaking Changes

Add `!` after type or include `BREAKING CHANGE:` in footer:

```
feat!: remove deprecated API

BREAKING CHANGE: The old API has been removed. Use the new API instead.
```

#### Examples

```bash
# Good
feat(reviewer): add support for multi-file review
fix(curator): handle empty issue body gracefully
docs: update installation instructions
refactor(clients): simplify Ollama error handling
deps: bump cobra to v1.10.2

# Bad
Fixed bug                    # No type
feat: Add new feature        # Wrong case (use lowercase)
fix: fixed the thing.        # No trailing period
Update code                  # Not conventional
```

### Semantic Versioning (AUTOMATIC)

We use [Release Please](https://github.com/googleapis/release-please) for automated versioning:

- `feat:` → Minor version bump (0.1.0 → 0.2.0)
- `fix:`, `perf:`, `deps:` → Patch version bump (0.1.0 → 0.1.1)
- `feat!:` or `BREAKING CHANGE:` → Major version bump (0.1.0 → 1.0.0)

### Pre-commit Hooks (REQUIRED)

Install pre-commit hooks before contributing:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install
pre-commit install --hook-type commit-msg

# Run on all files
pre-commit run --all-files
```

### Code Quality

- **Go**: Run `make lint` before committing
- **Tests**: Run `make test` and ensure all pass
- **Format**: Run `make fmt` or let pre-commit handle it

## Development Workflow

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/control-center.git
cd control-center
```

### 2. Create Feature Branch

```bash
git checkout -b feat/your-feature
```

### 3. Make Changes

```bash
# Build
make build

# Test
make test

# Lint
make lint
```

### 4. Commit with Conventional Format

```bash
git add .
git commit -m "feat(scope): add your feature"
```

### 5. Push and Create PR

```bash
git push origin feat/your-feature
```

Then create a Pull Request on GitHub.

## Pull Request Guidelines

1. **Title**: Use conventional commit format
2. **Description**: Explain what and why, not how
3. **Tests**: Add tests for new functionality
4. **Docs**: Update documentation if needed
5. **Review**: Address all AI and human feedback

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/jbcom/control-center/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jbcom/control-center/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
