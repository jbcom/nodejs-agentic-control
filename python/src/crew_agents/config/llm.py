"""LLM Configuration for CrewAI agents.

Uses Anthropic Claude directly via ANTHROPIC_API_KEY.
Falls back to OpenRouter if OPENROUTER_API_KEY is set.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum

try:
    from crewai import LLM
except ImportError:
    # Allow module to load even if crewai not installed (for testing)
    LLM = None  # type: ignore


class LLMProvider(Enum):
    """Available LLM providers."""

    ANTHROPIC = "anthropic"
    OPENROUTER = "openrouter"


@dataclass(frozen=True)
class LLMConfig:
    """Configuration for specific LLM use cases."""

    model: str
    temperature: float
    description: str


# Model identifiers
_CLAUDE_SONNET_37 = "claude-3-7-sonnet-20250219"
_CLAUDE_SONNET_35 = "claude-3-5-sonnet-20241022"
_CLAUDE_OPUS_3 = "claude-3-opus-20240229"

# Default model - Claude 3.7 Sonnet for best code generation
DEFAULT_MODEL = _CLAUDE_SONNET_37

# Alternative models
MODELS = {
    "sonnet": _CLAUDE_SONNET_37,
    "sonnet-3.5": _CLAUDE_SONNET_35,
    "opus": _CLAUDE_OPUS_3,
    # OpenRouter fallbacks
    "openrouter-auto": "openrouter/auto",
    "openrouter-sonnet": "openrouter/anthropic/claude-3.7-sonnet",
}

# Predefined configurations for common use cases
LLM_CONFIGS = {
    "reasoning": LLMConfig(
        model=_CLAUDE_OPUS_3, temperature=0.3, description="Optimized for complex reasoning tasks"
    ),
    "creative": LLMConfig(
        model=_CLAUDE_SONNET_37,
        temperature=0.8,
        description="Optimized for creative content generation",
    ),
    "code": LLMConfig(
        model=_CLAUDE_SONNET_37,
        temperature=0.2,
        description="Optimized for code generation and analysis",
    ),
    "default": LLMConfig(
        model=_CLAUDE_SONNET_37,
        temperature=0.7,
        description="Balanced configuration for general use",
    ),
}


def get_llm(
    model: str = DEFAULT_MODEL, temperature: float = 0.7, provider: LLMProvider | None = None
) -> LLM | None:
    """Get configured LLM instance for CrewAI agents.

    Args:
        model: Model identifier. Defaults to claude-3-7-sonnet-20250219 (DEFAULT_MODEL)
        temperature: Sampling temperature (0.0-1.0). Lower = more focused,
                    higher = more creative.
        provider: Force specific provider (ANTHROPIC or OPENROUTER).
                 If None, auto-detects based on available API keys.

    Available models:
        - claude-3-7-sonnet-20250219 (default - best for code)
        - claude-3-5-sonnet-20241022 (previous version)
        - claude-3-opus-20240229 (most capable)
        - openrouter/auto (fallback via OpenRouter)

    Returns:
        Configured LLM instance, or None if no API key set

    Note:
        Tries ANTHROPIC_API_KEY first, falls back to OPENROUTER_API_KEY.
        Returns None if neither is set, allowing CrewAI to use its default.

    Example:
        >>> llm = get_llm()  # Uses Claude 3.7 Sonnet
        >>> llm = get_llm("claude-3-opus-20240229", temperature=0.3)
        >>> llm = get_llm(provider=LLMProvider.OPENROUTER)
    """
    if LLM is None:
        return None

    # Determine provider
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    # Force provider if specified
    if provider == LLMProvider.ANTHROPIC:
        if not anthropic_key:
            return None
        return _create_anthropic_llm(model, temperature, anthropic_key)

    if provider == LLMProvider.OPENROUTER:
        if not openrouter_key:
            return None
        return _create_openrouter_llm(model, temperature, openrouter_key)

    # Auto-detect: Try Anthropic first for direct Claude models
    if anthropic_key and not model.startswith("openrouter/"):
        return _create_anthropic_llm(model, temperature, anthropic_key)

    # Fall back to OpenRouter
    if openrouter_key:
        return _create_openrouter_llm(model, temperature, openrouter_key)

    return None


def _create_anthropic_llm(model: str, temperature: float, api_key: str) -> LLM:
    """Create Anthropic LLM instance."""
    return LLM(
        model=model,
        api_key=api_key,
        temperature=temperature,
    )


def _create_openrouter_llm(model: str, temperature: float, api_key: str) -> LLM:
    """Create OpenRouter LLM instance."""
    # Convert model name to OpenRouter format if needed
    if not model.startswith("openrouter/"):
        model = MODELS.get("openrouter-auto", "openrouter/auto")

    return LLM(
        model=model,
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=temperature,
    )


def get_llm_or_raise(
    model: str = DEFAULT_MODEL, temperature: float = 0.7, provider: LLMProvider | None = None
) -> LLM:
    """Get configured LLM instance, raising if API key not set.

    Use this when you need to ensure an LLM is available.

    Args:
        model: Model identifier (see get_llm for options)
        temperature: Sampling temperature (0.0-1.0)
        provider: Force specific provider (optional)

    Returns:
        Configured LLM instance

    Raises:
        ValueError: If neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set
    """
    llm = get_llm(model, temperature, provider)
    if llm is None:
        raise ValueError(
            "ANTHROPIC_API_KEY or OPENROUTER_API_KEY environment variable must be set. "
            "Get Anthropic key at https://console.anthropic.com/ or "
            "OpenRouter key at https://openrouter.ai/"
        )
    return llm


def get_llm_for_task(task: str) -> LLM | None:
    """Get LLM configured for a specific task type.

    Args:
        task: Task type - one of: 'reasoning', 'creative', 'code', 'default'

    Returns:
        Configured LLM instance, or None if no API key set

    Raises:
        ValueError: If task type is unknown

    Example:
        >>> llm = get_llm_for_task('code')  # Low temp, optimized for code
        >>> llm = get_llm_for_task('creative')  # High temp, creative output
    """
    if task not in LLM_CONFIGS:
        raise ValueError(f"Unknown task type: {task}. Available: {', '.join(LLM_CONFIGS.keys())}")

    config = LLM_CONFIGS[task]
    return get_llm(config.model, config.temperature)


# Convenience functions for specific use cases (backward compatibility)
def get_reasoning_llm() -> LLM | None:
    """Get LLM optimized for complex reasoning tasks."""
    return get_llm_for_task("reasoning")


def get_creative_llm() -> LLM | None:
    """Get LLM optimized for creative tasks."""
    return get_llm_for_task("creative")


def get_code_llm() -> LLM | None:
    """Get LLM optimized for code generation."""
    return get_llm_for_task("code")
