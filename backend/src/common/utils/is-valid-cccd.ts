
export function isValidCccd(cccd: string): boolean {
  if (typeof cccd !== 'string') return false;
  if (!/^\d{12}$/.test(cccd)) return false;

  const provinceCode = cccd.substring(0, 3);
  const centuryGenderCode = parseInt(cccd.substring(3, 4), 10);
  const birthYearCode = parseInt(cccd.substring(4, 6), 10);
  const randomDigits = cccd.substring(6, 12);

  if (provinceCode === '000') return false;

  const provinceInt = parseInt(provinceCode, 10);
  if (randomDigits === '000000') return false;

  const currentYear = new Date().getFullYear();
  let fullBirthYear = 0;

  if (centuryGenderCode === 0 || centuryGenderCode === 1) {
    fullBirthYear = 1900 + birthYearCode;
  } else if (centuryGenderCode === 2 || centuryGenderCode === 3) {
    fullBirthYear = 2000 + birthYearCode;
  } else if (centuryGenderCode === 4 || centuryGenderCode === 5) {
    fullBirthYear = 2100 + birthYearCode;
  }

  if (fullBirthYear > 0 && fullBirthYear > currentYear) {
    return false;
  }

  return true;
}
