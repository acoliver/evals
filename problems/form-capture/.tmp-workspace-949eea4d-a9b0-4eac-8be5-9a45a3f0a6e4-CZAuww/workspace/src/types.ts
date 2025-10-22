export interface FormSubmission {
  first_name: string;
  last_name: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  email: string;
  phone: string;
}

export interface DatabaseSubmission extends FormSubmission {
  id: number;
  created_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface FormDataWithErrors extends FormSubmission {
  errors?: Record<string, string>;
}