import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

const SCRYPT_ALGORITHM_TAG = "scrypt";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

// scrypt$N$r$p$<saltBase64>$<hashBase64>
const STORED_HASH_PATTERN = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/]+=*)\$([A-Za-z0-9+/]+=*)$/;

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH || plain.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`);
  }

  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await scryptAsync(plain, salt, KEY_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });

  return [
    SCRYPT_ALGORITHM_TAG,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derivedKey.toString("base64"),
  ].join("$");
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const match = STORED_HASH_PATTERN.exec(stored);

  if (!match) {
    return false;
  }

  const [, nText, rText, pText, saltBase64, hashBase64] = match;

  try {
    const salt = Buffer.from(saltBase64, "base64");
    const expected = Buffer.from(hashBase64, "base64");

    // The expected key length is pinned to KEY_BYTES rather than trusting the decoded
    // length of `expected`, so a truncated stored hash cannot shrink the comparison
    // down to a length (e.g. 0) that would make timingSafeEqual trivially pass.
    if (expected.length !== KEY_BYTES) {
      return false;
    }

    const candidate = await scryptAsync(plain, salt, KEY_BYTES, {
      N: Number(nText),
      r: Number(rText),
      p: Number(pText),
    });

    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}
