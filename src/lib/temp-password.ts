/**
 * Temporary passwords for accounts an admin creates or resets. Client-safe
 * (no server imports) so the Users app can pre-fill the same kind of value
 * the API would otherwise generate.
 *
 * Letters and digits only, with the look-alikes (0/O, 1/l/I) left out so
 * the password survives being read out loud or copied by hand.
 */
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LETTERS + DIGITS;

export const TEMP_PASSWORD_LENGTH = 10;

function randomIndexes(count: number, bound: number): number[] {
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % bound);
  const out: number[] = [];
  const buf = new Uint8Array(count * 2);
  while (out.length < count) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit) out.push(b % bound);
      if (out.length === count) break;
    }
  }
  return out;
}

export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  for (;;) {
    const chars = randomIndexes(length, ALPHABET.length).map((i) => ALPHABET[i]);
    const value = chars.join("");
    // Always mix letters and digits so it never reads as a plain word/number
    if (/[0-9]/.test(value) && /[a-zA-Z]/.test(value)) return value;
  }
}
