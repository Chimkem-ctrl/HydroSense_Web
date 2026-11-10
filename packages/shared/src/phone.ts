import { countries } from 'country-data-list';
import * as flags from 'country-flag-icons/string/3x2';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

export type PhoneCountryCode = CountryCode;

const countryNames = new Map(countries.all.map((country) => [country.alpha2, country.name]));
const countryFlags = new Map(Object.entries(flags));

export const PHONE_COUNTRIES = getCountries().map((code) => {
  const name = countryNames.get(code);
  const flag = countryFlags.get(code);
  if (!name) throw new Error(`Missing phone country name for ${code}.`);
  if (!flag) throw new Error(`Missing phone country flag for ${code}.`);
  return { code, name, flag, callingCode: `+${getCountryCallingCode(code)}` };
}).sort((a, b) => a.name.localeCompare(b.name));

export function formatSignupPhone(country: PhoneCountryCode, nationalNumber: string): string | null {
  const input = nationalNumber.trim();
  if (!input || !/^[\d\s().-]+$/.test(input)) return null;
  const phone = parsePhoneNumberFromString(input, country);
  return phone?.countryCallingCode === getCountryCallingCode(country) && phone.isPossible() ? phone.number : null;
}
