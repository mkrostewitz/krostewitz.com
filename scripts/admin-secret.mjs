import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(buffer) {
  let bits = "";
  let value = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index + 5 <= bits.length; index += 5) {
    value += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5), 2)];
  }

  return value;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const keylen = 64;
  const cost = 16384;
  const digest = "sha512";
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, {N: cost}, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("base64url"));
    });
  });

  return `scrypt$${keylen}$${cost}$${salt}$${key}$${digest}`;
}

const command = process.argv[2];
const value = process.argv[3];

if (command === "session") {
  console.log(crypto.randomBytes(32).toString("base64url"));
} else if (command === "totp") {
  console.log(toBase32(crypto.randomBytes(20)));
} else if (command === "password-hash" && value) {
  console.log(await hashPassword(value));
} else {
  console.error(
    "Usage: npm run admin:secret -- session | totp | password-hash <password>"
  );
  process.exit(1);
}
