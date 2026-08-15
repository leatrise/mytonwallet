# Yohi launch backend

Single-host deployment for the non-custodial TON launch profile. The backend never accepts seed phrases or private keys and never constructs or signs transactions.

## Deploy

1. In Cloudflare Zero Trust, create a remotely managed tunnel. Add public hostnames
   `wallet-api.yohi.io` and `wallet.yohi.io`, both with service URL `http://caddy:80`.
2. Copy `backend.env.example` to `/opt/yohi/secrets/backend.env`, set mode `0600`, and add provider credentials.
3. Create `/opt/yohi/secrets/cloudflared.env` with mode `0600` containing
   `TUNNEL_TOKEN=<token shown by Cloudflare>`.
4. Run `docker compose -f docker/compose.yml config`, then `docker compose -f docker/compose.yml up -d --build`.
5. Verify `https://wallet-api.yohi.io/healthz`, `https://wallet-api.yohi.io/readyz`,
   and `https://wallet.yohi.io/tos`.

The host publishes no application ports and needs no inbound 80/443 firewall rules.
`cloudflared` connects outbound to Cloudflare, while Caddy accepts HTTP only inside
the Docker `edge` network. TLS terminates at Cloudflare.

For local Android development, publish Caddy on port 8080 with the local override:

```sh
docker compose -f docker/compose.yml -f docker/compose.local.yml up -d --force-recreate caddy
```

Debug builds permit cleartext traffic. The emulator uses `http://10.0.2.2:8080`; a physical
device uses `http://<host-lan-ip>:8080`. Keep the production default `https://wallet-api.yohi.io`.

Recommended capacity is 4 vCPU and 8 GB RAM; 2 vCPU and 4 GB RAM is the minimum. Provider credentials remain server-side. Caddy access logs omit the URI, headers, request body, and full client IP.

## Content proxy

The Air SDK loads TON Connect manifests and off-chain token/NFT metadata through
`/proxy/download-json`. Whitelisted NFT animations use `/proxy/download-lottie`.
The backend accepts only HTTP(S) targets, rejects credentials and private or reserved
network addresses, revalidates redirects, pins the validated DNS result for the request,
and limits responses to 1 MiB for JSON and 2 MiB for Lottie data.

The Android Buy/Sell screens still require `/onramp-url` and `/offramp-url`. Those
partner-specific endpoints are not included in this launch backend and must remain
hidden until provider credentials and URL-signing rules are configured.

## Static assets

Put public images and other immutable files under `docker/backend-api/data/static`. They are copied into the backend image and served at `https://wallet-api.yohi.io/static/<relative-path>` with a one-year immutable cache. Use content-hashed filenames when replacing files, for example `tokens/yohi.a1b2c3.webp`, so clients do not retain an older image.

After adding or changing an asset, rebuild the backend image with `docker compose -f docker/compose.yml up -d --build backend-api`. Do not put secrets or user uploads in this directory; everything below `/static/` is public.

The official TON Connect bridge source is fixed to commit `bc97ab0a6d0d874a1e49344c6ae96252124fc923`. That release requires a Valkey cluster for persistent storage; this minimal single-host profile intentionally uses its in-memory mode. Pairing messages are temporary and are lost if the bridge container restarts. Move the bridge to the upstream clustered Valkey deployment before requiring restart-transparent pairing.
