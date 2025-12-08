# Installation

## Requirements

- Python 3.9+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

## Install from PyPI

```bash
# Using uv (recommended)
uv add PACKAGE_NAME

# Using pip
pip install PACKAGE_NAME
```

## Install from Source

```bash
git clone https://github.com/jbcom/PACKAGE_NAME.git
cd PACKAGE_NAME
uv sync
```

## Development Installation

```bash
# Clone and install with dev dependencies
git clone https://github.com/jbcom/PACKAGE_NAME.git
cd PACKAGE_NAME
uv sync --extra dev --extra docs
```
