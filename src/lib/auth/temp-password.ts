/**
 * Hasło tymczasowe (opcja zapasowa do linku): 12 znaków bez mylących (0/O, 1/l/I),
 * zawsze z literą i cyfrą (spełnia validatePassword). Po zalogowaniu wymuszana zmiana.
 */
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LETTERS + DIGITS;
export const TEMP_PASSWORD_LENGTH = 12;

/** Losowanie bez obciążenia (odrzucanie wartości spoza wielokrotności długości alfabetu). */
function pick(alphabet: string, random: () => number): string {
  const limit = 256 - (256 % alphabet.length);
  let byte: number;
  do byte = random();
  while (byte >= limit);
  return alphabet[byte % alphabet.length];
}

const cryptoByte = () => crypto.getRandomValues(new Uint8Array(1))[0];

export function generateTempPassword(random: () => number = cryptoByte): string {
  for (;;) {
    let password = "";
    for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) password += pick(ALPHABET, random);
    if (/[a-zA-Z]/.test(password) && /\d/.test(password)) return password;
  }
}
