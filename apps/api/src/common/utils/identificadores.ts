export function esIdBigint(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
