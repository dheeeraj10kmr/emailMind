const crypto = require('crypto');
const axios = require('axios');

const DatabaseManager = require('../config/database.cjs');
const EmailProcessingService = require('./emailProcessingService.cjs');
const LogService = require('./logService.cjs');

class DomainEmailService {
  constructor() {
    this.db = DatabaseManager.getInstance();
    this.logService = LogService.getInstance();
    this.emailProcessingService = EmailProcessingService.getInstance();

    this.microsoftConfig = {
      tenantId: process.env.MS_GRAPH_TENANT_ID || 'common',
      clientId: process.env.MS_GRAPH_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MS_GRAPH_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: process.env.MS_GRAPH_REDIRECT_URI || process.env.MICROSOFT_REDIRECT_URI || '',
      scopes: (process.env.MS_GRAPH_SCOPES || process.env.MICROSOFT_SCOPES || 'offline_access openid profile https://graph.microsoft.com/.default')
        .split(/[ ,]+/)
        .filter(Boolean)
    };

    this.stateTtlMs = (parseInt(process.env.OAUTH_STATE_TTL_MINUTES, 10) || 15) * 60 * 1000;
    this.cleanupIntervalMs = 5 * 60 * 1000;
    this.lastCleanupAt = 0;
  }

  static getInstance() {
    if (!DomainEmailService.instance) {
      DomainEmailService.instance = new DomainEmailService();
    }
    return DomainEmailService.instance;
  }

  async buildAuthorizationUrl(options = {}) {
    await this.cleanupExpiredStates();

    const nonce = crypto.randomBytes(32).toString('hex');
    const provider = options.provider || 'microsoft_graph';
    const domainId = options.domainId || null;
    const redirectUri = options.redirectUri || this.microsoftConfig.redirectUri;

    const metadata = {
      ...(options.metadata || {}),
      redirectUri
    };

    await this.persistState({
      nonce,
      domainId,
      provider,
      metadata
    });

    const query = new URLSearchParams({
      client_id: this.microsoftConfig.clientId,
      response_type: 'code',
      response_mode: 'query',
      redirect_uri: redirectUri,
      scope: this.microsoftConfig.scopes.join(' '),
      state: nonce
    });

    const authorizationUrl = `https://login.microsoftonline.com/${this.microsoftConfig.tenantId}/oauth2/v2.0/authorize?${query.toString()}`;

    this.logService.log('OAUTH_AUTHORIZATION_URL', 'Generated Microsoft authorization URL', {
      provider,
      domainId,
      redirectUri,
      nonce
    });

    return {
      authorizationUrl,
      nonce
    };
  }

