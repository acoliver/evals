import { FormSubmission, ValidationResult, ValidationError } from './types.js';

export class FormValidator {
  static validateSubmission(formData: Partial<FormSubmission>): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!this.validateRequired(formData.first_name)) {
      errors.push({ field: 'first_name', message: 'First name is required' });
    }

    if (!this.validateRequired(formData.last_name)) {
      errors.push({ field: 'last_name', message: 'Last name is required' });
    }

    if (!this.validateRequired(formData.street_address)) {
      errors.push({ field: 'street_address', message: 'Street address is required' });
    }

    if (!this.validateRequired(formData.city)) {
      errors.push({ field: 'city', message: 'City is required' });
    }

    if (!this.validateRequired(formData.state_province)) {
      errors.push({ field: 'state_province', message: 'State/Province/Region is required' });
    }

    if (!this.validateRequired(formData.postal_code)) {
      errors.push({ field: 'postal_code', message: 'Postal/Zip code is required' });
    } else if (!this.validatePostalCode(formData.postal_code!)) {
      errors.push({ field: 'postal_code', message: 'Postal code must contain letters and/or digits only' });
    }

    if (!this.validateRequired(formData.country)) {
      errors.push({ field: 'country', message: 'Country is required' });
    }

    if (!this.validateRequired(formData.email)) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!this.validateEmail(formData.email!)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }

    if (!this.validateRequired(formData.phone)) {
      errors.push({ field: 'phone', message: 'Phone number is required' });
    } else if (!this.validatePhone(formData.phone!)) {
      errors.push({ field: 'phone', message: 'Phone number can only contain digits, spaces, parentheses, dashes, and a leading +' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static validateRequired(value?: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private static validateEmail(email: string): boolean {
    // Simple email regex - basic validation for international emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  private static validatePhone(phone: string): boolean {
    // Allow international phone formats: digits, spaces, parentheses, dashes, leading +
    // Examples: +44 20 7946 0958, +54 9 11 1234-5678, (555) 123-4567, 555-123-4567
    const phoneRegex = /^\+?[0-9\-\s\(\)]+$/;
    return phoneRegex.test(phone.trim()) && phone.trim().length >= 7;
  }

  private static validatePostalCode(postalCode: string): boolean {
    // Allow alphanumeric postal codes
    // Examples: SW1A 1AA (UK), C1000 (Argentina), B1675 (Argentina), 90210 (US), M5V 3L9 (Canada)
    const postalCodeRegex = /^[A-Za-z0-9\s\-]+$/;
    return postalCodeRegex.test(postalCode.trim()) && postalCode.trim().length >= 3;
  }

  static formatErrorsAsRecord(errors: ValidationError[]): Record<string, string> {
    const errorRecord: Record<string, string> = {};
    errors.forEach(error => {
      errorRecord[error.field] = error.message;
    });
    return errorRecord;
  }
}