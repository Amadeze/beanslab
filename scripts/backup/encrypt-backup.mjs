#!/usr/bin/env node
// Cross-platform equivalent of `openssl enc -aes-256-cbc -pbkdf2 -iter 250000 -salt`.
//
// Usage:
//   node scripts/backup/encrypt-backup.mjs <in> <out> <passphrase>          # encrypt
//   node scripts/backup/encrypt-backup.mjs --decrypt <in> <out> <passphrase> # decrypt
//
// The output is byte-compatible with `openssl enc -aes-256-cbc -pbkdf2 -iter 250000 -salt`
// (the "Salted__" magic + 8-byte salt + ciphertext format), so artifacts can be
// round-tripped between this script and a real openssl binary on Linux/macOS CI
// runners.
//
// Written because Windows does not ship an openssl binary by default and the
// project needs to run the recovery drill locally.
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";

const args = process.argv.slice(2);
const decrypt = args[0] === "--decrypt";
const positional = decrypt ? args.slice(1) : args;
const [input, output, passphrase] = positional;

if (!input || !output || !passphrase) {
  console.error("usage: encrypt-backup.mjs [--decrypt] <in> <out> <passphrase>");
  process.exit(2);
}
if (!decrypt && passphrase.length < 24) {
  console.error("passphrase must contain at least 24 characters");
  process.exit(1);
}
const iterations = 250000;
const magic = "Salted__";
const saltLen = 8;

if (decrypt) {
  const buf = readFileSync(input);
  if (buf.subarray(0, 8).toString("ascii") !== magic) {
    console.error(`unexpected header; expected '${magic}'`);
    process.exit(1);
  }
  const salt = buf.subarray(8, 8 + saltLen);
  const ciphertext = buf.subarray(8 + saltLen);
  const dk = pbkdf2Sync(passphrase, salt, iterations, 48, "sha256");
  const decipher = createDecipheriv("aes-256-cbc", dk.subarray(0, 32), dk.subarray(32, 48));
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  writeFileSync(output, plain);
  console.log(`decrypted ${statSync(input).size} -> ${statSync(output).size} bytes`);
} else {
  const salt = randomBytes(saltLen);
  const dk = pbkdf2Sync(passphrase, salt, iterations, 48, "sha256");
  const cipher = createCipheriv("aes-256-cbc", dk.subarray(0, 32), dk.subarray(32, 48));
  const encrypted = Buffer.concat([cipher.update(readFileSync(input)), cipher.final()]);
  const out = Buffer.concat([Buffer.from(magic), salt, encrypted]);
  writeFileSync(output, out);
  const sha = createHash("sha256").update(readFileSync(output)).digest("hex");
  writeFileSync(`${output}.sha256`, `${sha}  ${output}\n`);
  console.log(`encrypted ${statSync(input).size} -> ${statSync(output).size} bytes`);
  console.log(`sha256: ${sha}`);
}