  async persistState({ nonce, domainId, provider, metadata }) {
    const expiresAt = new Date(Date.now() + this.stateTtlMs);

    await this.db.query(`
      INSERT INTO oauth_states (nonce, domain_id, provider, metadata, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      nonce,
      domainId,
      provider,
      JSON.stringify(metadata || {}),
      expiresAt
    ]);

    this.logService.log('OAUTH_STATE_STORED', 'Stored OAuth state for authorization flow', {
      nonce,
      provider,
      domainId,
      expiresAt
    });
  }

  async cleanupExpiredStates(force = false) {
    const now = Date.now();
    if (!force && now - this.lastCleanupAt < this.cleanupIntervalMs) {
      return;
    }

    this.lastCleanupAt = now;

    const result = await this.db.query(
      'DELETE FROM oauth_states WHERE expires_at < NOW()',
      []
    );

    const removed = result.rows?.affectedRows || 0;
    if (removed > 0) {
      this.logService.log('OAUTH_STATE_CLEANUP', 'Removed expired OAuth states', {
        removed
      });
    }
  }

  async consumeNonce(nonce) {
    if (!nonce) {
      throw new Error('Missing OAuth state parameter');
    }

    await this.cleanupExpiredStates();

    const result = await this.db.query(
      'SELECT nonce, domain_id, provider, metadata, expires_at, used_at FROM oauth_states WHERE nonce = ?',
      [nonce]
    );

    if (!result.rows || result.rows.length === 0) {
      this.logService.log('OAUTH_STATE_NOT_FOUND', 'OAuth state not found during callback', { nonce });
      throw new Error('OAuth state not found or expired');
    }

    const record = result.rows[0];
    const expiresAt = new Date(record.expires_at);
    if (record.used_at) {
      this.logService.log('OAUTH_STATE_ALREADY_USED', 'OAuth state already used', {
        nonce,
        provider: record.provider,
        domainId: record.domain_id
      });
      throw new Error('OAuth state already used');
    }

    if (expiresAt.getTime() < Date.now()) {
      await this.db.query('DELETE FROM oauth_states WHERE nonce = ?', [nonce]);
      this.logService.log('OAUTH_STATE_EXPIRED', 'OAuth state expired prior to callback validation', {
        nonce,
        provider: record.provider,
        domainId: record.domain_id
      });
      throw new Error('OAuth state has expired');
    }

    await this.db.query(
      'UPDATE oauth_states SET used_at = NOW() WHERE nonce = ?',
      [nonce]
    );

    const metadata = this.safeParseMetadata(record.metadata);

    this.logService.log('OAUTH_STATE_VALID', 'OAuth state validated successfully', {
      nonce,
      provider: record.provider,
      domainId: record.domain_id
    });

    return {
      nonce,
      domainId: record.domain_id,
      provider: record.provider,
      metadata,
      expiresAt
    };
  }

  async finalizeNonce(nonce) {
    if (!nonce) {
      return;
    }

    await this.db.query('DELETE FROM oauth_states WHERE nonce = ?', [nonce]);

    this.logService.log('OAUTH_STATE_FINALIZED', 'OAuth state record removed after completion', {
      nonce
    });
  }

  safeParseMetadata(rawMetadata) {
    if (!rawMetadata) {
      return {};
    }

    try {
      return JSON.parse(rawMetadata);
    } catch (error) {
      this.logService.log('OAUTH_STATE_METADATA_PARSE_ERROR', 'Failed to parse OAuth state metadata', {
        error: error.message
      });
      return {};
    }
  }

  async exchangeAuthorizationCode(code, context) {
    if (!code) {
      throw new Error('Missing authorization code');
    }

    const redirectUri = context?.metadata?.redirectUri || this.microsoftConfig.redirectUri;

    const body = new URLSearchParams({
      client_id: this.microsoftConfig.clientId,
      scope: this.microsoftConfig.scopes.join(' '),
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    if (this.microsoftConfig.clientSecret) {
      body.append('client_secret', this.microsoftConfig.clientSecret);
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${this.microsoftConfig.tenantId}/oauth2/v2.0/token`;

    try {
      const response = await axios.post(tokenEndpoint, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens = response.data;
      await this.persistTokens(tokens, context);

      this.logService.log('OAUTH_TOKEN_RECEIVED', 'Received tokens from Microsoft Graph', {
        provider: context?.provider,
        domainId: context?.domainId,
        connectionId: context?.metadata?.connectionId || null
      });

      return tokens;
    } catch (error) {
      const errorData = error.response?.data || {};
      this.logService.log('OAUTH_TOKEN_ERROR', 'Failed to exchange authorization code for tokens', {
        error: error.message,
        provider: context?.provider,
        domainId: context?.domainId,
        details: errorData
      });
      throw new Error(errorData.error_description || error.message || 'Failed to exchange authorization code');
    }
  }

  async persistTokens(tokens, context) {
    if (!tokens || !context) {
      return;
    }

    const connectionId = context.metadata?.connectionId;
    if (!connectionId) {
      this.logService.log('OAUTH_TOKEN_NO_CONNECTION', 'OAuth tokens received without connection context', {
        provider: context.provider,
        domainId: context.domainId
      });
      return;
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      throw new Error('Missing access token in response');
    }

    const encryptedAccessToken = this.emailProcessingService.encryptCredentials(accessToken);
    const encryptedRefreshToken = refreshToken
      ? this.emailProcessingService.encryptCredentials(refreshToken)
      : null;

    if (!encryptedAccessToken) {
      throw new Error('Failed to encrypt access token');
    }

    await this.db.query(`
      UPDATE email_connections
      SET access_token_encrypted = ?,
          refresh_token_encrypted = ?,
          status = 'connected',
          last_sync = NOW()
      WHERE id = ?
    `, [
      encryptedAccessToken,
      encryptedRefreshToken,
      connectionId
    ]);

    this.logService.log('OAUTH_TOKENS_STORED', 'OAuth tokens stored for email connection', {
      connectionId,
      provider: context.provider,
      domainId: context.domainId
    });
  }
}

module.exports = DomainEmailService;
