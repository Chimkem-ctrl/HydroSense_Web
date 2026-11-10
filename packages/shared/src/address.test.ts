import { describe, expect, it } from 'vitest';
import { ADDRESS_PROVINCES, addressBarangays, addressCities, formatSignupAddress } from './address';

describe('Philippine signup addresses', () => {
  const sagay = { country: 'PH', province: '1001800000', city: '1001805000', barangay: '1001805001', street: '  Main Street  ' };

  it('formats a complete address and rejects missing or mismatched selections', () => {
    expect(formatSignupAddress(sagay)).toBe('Main Street, Alangilan, Sagay, Camiguin, Philippines');
    expect(formatSignupAddress({ ...sagay, street: ' ' })).toBeNull();
    expect(formatSignupAddress({ ...sagay, country: '' })).toBeNull();
    expect(formatSignupAddress({ ...sagay, province: '1300000000' })).toBeNull();
    expect(formatSignupAddress({ ...sagay, city: '1380100000' })).toBeNull();
    expect(formatSignupAddress({ ...sagay, barangay: '1380100001' })).toBeNull();
  });

  it('includes independent NCR cities and Manila districts and validates their barangays', () => {
    expect(ADDRESS_PROVINCES.find((item) => item.id === '1300000000')?.name).toContain('National Capital Region');
    expect(addressCities('1300000000')).toContainEqual({ id: '1380602000', name: 'Manila - Binondo' });
    expect(addressBarangays('1380100000')).toContainEqual({ id: '1380100001', name: 'Barangay 1' });
    expect(formatSignupAddress({ country: 'PH', province: '1300000000', city: '1380602000', barangay: '1380602001', street: 'Street' }))
      .toBe('Street, Barangay 287, Manila - Binondo, National Capital Region, Philippines');
    expect(addressCities('0900000000')).toContainEqual({ id: '0990101000', name: 'Isabela City' });
    expect(addressCities('1900000000').length).toBeGreaterThan(0);
  });
});
