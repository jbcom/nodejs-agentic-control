/**
 * Typed error classes for agentic-control
 */

export enum SandboxErrorCode {
  CONTAINER_CREATE_FAILED = 'CONTAINER_CREATE_FAILED',
  CONTAINER_START_FAILED = 'CONTAINER_START_FAILED',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  WORKSPACE_MOUNT_FAILED = 'WORKSPACE_MOUNT_FAILED',
  OUTPUT_EXTRACTION_FAILED = 'OUTPUT_EXTRACTION_FAILED',
  RUNTIME_NOT_FOUND = 'RUNTIME_NOT_FOUND',
}

export class SandboxError extends Error {
  constructor(
    message: string,
    public code: SandboxErrorCode,
    public containerId?: string,
    public override cause?: Error
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

export enum DockerErrorCode {
  BUILD_FAILED = 'BUILD_FAILED',
  PUSH_FAILED = 'PUSH_FAILED',
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  REGISTRY_AUTH_FAILED = 'REGISTRY_AUTH_FAILED',
}

export class DockerBuildError extends Error {
  constructor(
    message: string,
    public code: DockerErrorCode,
    public dockerfile?: string,
    public override cause?: Error
  ) {
    super(message);
    this.name = 'DockerBuildError';
  }
}

export enum ConfigErrorCode {
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_VALUE = 'INVALID_VALUE',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public code: ConfigErrorCode,
    public field?: string,
    public override cause?: Error
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
