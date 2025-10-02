const DatabaseManager = require('../config/database.cjs');
const LogService = require('./logService.cjs');

class DomainEmailService {
  constructor() {
    this.db = DatabaseManager.getInstance();
    this.logService = LogService.getInstance();
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
      status: row.status || 'pending',
      last_sync: row.last_sync || null,
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
         SET email_address = ?, email_provider = ?, client_id = ?, client_secret = ?, redirect_uri = ?, auth_url = ?, token_url = ?, scope = ?, updated_at = NOW()
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
          (id, domain_id, email_address, email_provider, client_id, client_secret, redirect_uri, auth_url, token_url, scope, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
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
          scope
        ]
      );
      this.logService.log('DOMAIN_EMAIL_CONNECTION_CREATED', 'Created domain email OAuth configuration', {
        domainId,
        connectionId,
        emailProvider
      });
    }

    const saved = await this.getConnectionById(connectionId);
    return this.sanitizeConnection(saved);
  }

  async deleteDomainConnection(connectionId, domainId) {
    const result = await this.db.query(
      `DELETE FROM domain_client_mail_map WHERE id = ? AND domain_id = ?`,
      [connectionId, domainId]
    );

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
}

module.exports = DomainEmailService;