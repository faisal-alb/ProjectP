# Deploy GridFlex with Dokploy

This stack runs the Next.js web app, Node API and internal Python intelligence
service. It is a **single-instance devnet demo**: verification uses simulated
meter data and API market actions are public. Rate limits bound requests; they
are not operator authorization. Production containers refuse mainnet. Do not
fund these service wallets with real assets or scale the API/web horizontally.

## Prepare Solana and models

Follow [Solana settlement](solana.md) to deploy the program and create the mock
USDC mint on devnet. Keep the generated `USDC_MINT` and these three keypair files:

- `deployer.keypair.json`: pays transaction fees and funds the demo faucet.
- `verifier.keypair.json`: must match the verifier configured on-chain.
- `mint-authority.keypair.json`: must control the mock USDC mint.

Fund the deployer and verifier with devnet SOL. The container does not run setup,
deploy the Solana program, or create a mint. Use a devnet RPC provider suitable
for the expected traffic. `/health` checks application startup, not RPC funding
or the program's availability; complete a demo settlement to verify those.

Optionally run `npm run intelligence:setup` and `npm run ml:train` as described in
[Intelligence service](intelligence.md). Copy the contents of `ml/artifacts/` to
the deployment's `files/models/`. Without artifacts, the service deliberately
reports placeholder models. Only load trusted artifacts: model deserialization
can execute code.

## Configure Dokploy

1. Create a Docker Compose service connected to this repository and the branch
   containing these changes (`deploy-dokploy`, or `main` after merging). Choose
   **Compose**, not Swarm Stack, and `docker-compose.yml` as the compose path.
2. Paste `.env.deploy.example` into the Environment tab and replace its values.
   Use the same HTTPS web origin for `WEB_ORIGIN` and `BETTER_AUTH_URL`, without
   a trailing slash. Set `NEXT_PUBLIC_API_URL` to the API's HTTPS origin.
3. Generate independent secrets with `openssl rand -base64 32` for
   `BETTER_AUTH_SECRET` and `WALLET_ENCRYPTION_KEY`. Preserve the latter with the
   wallet data: changing it makes existing encrypted wallet seeds unreadable.
   Set the real devnet `USDC_MINT`. Mapbox and ElevenLabs settings are optional.
4. Provision the sibling `files/` directory next to Dokploy's repository checkout:

   ```text
   files/
     keys/deployer.keypair.json
     keys/verifier.keypair.json
     keys/mint-authority.keypair.json
     api-data/
     web-data/
     models/
   ```

   Transfer the keypairs securely, restrict host access, and never commit them.
   Dokploy File Mounts can provision them too; ensure they land at the paths above.
   Keep `FILES_DIR=../files` in Dokploy. State directories must be writable by the
   containers; keys and models are mounted read-only. Do not copy local wallet
   state unless you also use the exact encryption key that encrypted it.
5. Add two HTTPS domains in Domains: web → service `web`, container port `3000`;
   API → service `api`, container port `8787`. Leave intelligence internal. Deploy
   after configuring domains. The base Compose file publishes no host ports.
6. Check deployment logs and container health, then open the web app and API
   `/health`. Confirm the intended cluster/mint and `intelligence: "online"`.
   Inspect the intelligence `/health` from inside its container for model sources.

Dokploy injects routing labels for configured domains. This follows its official
[Compose configuration and persistence guidance](https://docs.dokploy.com/docs/core/docker-compose)
and [domain configuration](https://docs.dokploy.com/docs/core/docker-compose/domains).
The `../files` mounts survive checkout replacement; arrange your own backups for
these bind mounts.

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_MAPBOX_TOKEN` are build arguments, so changing
them requires rebuilding web. Server secrets are runtime environment values and
are excluded from the Docker build context. The web build uses a disposable auth
secret and discards its temporary session database.

## Build and run locally

Docker Desktop (or another local Docker engine) and Docker Compose are required.
From the repository root:

```sh
cp .env.deploy.example .env.deploy
mkdir -p .data/compose/keys .data/compose/api-data .data/compose/web-data .data/compose/models
```

Edit `.env.deploy` with `FILES_DIR=./.data/compose`,
`WEB_ORIGIN=http://localhost:3000`, `BETTER_AUTH_URL=http://localhost:3000`, and
`NEXT_PUBLIC_API_URL=http://localhost:8787`. Generate both secrets, set your devnet
mint, and copy the three devnet keypairs into `.data/compose/keys/`. Copy trained
artifacts to `.data/compose/models/` if desired. These local files are ignored by
Git and Docker. Do not copy a production database into this test stack.

```sh
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.local.yml config --quiet
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.local.yml up --build -d --wait --wait-timeout 180
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.local.yml ps
curl --fail http://localhost:8787/health
curl --fail http://localhost:8787/forecast/downtown
curl --fail http://localhost:3000/ -o /dev/null
```

The local override binds only loopback ports and disables forwarded-header trust.
Ensure ports 3000 and 8787 are free. Sign in anonymously through onboarding, then
exercise the devnet operator flow (faucet → create/sign → verify → settle) and
confirm the household payout. Refresh and restart the containers to verify state
and sessions persist. A health-only smoke test with unfunded throwaway keys does
not validate blockchain settlement.

```sh
npm run test:deployment
npm run typecheck -w @gridflex/api
npm run lint -w web
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.local.yml down
```

## Operations and limits

- Run one API instance and one web instance. JSON persistence, SQLite sessions,
  per-market locks and rate limits are local to each process. The faucet allows
  3 calls per client/hour and 30 total/hour; market creation allows 10/client and
  60 total; lifecycle updates allow 60/client and 300 total. Restart resets limits.
- `TRUST_PROXY=1` assumes exactly one trusted Traefik hop appending the actual peer
  IP to `X-Forwarded-For`. Keep direct API ports closed. If adding a CDN or another
  proxy, review the trust chain; global limits still apply to all callers.
- Wallet and market snapshots use atomic file replacement; this prevents partial
  JSON after a process crash, but is not a transactional database or a guarantee
  against power loss. Stop API/web before copying their state for backups.
- Back up `files/api-data`, `files/web-data`, keypairs, environment secrets and
  models together to restricted storage. Test restoration with the same wallet
  encryption key. Losing the key loses access to encrypted managed wallets.
- Before updating, take a consistent backup and record the deployed Git commit.
  Roll back by deploying that revision; if data formats changed, restore its
  matching backup too. Never reset volumes to troubleshoot startup.
- Missing keypairs/mint/secrets fail API startup. Check mount paths and environment
  first. Placeholder forecasts mean missing/incompatible model artifacts. A healthy
  web process does not prove voice credentials or Solana settlement are working.

## Validation status (2026-09-27)

Validated locally on Linux ARM64 containers through Docker Desktop:

- All three images build and all three Compose services become healthy.
- API health redacts the RPC URL; the intelligence forecast returns explicit
  placeholders when no trained models are mounted.
- The web page and anonymous sign-in work; unauthenticated voice requests fail.
- Faucet limits return 429 with Retry-After; oversized requests return 413.
- The managed-wallet snapshot and authenticated session survive container restart.
- API typecheck, web lint, web production build, Compose configuration validation
  and the three deployment regression tests pass.

The builds caught missing SQLite compilation tools and missing cross-platform
native dependencies in the npm lockfile; both are fixed. Existing locked package
versions are preserved. The smoke test used isolated, unfunded keys and placeholder
models. Live devnet settlement, trained model artifacts, ElevenLabs and public
Dokploy HTTPS routing still require the deployment-specific checks above.
