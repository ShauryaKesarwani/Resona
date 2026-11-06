import { writeFile } from "node:fs/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const key = generatePrivateKey();
const account = privateKeyToAccount(key);
try {
  await writeFile(".env.arkiv", `# Testnet-only signer. Never share this file.\nARKIV_PRIVATE_KEY=${key}\nARKIV_ACCESS_KEY=\n`, { flag: "wx", mode: 0o600 });
  console.log(`Created .env.arkiv with a new testnet-only signer.\nPublic address: ${account.address}`);
  console.log("Fund this address on Rabdi and add your access key to .env.arkiv.");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EEXIST") {
    console.error(".env.arkiv already exists; it was not changed. Keep it to retain your signer.");
  } else {
    console.error("Could not create .env.arkiv. Check directory permissions.");
  }
  process.exitCode = 1;
}
