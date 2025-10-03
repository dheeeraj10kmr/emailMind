// server/services/tokenService.js
import axios from "axios";
import db from "../db.js"; // <-- adapt to your DB layer

// Exchange authorization code for access + refresh tokens
export async function exchangeCodeForToken(domainConfig, code) {
  const params = new URLSearchParams();
  params.append("client_id", domainConfig.client_id);
  params.append("client_secret", domainConfig.client_secret);
  params.append("code", code);
  params.append("redirect_uri", domainConfig.redirect_uri);
  params.append("grant_type", "authorization_code");

  const res = await axios.post(domainConfig.token_url, params);
  const tokens = res.data;

  // Save in DB (encrypt if possible)
  await db.tokens.upsert({
    domainId: domainConfig.domainId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  });

  return tokens;
}

// Refresh expired access token
export async function refreshAccessToken(domainConfig, refreshToken) {
  const params = new URLSearchParams();
  params.append("client_id", domainConfig.client_id);
  params.append("client_secret", domainConfig.client_secret);
  params.append("refresh_token", refreshToken);
  params.append("grant_type", "refresh_token");
  params.append("redirect_uri", domainConfig.redirect_uri);

  const res = await axios.post(domainConfig.token_url, params);
  const tokens = res.data;

  await db.tokens.update(
    { domainId: domainConfig.domainId },
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    }
  );

  return tokens;
}
