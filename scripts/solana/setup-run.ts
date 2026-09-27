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
const rentBudget = 1_000_000_000n;
const owners = [...new Set([operator, keys.verifier.address])];
const balances = await Promise.all(
  owners.map(async (owner) => ({
    owner,
    balance: (
      await client.rpc.getBalance(owner, { commitment: "confirmed" }).send()
    ).value,
  })),
);
const deployerBalance = (
  await client.rpc
    .getBalance(keys.deployer.address, { commitment: "confirmed" })
    .send()
).value;
const transfers = balances.reduce(
  (sum, item) =>
    sum +
    (item.owner !== keys.deployer.address && item.balance < rentBudget
      ? rentBudget - item.balance
      : 0n),
  0n,
);
const retained = owners.includes(keys.deployer.address) ? rentBudget : 0n;
const needed = transfers + retained + 10_000_000n;
if (deployerBalance < needed) {
  throw new Error(
    `Fund deployer ${keys.deployer.address} with at least ${(Number(needed - deployerBalance) / 1e9).toFixed(3)} additional ${cluster} SOL, then rerun. Existing wallets and keys are preserved.`,
  );
}
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
for (const owner of owners) {
  if (owner === keys.deployer.address) continue;
  const { value } = await client.rpc
    .getBalance(owner, { commitment: "confirmed" })
    .send();
  // A full stress day creates many persistent commitment accounts, not just fees.
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
