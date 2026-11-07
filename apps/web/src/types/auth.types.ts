export interface SignInValues {
  email: string;
  password: string;
}

export interface SignUpValues extends SignInValues {
  firstName: string;
  lastName: string;
  employeeId: string;
  phone: string;
  position: string;
  hatcheryId: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export type AccountRole = 'ADMINISTRATOR' | 'OPERATOR';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AccountRole;
  employeeId?: string;
  phone?: string;
  position?: string;
  hatcheryId?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface StoredAccount {
  user: AuthUser;
  passwordSalt: string;
  passwordHash: string;
}

export interface ForgotPasswordValues {
  email: string;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;
