import test from "node:test";
import assert from "node:assert/strict";

import {
  createMfaEnrollment,
  generateTotpCode,
  verifyTotpCode,
  generateRecoveryCodes,
  verifyRecoveryCode,
} from "./mfaService.js";

test("creates valid MFA enrollment", () => {
  const enrollment = createMfaEnrollment({
    accountName: "admin@royalstar",
  });

  assert.ok(enrollment.secret);
  assert.match(enrollment.otpauthUrl, /^otpauth:\/\/totp\//);
});

test("validates current TOTP code", () => {
  const enrollment = createMfaEnrollment({
    accountName: "admin@royalstar",
  });

  const timestamp = 1786200000000;

  const code = generateTotpCode(enrollment.secret, {
    timestamp,
  });

  assert.equal(
    verifyTotpCode(enrollment.secret, code, {
      timestamp,
    }),
    true,
  );
});

test("rejects invalid TOTP code", () => {
  const enrollment = createMfaEnrollment({
    accountName: "admin@royalstar",
  });

  assert.equal(
    verifyTotpCode(
      enrollment.secret,
      "000000",
      { timestamp: 1786200000000 },
    ),
    false,
  );
});

test("recovery codes verify without storing plaintext", () => {
  const recoveryCodes = generateRecoveryCodes({
    pepper: "test-pepper",
  });

  assert.equal(recoveryCodes.length, 10);

  const first = recoveryCodes[0];

  assert.equal(
    verifyRecoveryCode(
      first.code,
      recoveryCodes.map((entry) => entry.hash),
      "test-pepper",
    ),
    true,
  );
});
