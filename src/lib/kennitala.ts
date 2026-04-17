export function cleanKennitala(input: string): string {
  return (input || "").replace(/[^0-9]/g, "");
}

export function isValidKennitala(input: string): boolean {
  const digits = cleanKennitala(input);
  if (digits.length !== 10) return false;

  const multipliers = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = multipliers.reduce(
    (acc, m, i) => acc + m * parseInt(digits[i], 10),
    0
  );
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  if (checkDigit === 10) return false;
  return checkDigit === parseInt(digits[8], 10);
}

export function formatKennitala(input: string): string {
  const d = cleanKennitala(input);
  if (d.length !== 10) return input;
  return `${d.slice(0, 6)}-${d.slice(6)}`;
}

export function cleanIcelandicPhone(input: string): string {
  const digits = (input || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("354")) return digits.slice(3);
  return digits;
}

export function isValidIcelandicPhone(input: string): boolean {
  const d = cleanIcelandicPhone(input);
  return d.length === 7;
}
