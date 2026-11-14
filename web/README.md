# First Month web

The application lives here. See the root README for setup, checks, product scope, and research status.

This is a Vinext/React application with Cloudflare D1 storage. The hosting configuration is in `.openai/hosting.json`; generated artifacts are in the ignored `dist/` directory. Hosted migrations and local migrations are separate.

The development scripts and Vite integrations under `scripts/` provide the portable runtime and deployment build. Runtime credentials belong in ignored local environment files or in the hosting provider's secret configuration.
