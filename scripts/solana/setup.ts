// One-time setup per cluster: fund service keys, create the mock USDC mint,
// and initialize the program config. Safe to re-run.
import { address } from "@solana/kit";
import { fetchMaybeMint } from "@solana-program/token";
import { createMockUsdcMint, explorerUrl, initializeConfig } from "@gridflex/solana";
import { client, cluster, clusterEnvFile, ensureSol, loadKeys, rpcUrl, setEnvValue } from "./env";

const keys = await loadKeys();
const bootstrap = client(address("11111111111111111111111111111111"));

if (cluster === "localnet") await ensureSol(bootstrap, keys.deployer, keys.deployer.address, 100);
const { value: deployerLamports } = await bootstrap.rpc.getBalance(keys.deployer.address).send();
console.log(`Cluster ${cluster} (${rpcUrl})`);
console.log(`Deployer ${keys.deployer.address}: ${Number(deployerLamports) / 1e9} SOL`);
await ensureSol(bootstrap, keys.deployer, keys.verifier.address, cluster === "localnet" ? 10 : 0.5);
await ensureSol(bootstrap, keys.deployer, keys.mintAuthority.address, cluster === "localnet" ? 10 : 0.2);

let mint = process.env.USDC_MINT ? address(process.env.USDC_MINT) : null;
if (mint && !(await fetchMaybeMint(bootstrap.rpc, mint)).exists) mint = null;
if (!mint) {
  const created = await createMockUsdcMint(bootstrap, keys.deployer, keys.mintAuthority.address);
  mint = created.mint;
  setEnvValue(clusterEnvFile, "USDC_MINT", mint);
  console.log(`Created mock USDC mint ${mint} → saved to ${clusterEnvFile}`);
} else {
  console.log(`Using mock USDC mint ${mint}`);
}

const c = client(mint);
const signature = await initializeConfig(c, keys.deployer, keys.verifier.address);
console.log(
  signature
    ? `Initialized config (verifier ${keys.verifier.address}): ${explorerUrl("tx", signature, cluster, rpcUrl)}`
    : "Config already initialized",
);
