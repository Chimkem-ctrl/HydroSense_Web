export interface SignInValues {
  email: string;
  password: string;
}

export interface SignUpValues extends SignInValues {
  firstName: string;
  lastName: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface ForgotPasswordValues {
  email: string;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;
