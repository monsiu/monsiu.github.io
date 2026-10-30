# Monsiu contact Worker

Standalone Cloudflare Worker endpoint for the portfolio and services request forms. It validates the Cloudflare Turnstile token, allows only the portfolio origins, and sends a Monsiu-branded HTML and plain-text notification with the visitor's address set as Reply-To.

## Cloudflare setup

1. Make sure the sender domain is onboarded in Cloudflare Email Service and the sender address is authorized. Cloudflare Email Sending requires Cloudflare DNS for that domain.
2. Confirm `martinnzau679@gmail.com` as a permitted destination in Email Service. The binding is restricted to this recipient.
3. Install Wrangler, log in to the correct Cloudflare account, then set the Worker secrets/configuration:

   ```powershell
   npx wrangler secret put TURNSTILE_SECRET
   ```

   `EMAIL_FROM` is set in `wrangler.jsonc` to an address at the onboarded sender domain, currently `contact@clauseshift.com` in this account.
4. Deploy from this directory:

   ```powershell
   npx wrangler deploy
   ```

5. Add the deployed Worker URL to `contact-config.js` in the site root (the forms use this single endpoint).

The Turnstile secret is separate from the public site key already embedded in the forms. Keep it in Worker secrets only.
