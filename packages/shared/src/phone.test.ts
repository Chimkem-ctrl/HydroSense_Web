import { describe, expect, it } from 'vitest';
import { formatSignupPhone, PHONE_COUNTRIES } from './phone';

describe('signup phone numbers', () => {
  it('lists worldwide countries and distinguishes shared calling codes', () => {
    expect(PHONE_COUNTRIES.length).toBeGreaterThan(240);
    expect(PHONE_COUNTRIES.every((country) => country.flag.startsWith('<svg'))).toBe(true);
    expect(PHONE_COUNTRIES).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PH', name: 'Philippines', callingCode: '+63' }),
      expect.objectContaining({ code: 'US', callingCode: '+1' }),
      expect.objectContaining({ code: 'CA', callingCode: '+1' }),
    ]));
  });

  it('formats national input as international numbers for the selected country', () => {
    expect(formatSignupPhone('PH', '0917 555 0100')).toBe('+639175550100');
    expect(formatSignupPhone('GB', '020 7946 0018')).toBe('+442079460018');
    expect(formatSignupPhone('US', '(202) 555-0123')).toBe('+12025550123');
  });

  it('rejects empty, impossible, and international numbers in the national field', () => {
    expect(formatSignupPhone('PH', '')).toBeNull();
    expect(formatSignupPhone('PH', 'abc')).toBeNull();
    expect(formatSignupPhone('PH', '12')).toBeNull();
    expect(formatSignupPhone('PH', '+639175550100')).toBeNull();
    expect(formatSignupPhone('PH', '0044 20 7946 0018')).toBeNull();
  });
});
