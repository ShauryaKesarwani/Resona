/** Compares two hex field values, ignoring casing and leading zeros. */
export const sameField = (a: string, b: string) => BigInt(a) === BigInt(b);

/** Decimal form, so hex casing can't create a second "unique" value. */
export const toDecimal = (hex: string) => BigInt(hex).toString();
