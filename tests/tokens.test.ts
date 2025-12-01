/**
 * Tests for the configurable token management system
 * 
 * These tests verify that the token system works correctly
 * WITHOUT any hardcoded organization values - all configuration
 * is done programmatically as users would do.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractOrg,
  getTokenEnvVar,
  getTokenForOrg,
  getTokenForRepo,
  getPRReviewToken,
  getPRReviewTokenEnvVar,
  validateTokens,
  getEnvForRepo,
  getEnvForPRReview,
  hasTokenForOrg,
  hasTokenForRepo,
  getConfiguredOrgs,
  getTokenSummary,
  setTokenConfig,
  addOrganization,
  removeOrganization,
  resetTokenConfig,
  isOrgConfigured,
} from "../src/core/tokens.js";

describe("Token Management (Configurable)", () => {
  // Store original env vars
  const originalEnv: Record<string, string | undefined> = {};
  
  beforeEach(() => {
    // Save original env vars
    originalEnv.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    originalEnv.TEST_ORG_TOKEN = process.env.TEST_ORG_TOKEN;
    originalEnv.ANOTHER_ORG_TOKEN = process.env.ANOTHER_ORG_TOKEN;
    originalEnv.PR_REVIEW_TOKEN = process.env.PR_REVIEW_TOKEN;
    
    // Reset config before each test
    resetTokenConfig();
    
    // Set up test environment
    process.env.GITHUB_TOKEN = "default-token";
    process.env.TEST_ORG_TOKEN = "test-org-token";
    process.env.ANOTHER_ORG_TOKEN = "another-org-token";
    process.env.PR_REVIEW_TOKEN = "pr-review-token";
  });

  afterEach(() => {
    // Restore original env vars
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    // Reset config after each test
    resetTokenConfig();
  });

  describe("extractOrg", () => {
    it("extracts org from full GitHub URL", () => {
      expect(extractOrg("https://github.com/test-org/my-repo")).toBe("test-org");
      expect(extractOrg("https://github.com/another-org/repo.git")).toBe("another-org");
    });

    it("extracts org from SSH URL", () => {
      expect(extractOrg("git@github.com:test-org/my-repo.git")).toBe("test-org");
    });

    it("extracts org from owner/repo format", () => {
      expect(extractOrg("test-org/my-repo")).toBe("test-org");
      expect(extractOrg("another-org/some-repo")).toBe("another-org");
    });

    it("returns null for invalid input", () => {
      expect(extractOrg("invalid")).toBeNull();
      expect(extractOrg("")).toBeNull();
    });

    it("handles orgs with special characters safely", () => {
      expect(extractOrg("my-org-123/repo")).toBe("my-org-123");
      expect(extractOrg("org_name/repo")).toBe("org_name");
      expect(extractOrg("Org.Name/repo")).toBe("Org.Name");
    });
  });

  describe("Organization Configuration", () => {
    it("starts with no configured organizations", () => {
      expect(getConfiguredOrgs()).toEqual([]);
    });

    it("allows adding organizations programmatically", () => {
      addOrganization({
        name: "test-org",
        tokenEnvVar: "TEST_ORG_TOKEN",
      });
      
      expect(getConfiguredOrgs()).toContain("test-org");
      expect(isOrgConfigured("test-org")).toBe(true);
    });

    it("allows removing organizations", () => {
      addOrganization({ name: "temp-org", tokenEnvVar: "TEMP_TOKEN" });
      expect(isOrgConfigured("temp-org")).toBe(true);
      
      removeOrganization("temp-org");
      expect(isOrgConfigured("temp-org")).toBe(false);
    });

    it("allows bulk configuration via setTokenConfig", () => {
      setTokenConfig({
        organizations: {
          "org-a": { name: "org-a", tokenEnvVar: "ORG_A_TOKEN" },
          "org-b": { name: "org-b", tokenEnvVar: "ORG_B_TOKEN" },
        },
        prReviewTokenEnvVar: "PR_REVIEW_TOKEN",
      });
      
      expect(getConfiguredOrgs()).toContain("org-a");
      expect(getConfiguredOrgs()).toContain("org-b");
      expect(getPRReviewTokenEnvVar()).toBe("PR_REVIEW_TOKEN");
    });
  });

  describe("Token Resolution", () => {
    beforeEach(() => {
      // Configure test organizations
      addOrganization({ name: "test-org", tokenEnvVar: "TEST_ORG_TOKEN" });
      addOrganization({ name: "another-org", tokenEnvVar: "ANOTHER_ORG_TOKEN" });
    });

    it("returns correct token env var for configured org", () => {
      expect(getTokenEnvVar("test-org")).toBe("TEST_ORG_TOKEN");
      expect(getTokenEnvVar("another-org")).toBe("ANOTHER_ORG_TOKEN");
    });

    it("returns default token env var for unknown org", () => {
      expect(getTokenEnvVar("unknown-org")).toBe("GITHUB_TOKEN");
    });

    it("resolves actual token value for configured org", () => {
      expect(getTokenForOrg("test-org")).toBe("test-org-token");
      expect(getTokenForOrg("another-org")).toBe("another-org-token");
    });

    it("resolves token from repository URL", () => {
      expect(getTokenForRepo("https://github.com/test-org/my-repo")).toBe("test-org-token");
      expect(getTokenForRepo("another-org/some-repo")).toBe("another-org-token");
    });

    it("returns default token for unconfigured org repos", () => {
      expect(getTokenForRepo("https://github.com/unknown-org/repo")).toBe("default-token");
    });
  });

  describe("PR Review Token", () => {
    it("defaults to GITHUB_TOKEN for PR reviews", () => {
      expect(getPRReviewTokenEnvVar()).toBe("GITHUB_TOKEN");
      expect(getPRReviewToken()).toBe("default-token");
    });

    it("allows configuring a dedicated PR review token", () => {
      setTokenConfig({ prReviewTokenEnvVar: "PR_REVIEW_TOKEN" });
      
      expect(getPRReviewTokenEnvVar()).toBe("PR_REVIEW_TOKEN");
      expect(getPRReviewToken()).toBe("pr-review-token");
    });
  });

  describe("Environment Helpers", () => {
    beforeEach(() => {
      addOrganization({ name: "test-org", tokenEnvVar: "TEST_ORG_TOKEN" });
      setTokenConfig({ prReviewTokenEnvVar: "PR_REVIEW_TOKEN" });
    });

    it("getEnvForRepo returns correct env vars", () => {
      const env = getEnvForRepo("test-org/repo");
      expect(env.GH_TOKEN).toBe("test-org-token");
      expect(env.GITHUB_TOKEN).toBe("test-org-token");
    });

    it("getEnvForPRReview returns PR review token", () => {
      const env = getEnvForPRReview();
      expect(env.GH_TOKEN).toBe("pr-review-token");
      expect(env.GITHUB_TOKEN).toBe("pr-review-token");
    });

    it("returns empty object when token not available", () => {
      delete process.env.TEST_ORG_TOKEN;
      const env = getEnvForRepo("test-org/repo");
      expect(env).toEqual({});
    });
  });

  describe("Token Availability Checks", () => {
    beforeEach(() => {
      addOrganization({ name: "test-org", tokenEnvVar: "TEST_ORG_TOKEN" });
    });

    it("hasTokenForOrg returns true when token is set", () => {
      expect(hasTokenForOrg("test-org")).toBe(true);
    });

    it("hasTokenForOrg returns false when token is not set", () => {
      addOrganization({ name: "no-token-org", tokenEnvVar: "NONEXISTENT_TOKEN" });
      expect(hasTokenForOrg("no-token-org")).toBe(false);
    });

    it("hasTokenForRepo checks token availability by URL", () => {
      expect(hasTokenForRepo("test-org/repo")).toBe(true);
      expect(hasTokenForRepo("https://github.com/test-org/repo")).toBe(true);
    });
  });

  describe("Validation", () => {
    beforeEach(() => {
      addOrganization({ name: "test-org", tokenEnvVar: "TEST_ORG_TOKEN" });
      addOrganization({ name: "missing-org", tokenEnvVar: "NONEXISTENT_TOKEN" });
    });

    it("validates all configured tokens", () => {
      const result = validateTokens();
      expect(result.success).toBe(false);
      expect(result.data).toContain("missing-org: NONEXISTENT_TOKEN not set");
    });

    it("validates specific orgs", () => {
      const result = validateTokens(["test-org"]);
      // Should pass for test-org since its token is set
      // But will still check PR review and default tokens
      expect(result.data?.some(m => m.includes("test-org"))).toBe(false);
    });
  });

  describe("Token Summary", () => {
    beforeEach(() => {
      addOrganization({ name: "test-org", tokenEnvVar: "TEST_ORG_TOKEN" });
      addOrganization({ name: "missing-org", tokenEnvVar: "NONEXISTENT_TOKEN" });
    });

    it("provides summary of all token configurations", () => {
      const summary = getTokenSummary();
      
      expect(summary["test-org"]).toEqual({
        envVar: "TEST_ORG_TOKEN",
        available: true,
        configured: true,
      });
      
      expect(summary["missing-org"]).toEqual({
        envVar: "NONEXISTENT_TOKEN",
        available: false,
        configured: true,
      });
      
      expect(summary["_default"]).toBeDefined();
      expect(summary["_pr_review"]).toBeDefined();
    });
  });

  describe("Case Insensitivity", () => {
    beforeEach(() => {
      addOrganization({ name: "TestOrg", tokenEnvVar: "TEST_ORG_TOKEN" });
    });

    it("matches organizations case-insensitively", () => {
      expect(getTokenForOrg("TestOrg")).toBe("test-org-token");
      expect(getTokenForOrg("testorg")).toBe("test-org-token");
    });
  });

  describe("ReDoS Protection", () => {
    it("handles potentially malicious input safely", () => {
      // These should not cause excessive backtracking
      const maliciousInputs = [
        "github.com" + "/".repeat(1000) + "org",
        "a".repeat(1000) + "/repo",
        "github.com:" + ":".repeat(1000) + "org/repo",
      ];
      
      for (const input of maliciousInputs) {
        const start = Date.now();
        extractOrg(input);
        const elapsed = Date.now() - start;
        // Should complete in under 100ms even with malicious input
        expect(elapsed).toBeLessThan(100);
      }
    });
  });
});
