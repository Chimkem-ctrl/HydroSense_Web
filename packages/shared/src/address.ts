import { getAllProvinces, getAllRegions, getAllMunicipalities, getBarangaysByMunicipality } from '@aivangogh/ph-address';

export interface SignupAddress {
  country: string;
  province: string;
  city: string;
  barangay: string;
  street: string;
}

export const EMPTY_SIGNUP_ADDRESS: SignupAddress = { country: '', province: '', city: '', barangay: '', street: '' };
const provinces = getAllProvinces();
const regions = getAllRegions();
const municipalities = getAllMunicipalities();

export const ADDRESS_PROVINCES = [
  ...provinces.map((province) => ({ id: province.psgcCode, name: province.name })),
  ...regions.filter((region) => municipalities.some((city) =>
    city.psgcCode.startsWith(region.psgcCode.slice(0, 2)) && !provinces.some((province) => province.psgcCode === city.provinceCode),
  )).map((region) => ({ id: region.psgcCode, name: `${region.name} (independent areas)` })),
].sort((a, b) => a.name.localeCompare(b.name));

export function addressCities(province: string) {
  const isRegion = regions.some((region) => region.psgcCode === province);
  return municipalities.filter((city) => isRegion
    ? city.psgcCode.startsWith(province.slice(0, 2)) && !provinces.some((item) => item.psgcCode === city.provinceCode)
    : city.provinceCode === province).map((city) => ({
      id: city.psgcCode,
      name: city.provinceCode === '1380600000' ? `Manila - ${city.name}` : city.name,
    }));
}

export function addressBarangays(city: string) {
  return getBarangaysByMunicipality(city).map((barangay) => ({ id: barangay.psgcCode, name: barangay.name }));
}

export function formatSignupAddress(address: SignupAddress): string | null {
  if (!address || address.country !== 'PH' || typeof address.street !== 'string' || !address.street.trim()) return null;
  const province = ADDRESS_PROVINCES.find((item) => item.id === address.province);
  const city = addressCities(address.province).find((item) => item.id === address.city);
  const barangay = addressBarangays(address.city).find((item) => item.id === address.barangay);
  if (!province || !city || !barangay) return null;
  return [address.street.trim(), barangay.name, city.name, province.name.replace(' (independent areas)', ''), 'Philippines'].join(', ');
}
