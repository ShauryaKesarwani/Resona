/** QR codes and typed codes use the same six-digit check-in code. */
export function checkinCode(value: string): string | null {
  const code = value.trim()
  return /^\d{6}$/.test(code) ? code : null
}
