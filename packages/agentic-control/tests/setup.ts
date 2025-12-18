/**
 * Test setup file for agentic-control tests.
 *
 * This file uses the vitest-agentic-control plugin to set up test fixtures
 * and mocking utilities - demonstrating dogfooding of the testing plugin.
 */

import { afterEach, beforeEach } from 'vitest';
import { withTestEnv } from 'vitest-agentic-control/fixtures';

// Global test environment cleanup function
let envCleanup: (() => void) | null = null;

/**
 * Set up test environment before each test.
 *
 * This provides default test tokens and API keys that are
 * commonly needed across tests.
 */
beforeEach(() => {
  // Set up test environment with safe default values
  envCleanup = withTestEnv({
    GITHUB_TOKEN: 'ghp_test_token_12345',
    ANTHROPIC_API_KEY: 'sk-ant-test-key-12345',
    OPENAI_API_KEY: 'sk-test-key-12345',
    TEST_ORG_TOKEN: 'ghp_test_org_token_12345',
    ANOTHER_ORG_TOKEN: 'ghp_another_org_token_12345',
    PR_REVIEW_TOKEN: 'ghp_pr_review_token_12345',
    CREWAI_TESTING: 'true',
  });
});

/**
 * Clean up test environment after each test.
 */
afterEach(() => {
  if (envCleanup) {
    envCleanup();
    envCleanup = null;
  }
});
