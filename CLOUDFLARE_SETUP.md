# Cloudflare setup

## Import the private GitHub repository

1. In Cloudflare, open **Workers & Pages**.
2. Select **Create application**.
3. Next to **Import a repository**, select **Get started**.
4. Connect GitHub and choose `chramabrahmamai/worldwisecomedystudio`.
5. Use these settings:
   - Worker name: `worldwise-comedy-studio`
   - Production branch: `main`
   - Build command: `pnpm build`
   - Deploy command: `npx wrangler deploy`
6. Select **Save and Deploy**.

## Add the Gemini key

After the first deployment:

1. Open **Workers & Pages** and select `worldwise-comedy-studio`.
2. Open **Settings**.
3. Under **Variables and Secrets**, select **Add**.
4. Select **Secret**.
5. Set the variable name to `GEMINI_API_KEY`.
6. Paste the Google AI Studio key as the value.
7. Select **Deploy**.

Never put the Gemini key in GitHub, `wrangler.jsonc`, or application source code.

The optional `GEMINI_MODEL` variable may be set to `gemini-3.1-flash-lite`. If it is omitted, the application uses that model automatically.
