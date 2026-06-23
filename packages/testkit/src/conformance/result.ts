export interface ConformanceCheckResult<Token extends string = string> {
  readonly check: string;
  readonly passed: boolean;
  readonly token?: Token;
  readonly message?: string;
}

export interface ConformanceResult<Token extends string = string> {
  readonly passed: boolean;
  readonly checks: readonly ConformanceCheckResult<Token>[];
}

export const passCheck = <Token extends string = string>(check: string): ConformanceCheckResult<Token> => ({
  check,
  passed: true,
});

export const failCheck = <Token extends string = string>(
  check: string,
  token: Token,
  message: string,
): ConformanceCheckResult<Token> => ({
  check,
  passed: false,
  token,
  message,
});

export const conformanceResult = <Token extends string = string>(
  checks: readonly ConformanceCheckResult<Token>[],
): ConformanceResult<Token> => ({
  passed: checks.every((check) => check.passed),
  checks,
});
