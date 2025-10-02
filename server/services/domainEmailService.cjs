const DatabaseManager = require('../config/database.cjs');
const LogService = require('./logService.cjs');
const CryptoUtils = require('./cryptoUtils.cjs');

class DomainEmailService {
  constructor() {
    this.db = DatabaseManager.getInstance();
    this.logService = LogService.getInstance();
    this.cryptoUtils = CryptoUtils;
  }

  static getInstance() {
    if (!DomainEmailService.instance) {
      DomainEmailService.instance = new DomainEmailService();
    }
    return DomainEmailService.instance;
  }

  mapDomainConnection(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      domain_id: row.domain_id,
      email_address: row.email_address,
      email_provider: row.email_provider,
      client_id: row.client_id,
      redirect_uri: row.redirect_uri,
      auth_url: row.auth_url,
      token_url: row.token_url,
      scope: row.scope,
      status: row.status || 'pending_oauth',
      last_sync: row.last_sync || null,
      token_expires_at: row.token_expires_at ? new Date(row.token_expires_at).toISOString() : null,
      token_scope: row.token_scope || row.scope || null,
      token_type: row.token_type || null,
      error_message: row.error_message || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  sanitizeConnection(row) {
    if (!row) {
      return null;
    }
    return this.mapDomainConnection(row);
  }

  async getConnectionsForDomain(domainId) {
    const result = await this.db.query(
      `SELECT * FROM domain_client_mail_map WHERE domain_id = ? ORDER BY created_at DESC`,
      [domainId]
    );
    return result.rows.map((row) => this.sanitizeConnection(row));
  }

  async getConnectionById(id) {
    const result = await this.db.query(
      `SELECT * FROM domain_client_mail_map WHERE id = ? LIMIT 1`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getSanitizedConnectionById(id) {
    const connection = await this.getConnectionById(id);
    return this.sanitizeConnection(connection);
  }

  async saveDomainConnection(connectionData) {
    const {
      id,
      domainId,
      emailAddress,
      emailProvider,
      clientId,
      clientSecret,
      redirectUri,
      authUrl,
      tokenUrl,
      scope
    } = connectionData;

    const existing = await this.db.query(
      `SELECT * FROM domain_client_mail_map WHERE id = ? OR (domain_id = ? AND email_provider = ? AND email_address = ?) LIMIT 1`,
      [id || null, domainId, emailProvider, emailAddress]
    );

    let connectionId = id;
     if (existing.rows.length > 0) {
      const existingRow = existing.rows[0];
      connectionId = existingRow.id;
      await this.db.query(
        `UPDATE domain_client_mail_map
         SET email_address = ?, email_provider = ?, client_id = ?, client_secret = ?, redirect_uri = ?, auth_url = ?, token_url = ?, scope = ?, token_scope = ?, status = 'pending_oauth', access_token_encrypted = NULL, refresh_token_encrypted = NULL, token_expires_at = NULL, token_type = NULL, error_message = NULL, last_sync = NULL, updated_at = NOW()
         WHERE id = ?`,
        [
          emailAddress,
          emailProvider,
          clientId,
          clientSecret,
          redirectUri,
          authUrl,
          tokenUrl,
          scope,
          scope,
          connectionId
        ]
      );
      this.logService.log('DOMAIN_EMAIL_CONNECTION_UPDATED', 'Updated domain email OAuth configuration', {
        domainId,
        connectionId,
        emailProvider
      });
    } else {
      connectionId = connectionId || this.db.generateUUID();
      await this.db.query(
        `INSERT INTO domain_client_mail_map
          (id, domain_id, email_address, email_provider, client_id, client_secret, redirect_uri, auth_url, token_url, scope, token_scope, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_oauth', NOW(), NOW())`,
        [
          connectionId,
          domainId,
          emailAddress,
          emailProvider,
          clientId,
          clientSecret,
          redirectUri,
          authUrl,
          tokenUrl,
          scope,
          scope
        ]
      );
      this.logService.log('DOMAIN_EMAIL_CONNECTION_CREATED', 'Created domain email OAuth configuration', {
        domainId,
        connectionId,
        emailProvider
      });
    }

    return this.getSanitizedConnectionById(connectionId);
  }

  async deleteDomainConnection(connectionId, domainId) {
    const existing = await this.getConnectionById(connectionId);
    const result = await this.db.query(
      `DELETE FROM domain_client_mail_map WHERE id = ? AND domain_id = ?`,
      [connectionId, domainId]
    );

    if (existing) {
      await this.db.query(
        `DELETE FROM email_connections WHERE domain_connection_id = ? OR (domain_id = ? AND email_address = ?)`,
        [connectionId, existing.domain_id, existing.email_address]
      );
    }

    this.logService.log('DOMAIN_EMAIL_CONNECTION_DELETED', 'Deleted domain email OAuth configuration', {
      domainId,
      connectionId
    });

    return result;
  }

  buildAuthorizationUrl(connection, state) {
    const base = connection.auth_url;
    if (!base) {
      throw new Error('Authorization URL is not configured for this connection');
    }

    const url = new URL(base);
    url.searchParams.set('client_id', connection.client_id);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', connection.redirect_uri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', connection.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'consent');

    return url.toString();
  }

  async updateOAuthTokens(connectionId, tokenData) {
    const {
      accessToken,
      refreshToken,
      expiresIn,
      expiresAt,
      scope,
      tokenType
    } = tokenData;

    const encryptedAccess = accessToken ? this.cryptoUtils.encryptString(accessToken) : null;
    const encryptedRefresh = refreshToken ? this.cryptoUtils.encryptString(refreshToken) : null;
    const expiryDate = expiresAt
      ? new Date(expiresAt)
      : expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : null;

    await this.db.query(
      `UPDATE domain_client_mail_map
       SET access_token_encrypted = ?,
           refresh_token_encrypted = ?,
           token_expires_at = ?,
           token_scope = COALESCE(?, token_scope, scope),
           token_type = ?,
           status = 'connected',
           error_message = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [
        encryptedAccess,
        encryptedRefresh,
        expiryDate,
        scope || null,
        tokenType || 'Bearer',
        connectionId
      ]
    );

    await this.syncConnectionToEmailTable(connectionId);

    this.logService.log('OAUTH_OUTLOOK_CALLBACK_SUCCESS', 'Stored Outlook OAuth tokens', {
      connectionId,
      hasRefreshToken: Boolean(refreshToken)
    });
  }

  async syncConnectionToEmailTable(connectionId) {
    const connection = await this.getConnectionById(connectionId);
    if (!connection || !connection.access_token_encrypted) {
      return null;
    }

    let userId = null;
    const adminResult = await this.db.query(
      `SELECT id FROM users WHERE domain_id = ? AND role = 'client_admin' AND is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
      [connection.domain_id]
    );

    if (adminResult.rows.length > 0) {
      userId = adminResult.rows[0].id;
    } else {
      const fallback = await this.db.query(
        `SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at ASC LIMIT 1`
      );
      if (fallback.rows.length > 0) {
        userId = fallback.rows[0].id;
      }
    }

    if (!userId) {
      throw new Error('No user available to associate OAuth email connection');
    }

    const tokenExpiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
    const existing = await this.db.query(
      `SELECT id FROM email_connections WHERE domain_connection_id = ? LIMIT 1`,
      [connectionId]
    );

    if (existing.rows.length > 0) {
      const emailConnectionId = existing.rows[0].id;
      await this.db.query(
        `UPDATE email_connections
         SET user_id = ?,
             domain_id = ?,
             email_address = ?,
             provider = ?,
             access_token_encrypted = ?,
             refresh_token_encrypted = ?,
             status = 'connected',
             token_expires_at = ?,
             token_type = ?,
             token_scope = ?,
             domain_connection_id = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          userId,
          connection.domain_id,
          connection.email_address,
          connection.email_provider || 'outlook',
          connection.access_token_encrypted,
          connection.refresh_token_encrypted,
          tokenExpiresAt,
          connection.token_type || 'Bearer',
          connection.token_scope || connection.scope || null,
          connection.id,
          emailConnectionId
        ]
      );
      return emailConnectionId;
    }

    const newConnectionId = this.db.generateUUID();
    await this.db.query(
      `INSERT INTO email_connections
        (id, user_id, domain_id, email_address, provider, access_token_encrypted, refresh_token_encrypted, status, token_expires_at, token_type, token_scope, domain_connection_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?, NOW(), NOW())`,
      [
        newConnectionId,
        userId,
        connection.domain_id,
        connection.email_address,
        connection.email_provider || 'outlook',
        connection.access_token_encrypted,
        connection.refresh_token_encrypted,
        tokenExpiresAt,
        connection.token_type || 'Bearer',
        connection.token_scope || connection.scope || null,
        connection.id
      ]
    );

    return newConnectionId;
  }

  async markConnectionError(connectionId, message) {
    await this.db.query(
      `UPDATE domain_client_mail_map
       SET status = 'error', error_message = ?, updated_at = NOW()
       WHERE id = ?`,
      [message, connectionId]
    );

    await this.db.query(
      `UPDATE email_connections SET status = 'error', updated_at = NOW() WHERE domain_connection_id = ?`,
      [connectionId]
    );

    this.logService.log('DOMAIN_EMAIL_CONNECTION_ERROR', 'Domain email OAuth connection error recorded', {
      connectionId,
      message
    });
  }
}

module.exports = DomainEmailService;