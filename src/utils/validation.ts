export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: Date,
  endDate: Date,
): ValidationResult {
  if (isNaN(startDate.getTime())) {
    return { isValid: false, error: "Invalid start date" };
  }

  if (isNaN(endDate.getTime())) {
    return { isValid: false, error: "Invalid end date" };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      error: "Start date must be before or equal to end date",
    };
  }

  return { isValid: true };
}

/**
 * Validate user mention format
 */
export function validateUserMention(mention: string): ValidationResult {
  if (!mention || mention.trim().length === 0) {
    return { isValid: false, error: "User mention cannot be empty" };
  }

  const trimmedMention = mention.trim();

  // Accept various formats: @username, username, <@U123456>, U123456
  // Allow alphanumeric, dots, hyphens, underscores in usernames
  const validMentionPattern = /^(@?[\w.-]+|<@[UW][\w]+>|[UW][\w]+)$/;

  if (!validMentionPattern.test(trimmedMention)) {
    return {
      isValid: false,
      error:
        `Invalid user mention format: "${trimmedMention}". Expected formats: @username, username, <@U123456>, or U123456`,
    };
  }

  return { isValid: true };
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function validateDateString(
  dateStr: string,
  paramName: string,
): ValidationResult {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(dateStr)) {
    return {
      isValid: false,
      error:
        `Invalid ${paramName} format: "${dateStr}". Expected format: YYYY-MM-DD`,
    };
  }

  const date = new Date(dateStr + "T00:00:00.000Z");
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error:
        `Invalid ${paramName}: "${dateStr}". Please use a valid date in YYYY-MM-DD format`,
    };
  }

  return { isValid: true };
}

/**
 * Parse and validate date string
 */
export function parseAndValidateDate(dateStr: string, paramName: string): Date {
  const validation = validateDateString(dateStr, paramName);
  if (!validation.isValid) {
    throw new Error(validation.error!);
  }

  return new Date(dateStr + "T00:00:00.000Z");
}
