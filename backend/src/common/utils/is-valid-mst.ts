const MST_WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3];

export function isValidMST(mst: string): boolean {
  if (typeof mst !== 'string') return false;
  const cleanMst = mst.replace(/-/g, '');
  if (!/^\d{10}$/.test(cleanMst) && !/^\d{13}$/.test(cleanMst)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cleanMst[i]) * MST_WEIGHTS[i];
  }
  let checkDigit = 10 - (sum % 11);

  if (checkDigit === 10) {
    checkDigit = 0;
  }
  return checkDigit === Number(cleanMst[9]);
}