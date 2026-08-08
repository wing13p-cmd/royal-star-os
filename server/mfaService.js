import crypto from "node:crypto";

const TOTP_DIGITS = 6;
const TOTP_STEP_SECONDS = 30;
const DEFAULT_WINDOW = 1;

function normalizeBase32(value = "") {
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
}

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  let bits = "";
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  let output = "";

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += alphabet[parseInt(chunk, 2)];
  }

  return output;
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = normalizeBase32(input);

  let bits = "";

  for (const character of normalized) {
    const index = alphabet.indexOf(character);

    if (index < 0) {
      throw new Error("Invalid Base32 secret");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function counterBuffer(counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  return buffer;
}

export function generateTotpSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

export function generateTotpCode(
  secret,
  {
    timestamp = Date.now(),
    stepSeconds = TOTP_STEP_SECONDS,
    digits = TOTP_DIGITS,
  } = {},
) {
  const key = base32Decode(secret);
  const counter = Math.floor(timestamp / 1000 / stepSeconds);

  const digest = crypto
    .createHmac("sha1", key)
    .update(counterBuffer(counter))
    .digest();

  const offset = digest[digest.length - 1] & 0x0f;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function verifyTotpCode(
  secret,
  code,
  {
    timestamp = Date.now(),
    stepSeconds = TOTP_STEP_SECONDS,
    digits = TOTP_DIGITS,
    window = DEFAULT_WINDOW,
  } = {},
) {
  const normalizedCode = String(code || "").trim();

  if (!new RegExp(`^\\d{${digits}}$`).test(normalizedCode)) {
    return false;
  }

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secret, {
      timestamp: timestamp + offset * stepSeconds * 1000,
      stepSeconds,
      digits,
    });

    const actualBuffer = Buffer.from(normalizedCode);
    const expectedBuffer = Buffer.from(expected);

    if (
      actualBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return true;
    }
  }

  return false;
}

export function buildTotpUri({
  secret,
  accountName,
  issuer = "Royal Star Properties",
}) {
  if (!secret) {
    throw new Error("TOTP secret is required");
  }

  if (!accountName) {
    throw new Error("TOTP account name is required");
  }

  const label =
    encodeURIComponent(issuer) +
    ":" +
    encodeURIComponent(accountName);

  const params = new URLSearchParams({
    secret: normalizeBase32(secret),
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

export function createMfaEnrollment({
  accountName,
  issuer = "Royal Star Properties",
} = {}) {
  const secret = generateTotpSecret();

  return {
    secret,
    otpauthUrl: buildTotpUri({
      secret,
      accountName,
      issuer,
    }),
  };
}

export function hashRecoveryCode(code, pepper = "") {
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${String(code).trim()}`)
    .digest("hex");
}

export function generateRecoveryCodes({
  count = 10,
  pepper = "",
} = {}) {
  const codes = [];

  for (let index = 0; index < count; index += 1) {
    const raw = crypto.randomBytes(8).toString("hex").toUpperCase();

    const formatted =
      raw.slice(0, 4) +
      "-" +
      raw.slice(4, 8) +
      "-" +
      raw.slice(8, 12) +
      "-" +
      raw.slice(12, 16);

    codes.push({
      code: formatted,
      hash: hashRecoveryCode(formatted, pepper),
    });
  }

  return codes;
}

export function verifyRecoveryCode(
  candidate,
  storedHashes = [],
  pepper = "",
) {
  const candidateHash = hashRecoveryCode(candidate, pepper);

  for (const storedHash of storedHashes) {
    const candidateBuffer = Buffer.from(candidateHash);
    const storedBuffer = Buffer.from(String(storedHash));

    if (
      candidateBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(candidateBuffer, storedBuffer)
    ) {
      return true;
    }
  }

  return false;
}
