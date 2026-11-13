/**
 * Custom Error definitions for PDF processing and lifecycle management
 */

export class PasswordRequiredError extends Error {
  constructor(message = "This document is password protected. Please enter the password to open it.") {
    super(message);
    this.name = "PasswordRequiredError";
  }
}

export class InvalidPasswordError extends Error {
  constructor(message = "Incorrect password. Please verify and try again.") {
    super(message);
    this.name = "InvalidPasswordError";
  }
}

export class CorruptedPdfError extends Error {
  constructor(message = "The PDF file is corrupted or formatted improperly.") {
    super(message);
    this.name = "CorruptedPdfError";
  }
}

export class UnsupportedFeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFeatureError";
  }
}
