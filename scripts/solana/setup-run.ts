/** Provision only a dedicated test-network wallet. Existing keys and transactions are retained. */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  getUsdcBalance,
  mintMockUsdc,
  sendInstructions,
} from "@gridflex/solana";
import { client, cluster, config, keys } from "../../apps/api/src/env";
import { managedWallet } from "../../apps/api/src/wallets";
if (cluster !== "devnet" && cluster !== "localnet")
  throw new Error("Only test networks are supported.");
const operator = await managedWallet("run-operator");
const budget = BigInt(process.env.RUN_SPEND_LIMIT_BASE ?? "1000000000");
const balance = await getUsdcBalance(client, operator);
if (balance < budget)
  await mintMockUsdc(
    client,
    keys.deployer,
    keys.mintAuthority,
    operator,
    budget - balance,
  );
for (const owner of [operator, keys.verifier.address]) {
  const { value } = await client.rpc.getBalance(owner).send();
  // A full stress day creates many persistent commitment accounts, not just fees.
  const rentBudget = 1_000_000_000n;
  if (value < rentBudget)
    await sendInstructions(client, keys.deployer, [
      getTransferSolInstruction({
        source: keys.deployer,
        destination: owner,
        amount: rentBudget - value,
      }),
    ]);
}
const codeFile = path.join(config.dataDir, "presenter-code");
if (!existsSync(codeFile))
  writeFileSync(codeFile, randomBytes(18).toString("base64url") + "\n", {
    mode: 0o600,
  });
console.log(
  `Run operator funded on ${cluster}: ${operator}. Presenter code is stored in .data/presenter-code.`,
);
