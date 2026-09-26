// Give a wallet mock USDC and a little SOL for fees. Devnet/localnet only.
//   npm run solana:faucet -- <wallet> [usdc=500]
import { address } from "@solana/kit";
import { formatUsdc, usdToBase } from "@gridflex/shared";
import { explorerUrl, getUsdcBalance, mintMockUsdc } from "@gridflex/solana";
import { client, cluster, ensureSol, loadKeys, requireMint, rpcUrl } from "./env";

if (cluster === "mainnet-beta") throw new Error("The faucet mints mock USDC and never runs on mainnet.");
const [wallet, amount = "500"] = process.argv.slice(2);
if (!wallet) throw new Error("Usage: npm run solana:faucet -- <wallet> [usdc]");

const keys = await loadKeys();
const c = client(requireMint());
const owner = address(wallet);
await ensureSol(c, keys.deployer, owner, cluster === "localnet" ? 2 : 0.05);
const signature = await mintMockUsdc(c, keys.deployer, keys.mintAuthority, owner, usdToBase(Number(amount)));
console.log(`Sent ${amount} mock USDC to ${owner}: ${explorerUrl("tx", signature, cluster, rpcUrl)}`);
console.log(`Balance: ${formatUsdc(await getUsdcBalance(c, owner))}`);
