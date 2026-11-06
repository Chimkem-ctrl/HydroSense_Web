import { useState } from 'react';
import type { FormEvent } from 'react';
import type { FormErrors } from '../types/auth.types';

interface UseAuthFormOptions<T> {
  initialValues: T;
  validate: (values: T) => FormErrors<T>;
  onSubmit: (values: T) => Promise<void>;
}

export function useAuthForm<T extends object>({
  initialValues,
  validate,
  onSubmit,
}: UseAuthFormOptions<T>) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  function setField<K extends keyof T>(field: K, value: T[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatusMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setStatusMessage('');

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    values,
    errors,
    isSubmitting,
    statusMessage,
    setField,
    setStatusMessage,
    handleSubmit,
  };
}
