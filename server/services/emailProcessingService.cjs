// file: server/services/emailProcessingService.cjs
const { ImapFlow } = require('imapflow');
const DatabaseManager = require('../config/database.cjs');
const LogService = require('./logService.cjs');
const ConfigService = require('./configService.cjs'); // NEW
const DomainEmailService = require('./domainEmailService.cjs');
const CryptoUtils = require('./cryptoUtils.cjs');
const crypto = require('crypto'); 
const axios = require('axios'); 

class EmailProcessingService {
  constructor() {
    this.logService = LogService.getInstance();
    this.domainEmailService = DomainEmailService.getInstance();
    this.configService = ConfigService.getInstance(); // NEW
    this.isProcessing = false;
    this.processingInterval = null;
    this._legacyOutlookConfig = {}; // Back-compat store for global Outlook config
    this.logisticsKeywords = [
      'order', 'orders', 'shipment', 'transport order', 'transport', 'delivery', 
      'delivery orders', 'delivery order', 'location', 'pickup location', 
      'delivery location', 'time', 'date', 'pickup date', 'delivery date', 
      'order weight', 'weight', 'count of orders', 'freight', 'cargo', 
      'consignment', 'bill of lading', 'manifest', 'warehouse', 'dispatch',
      'logistics', 'supply chain', 'distribution', 'fulfillment', 'tracking',
      'route', 'vehicle', 'driver', 'carrier', 'shipper', 'consignee'
    ];

this.extractionKeywords = {
      customerOrderNumber: [
        'order number', 'order no', 'order id', 'order reference', 'order ref', 'order code',
        'order #', 'order identifier', 'order confirmation number', 'order tracking number',
        'ord no', 'ord num', 'ord id', 'ord ref', 'ord #', 'o/n', 'o#', 'ref no', 'ref id',
        'purchase number', 'purchase id', 'transaction id', 'confirmation number',
        'booking number', 'invoice number', 'shipment id', 'delivery number', 'tracking id',
        'tracking number', 'dispatch id', 'fulfilment order number', 'fulfillment order number',
        'reference number', 'case id', 'ticket number', 'customer reference', 'your reference',
        'our reference', 'bestelnummer', 'ordernummer', 'klantnummer', 'referentienummer',
        'factuurnummer', 'boekingsnummer', 'volgnummer', 'ordernr', 'bestel nr', 'bestel-nr',
        'order nr', 'ordernr.', 'ref.nr', 'refnr', 'referentie', 'uw referentie', 'onze referentie',
        'afleveringsnummer', 'verzendnummer', 'leveringsnummer', 'pakbonnummer', 'trackingnummer',
        'zendingnummer', 'dossiernummer', 'ticketnummer', 'zaaknummer'
      ],
      pickupLocationName: [
        'pickup location', 'pickup point', 'collection point', 'collection location',
        'pickup address', 'collection address', 'pick-up location', 'pick up location',
        'pick-up point', 'pickup site', 'pickup store', 'pickup shop', 'pickup depot',
        'pickup branch', 'pickup outlet', 'collection center', 'collection hub', 'pickup hub',
        'pickup station', 'pickup locker', 'parcel locker', 'drop-off point', 'pickup parcel shop',
        'pickup service point', 'pickup kiosk', 'store pickup', 'click and collect',
        'in-store pickup', 'pickup counter', 'customer collection area', 'pickup desk',
        'pickup window', 'pickup location name', 'service point name', 'pickup branch name',
        'parcel shop name', 'collection point name', 'pickup site name', 'fhaallocatie',
        'afhaalpunt', 'afhaaladres', 'afhaalplaats', 'ophaalpunt', 'ophaalplaats', 'ophaaladres',
        'collectiepunt', 'afhaalbalie', 'afhaal loc', 'ophaal loc', 'afhaal-locatie',
        'ophaal-locatie', 'afhaalcentrum', 'ophaalcentrum', 'afhaalhub', 'ophaalhub',
        'pakketautomaat', 'winkelafhaling', 'afhalen in winkel', 'afhaalwinkel', 'afhaalservice',
        'klantenbalie', 'vestiging', 'filiaal', 'punt', 'balie', 'centrum', 'gebouw'
      ],
      pickupLocationPostalCode: [
        'pickup postal code', 'pickup postcode', 'pickup zip code', 'collection postcode',
        'pickup location postal code', 'pickup location zip', 'pickup zip', 'pickup postal',
        'collection zip', 'collection code', 'afhaalpostcode', 'ophaalpostcode',
        'afhaal postnummer', 'ophaal postnummer', 'afhaallocatie postcode',
        'afhaalpunt postcode', 'ophaalpunt postcode', 'collectiepunt postcode'
      ],
      pickupDate: [
        'pickup date', 'pick-up date', 'collection date', 'collect date', 'pickup day',
        'collection day', 'afhaaldatum', 'ophaalmoment', 'collectiedatum', 'ophaaldatum'
      ],
      pickupContact: [
        'pickup contact', 'collection contact', 'pickup contact person', 'contact person',
        'contactpersoon', 'pickup phone', 'pickup contact name', 'collection contact name',
        'pickup contact details', 'pickup telephone'
      ],
      pickupLocationAddress: [
        'pickup address', 'pickup location address', 'pickup street', 'pickup address line',
        'collection address', 'pickup site address', 'pickup street address',
        'pickup location line', 'pickup full address', 'afhaaladres', 'ophaaladres',
        'afhaallocatie adres', 'afhaaladreslijn', 'afhaal straat', 'ophaal straat',
        'afhaal locatie', 'afhaalplaats adres', 'collectieadres', 'afhaaladres volledig'
      ],
      pickupLocationCity: [
        'pickup city', 'collection city', 'pickup town', 'collection town', 'pickup municipality',
        'collection municipality', 'afhaalstad', 'ophaalstad', 'afhaalplaats', 'ophaalplaats stad'
      ],
      pickupLocationState: [
        'pickup state', 'pickup province', 'pickup region', 'collection province',
        'collection region', 'afhaal provincie', 'afhaalregio', 'ophaal provincie', 'ophaalregio'
      ],
      pickupLocationCountryCode: [
        'pickup country', 'pickup country code', 'pickup location country', 'pickup nation',
        'collection country', 'pickup location country code', 'pickup country iso code',
        'afhaal land', 'afhaallandcode', 'afhaallocatie land', 'afhaallocatie landcode',
        'ophaalland', 'ophaallandcode', 'afhaal land code', 'collectie land', 'collectie landcode'
      ],
      deliveryLocationName: [
        'delivery location name', 'delivery name', 'recipient name', 'delivery point name',
        'delivery contact name', 'delivery branch name', 'delivery store name',
        'delivery depot name', 'delivery address name', 'leverlocatie naam',
        'afleverlocatie naam', 'leveringslocatie naam', 'afleverpunt naam', 'ontvanger naam',
        'bezorgpunt naam', 'leveringspunt naam', 'afgiftepunt naam', 'afleveradres naam',
        'bezorglocatie naam'
      ],
      deliveryLocationPostalCode: [
        'delivery postal code', 'delivery zip code', 'delivery postcode', 'destination postcode',
        'delivery postal', 'delivery postal no', 'recipient postal code',
        'delivery location zip', 'delivery zip', 'afleverpostcode', 'bezorgpostcode',
        'leveringspostcode', 'leverings postnummer', 'aflever postnummer', 'bezorg postnummer',
        'bezorglocatie postcode', 'afleverlocatie postcode', 'leveradres postcode'
      ],
      deliveryLocationAddress: [
        'delivery address', 'delivery location address', 'delivery street',
        'destination address', 'shipping address', 'recipient address',
        'delivery address line', 'delivery full address', 'delivery address info',
        'afleveradres', 'bezorgadres', 'leveringsadres', 'afleveringsadres',
        'bezorglocatie adres', 'leveradres', 'afleverlocatie adres', 'afgifteadres',
        'afleveradreslijn', 'afleveradres volledig'
      ],
      deliveryLocationCity: [
        'delivery city', 'destination city', 'recipient city', 'shipping city',
        'bezorgstad', 'afleverstad', 'leveringsstad', 'bestemmingsstad'
      ],
      deliveryLocationState: [
        'delivery state', 'delivery province', 'delivery region', 'destination province',
        'destination region', 'afleverprovincie', 'bezorgprovincie', 'leveringsregio'
      ],
      deliveryLocationCountryCode: [
        'delivery country', 'delivery country code', 'destination country',
        'destination country code', 'shipping country', 'shipping country code',
        'delivery location country', 'recipient country', 'delivery country iso code',
        'afleverland', 'bezorgland', 'leveringsland', 'afleverlandcode', 'bezorglandcode',
        'leveringslandcode', 'afleverlocatie land', 'leverlocatie landcode',
        'bezorg locatie land', 'afgifte land'
      ]
    };

    this.countryNameToIso = {
      netherlands: 'NL', nederland: 'NL', holland: 'NL',
      germany: 'DE', deutschland: 'DE',
      belgium: 'BE', belgie: 'BE', belgië: 'BE',
      france: 'FR', frankrijk: 'FR',
      spain: 'ES', espana: 'ES', españa: 'ES',
      italy: 'IT', italia: 'IT',
      unitedkingdom: 'GB', uk: 'GB', britain: 'GB', england: 'GB',
      scotland: 'GB', wales: 'GB', ireland: 'IE',
      poland: 'PL', nederlanden: 'NL',
      sweden: 'SE', sverige: 'SE',
      norway: 'NO', norge: 'NO',
      denmark: 'DK', danmark: 'DK',
      finland: 'FI', suomi: 'FI',
      switzerland: 'CH', schweiz: 'CH', suisse: 'CH',
      austria: 'AT', osterreich: 'AT', österreich: 'AT',
      unitedstates: 'US', usa: 'US', america: 'US',
      canada: 'CA', mexico: 'MX', australia: 'AU', newzealand: 'NZ',
      china: 'CN', india: 'IN', japan: 'JP', southkorea: 'KR', korea: 'KR',
      brazil: 'BR', argentina: 'AR', chile: 'CL', peru: 'PE',
      southafrica: 'ZA', africa: 'ZA', uae: 'AE', emirates: 'AE',
      singapore: 'SG', malaysia: 'MY', indonesia: 'ID'
    };

  static getInstance() {
    if (!EmailProcessingService.instance) {
      EmailProcessingService.instance = new EmailProcessingService();
    }
    return EmailProcessingService.instance;
  }
setOutlookConfig(config) {
    // Newer flows store per-connection credentials, so we just keep this
    // for logging & diagnostics and do not rely on it elsewhere.
    this._legacyOutlookConfig = { ...(this._legacyOutlookConfig || {}), ...(config || {}) };

    this.logService.log(
      'EMAIL_OUTLOOK_CONFIG_UPDATED',
      'Outlook configuration updated',
      {
        clientId: config && config.clientId ? 'configured' : 'not configured',
        redirectUri: config ? config.redirectUri : undefined,
      }
    );
  }

  // Encrypt stored credentials/tokens using ConfigService's encryption key
  encryptCredentials(data) {
    try {
      return CryptoUtils.encryptString(data);
    } catch (error) {
      this.logService.log('EMAIL_ENCRYPT_ERROR', 'Failed to encrypt credentials', { error: error.message }, 'ERROR');
      throw new Error('Encryption failed');
    }
  }

  // Decrypt stored credentials/tokens using ConfigService's encryption key
  decryptCredentials(encryptedData) {
    try {
      return CryptoUtils.decryptString(encryptedData);
    } catch (error) {
      this.logService.log('EMAIL_DECRYPT_ERROR', 'Failed to decrypt credentials', { error: error.message }, 'ERROR');
      throw new Error('Decryption failed');
    }
  }

escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  cleanExtractedValue(value, options = {}) {
    if (!value) {
      return null;
    }

    let cleaned = value
      .replace(/^[=:\-\s]+/, '')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (options.stopChars) {
      const stopRegex = new RegExp(`[${options.stopChars}]`);
      const parts = cleaned.split(stopRegex);
      cleaned = parts[0].trim();
    }

    cleaned = cleaned.replace(/[\s,;]+$/, '').trim();

    if (options.pattern) {
      const match = cleaned.match(options.pattern);
      if (!match) {
        return null;
      }
      cleaned = (match[1] || match[0]).trim();
    }

    if (options.transform) {
      cleaned = options.transform(cleaned);
    }

    if (options.maxLength) {
      cleaned = cleaned.substring(0, options.maxLength);
    }

    return cleaned || null;
  }

  extractValueFromLine(line, keyword, options = {}, skipKeyword = false) {
    if (!line) {
      return '';
    }

    if (skipKeyword) {
      return line.trim();
    }

    const keywordPattern = new RegExp(`${this.escapeRegex(keyword)}\\s*(?:[:=\-]|is)?\\s*(.+)`, 'i');
    const keywordMatch = line.match(keywordPattern);
    if (keywordMatch && keywordMatch[1]) {
      return keywordMatch[1].trim();
    }

    const fallbackPattern = new RegExp(`${this.escapeRegex(keyword)}[^A-Za-z0-9]*([A-Za-z0-9#\\/\\-_,.\s]+)`, 'i');
    const fallbackMatch = line.match(fallbackPattern);
    if (fallbackMatch && fallbackMatch[1]) {
      return fallbackMatch[1].trim();
    }

    return '';
  }

  findValueByKeywords(emailContent, keywords, options = {}) {
    if (!emailContent || !Array.isArray(keywords)) {
      return null;
    }

    const lines = emailContent.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      for (const keyword of keywords) {
        if (!keyword) {
          continue;
        }

        if (!lowerLine.includes(keyword.toLowerCase())) {
          continue;
        }

        let rawValue = this.extractValueFromLine(line, keyword, options);
        if ((!rawValue || !rawValue.trim()) && lines[i + 1]) {
          rawValue = this.extractValueFromLine(lines[i + 1], keyword, options, true);
        }

        const cleanedValue = this.cleanExtractedValue(rawValue, options);
        if (cleanedValue) {
          return { value: cleanedValue, keyword };
        }
      }
    }

    return null;
  }

  normalizeOrderNumber(value) {
    if (!value) {
      return null;
    }
    const sanitized = value.replace(/[^A-Za-z0-9#\/-]/g, '').toUpperCase();
    return sanitized || null;
  }

  normalizePostalCode(value) {
    if (!value) {
      return null;
    }
    const match = value.match(/[A-Z0-9][A-Z0-9\s-]{2,9}/i);
    if (match) {
      return match[0].replace(/\s{2,}/g, ' ').trim().toUpperCase();
    }
    return value.trim().toUpperCase();
  }

  normalizeCountryCode(value) {
    if (!value) {
      return null;
    }
    const alphaOnly = value.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (!alphaOnly) {
      return null;
    }
    if (alphaOnly.length <= 3) {
      return alphaOnly.toUpperCase();
    }
    if (this.countryNameToIso[alphaOnly]) {
      return this.countryNameToIso[alphaOnly];
    }
    return alphaOnly.substring(0, 2).toUpperCase();
  }

  normalizeDateValue(value) {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();

    const isoMatch = trimmed.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const euroMatch = trimmed.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (euroMatch) {
      let [, day, month, year] = euroMatch;
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const textMatch = trimmed.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{2,4})/);
    if (textMatch) {
      const parsed = new Date(trimmed.replace(/(\d{1,2})(st|nd|rd|th)/, '$1'));
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }

    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }

    return null;
  }

   async refreshDomainConnectionTokens(connection) {
    if (!connection.domain_connection_id || !connection.refresh_token_encrypted) {
      throw new Error('Refresh attempted without OAuth metadata');
    }

    const refreshToken = this.decryptCredentials(connection.refresh_token_encrypted);
    if (!refreshToken) {
      throw new Error('Stored refresh token could not be decrypted');
    }

    const domainConnection = await this.domainEmailService.getConnectionById(connection.domain_connection_id);
    if (!domainConnection) {
      throw new Error('Linked domain OAuth connection not found');
    }

    try {
      const payload = new URLSearchParams({
        client_id: domainConnection.client_id,
        client_secret: domainConnection.client_secret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        redirect_uri: domainConnection.redirect_uri,
        scope: domainConnection.scope
      });

      const tokenResponse = await axios.post(domainConnection.token_url, payload.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const data = tokenResponse.data || {};
      const expiresIn = data.expires_in || data.ext_expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      await this.domainEmailService.updateOAuthTokens(connection.domain_connection_id, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt,
        scope: data.scope || domainConnection.scope,
        tokenType: data.token_type || 'Bearer'
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt
      };
    } catch (error) {
      this.logService.log('OAUTH_REFRESH_ERROR', 'Failed to refresh OAuth tokens', {
        connectionId: connection.domain_connection_id,
        error: error.message
      });
      throw error;
    }
  }

  async resolveConnectionCredentials(connection) {
    const decrypted = connection.access_token_encrypted
      ? this.decryptCredentials(connection.access_token_encrypted)
      : null;

    if (!connection.domain_connection_id) {
      if (!decrypted) {
        throw new Error('No password found for connection');
      }

      return { type: 'password', secret: decrypted };
    }

    let accessToken = decrypted;
    let expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
    const refreshThreshold = new Date(Date.now() + 5 * 60 * 1000);

    if (!accessToken || !expiresAt || expiresAt <= refreshThreshold) {
      const refreshed = await this.refreshDomainConnectionTokens(connection);
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;

      connection.token_expires_at = expiresAt;
    }

    if (!accessToken) {
      throw new Error('OAuth access token unavailable after refresh attempt');
    }

    return { type: 'oauth', secret: accessToken };
  }
  // --- Outlook OAuth2 Methods (now using per-domain credentials) ---
  async getOutlookAuthUrl(connectionId) {
    const connection = await this.getEmailConnectionById(connectionId);
    if (!connection || !connection.client_id || !connection.redirect_uri) {
      this.logService.log('EMAIL_OUTLOOK_OAUTH_ERROR', 'Outlook OAuth configuration missing for auth URL generation', { connectionId }, 'ERROR');
      throw new Error('Outlook OAuth configuration missing for this connection.');
    }

    const authorizationUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const scope = 'openid profile email offline_access https://outlook.office.com/IMAP.AccessAsUser.All Mail.Send'; // Standard scope

    // Encode connectionId into the state parameter
    const state = Buffer.from(JSON.stringify({ connectionId })).toString('base64');
    const authUrl = `${authorizationUrl}?` +
      `client_id=${connection.client_id}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(connection.redirect_uri)}&` +
      `response_mode=query&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}`;
    
    this.logService.log('EMAIL_OUTLOOK_OAUTH_INITIATE', 'Initiating Outlook OAuth flow', { connectionId, authUrl: authUrl.substring(0, 100) + '...' });
    return authUrl;
  }

  async handleOutlookCallback(code, connectionId) {
    const connection = await this.getEmailConnectionById(connectionId);
    if (!connection || !connection.client_id || !connection.client_secret || !connection.redirect_uri) {
      this.logService.log('EMAIL_OUTLOOK_OAUTH_ERROR', 'Outlook OAuth configuration missing for callback handling', { connectionId }, 'ERROR');
      throw new Error('Outlook OAuth configuration missing for this connection.');
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const scope = 'openid profile email offline_access https://outlook.office.com/IMAP.AccessAsUser.All Mail.Send'; // Standard scope

    try {
      const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
        client_id: connection.client_id,
        scope: scope,
        code: code,
        redirect_uri: connection.redirect_uri,
        grant_type: 'authorization_code',
        client_secret: connection.client_secret
      }).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;
      const newAccessTokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

      // Update the database with new tokens for this connection
      const db = DatabaseManager.getInstance();
      await db.query(`
        UPDATE domain_client_mail_map
        SET refresh_token = ?, access_token = ?, access_token_expires_at = ?, updated_at = NOW()
        WHERE id = ?
      `, [
        this.encryptCredentials(refresh_token),
        this.encryptCredentials(access_token),
        newAccessTokenExpiresAt,
        connectionId
      ]);

      this.logService.log('EMAIL_OUTLOOK_OAUTH_SUCCESS', 'Outlook OAuth successful and tokens stored', { connectionId, emailAddress: connection.email_address });
      return { success: true, emailAddress: connection.email_address };
	   

    } catch (error) {
      this.logService.log('EMAIL_OUTLOOK_OAUTH_ERROR', 'Outlook OAuth failed during token exchange', { connectionId, error: error.message, response: error.response?.data }, 'ERROR');
      throw new Error(`Outlook OAuth failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  // --- Token Refresh Mechanism (for stored credentials) ---
  async refreshAccessToken(connection) {
    // Fetch the latest connection details to ensure we have the correct client_secret etc.
    const latestConnection = await this.getEmailConnectionById(connection.id);
    if (!latestConnection || !latestConnection.client_id || !latestConnection.client_secret || !latestConnection.redirect_uri || !latestConnection.refresh_token) {
      this.logService.log('EMAIL_ACCESS_TOKEN_REFRESH_ERROR', 'Missing credentials for token refresh', { connectionId: connection.id }, 'ERROR');
      throw new Error('Missing credentials for token refresh.');
    }
				  
		

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const scope = 'openid profile email offline_access https://outlook.office.com/IMAP.AccessAsUser.All Mail.Send'; // Standard scope

    try {
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: latestConnection.client_id,
        scope: scope,
        refresh_token: latestConnection.refresh_token,
        grant_type: 'refresh_token',
        client_secret: latestConnection.client_secret,
        redirect_uri: latestConnection.redirect_uri // Required for refresh token flow
      }).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const newAccessTokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

      // Update the database with new tokens
      const db = DatabaseManager.getInstance();
      await db.query(`
        UPDATE domain_client_mail_map
        SET access_token = ?, refresh_token = ?, access_token_expires_at = ?, updated_at = NOW()
        WHERE id = ?
      `, [
        this.encryptCredentials(access_token),
        this.encryptCredentials(refresh_token || latestConnection.refresh_token), // Refresh token might not always be returned
        newAccessTokenExpiresAt,
        connection.id
      ]);

      this.logService.log('EMAIL_ACCESS_TOKEN_REFRESH_SUCCESS', 'Access token refreshed for connection', { connectionId: connection.id, emailAddress: connection.email_address });
      return access_token;
    } catch (error) {
      this.logService.log('EMAIL_ACCESS_TOKEN_REFRESH_ERROR', 'Failed to refresh access token', { connectionId: connection.id, emailAddress: connection.email_address, error: error.message, response: error.response?.data }, 'ERROR');
      throw new Error(`Failed to refresh access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  // Connect to email provider
  async connectToEmail(connection, credentials) {
    //let client = null;
    
    try {
      this.logService.log('EMAIL_CONNECT_START', 'Starting email connection', { 
        email: connectionConfig.email_address, 
        provider: connectionConfig.email_provider 
      });

      // Retrieve full config from DB (which now includes refresh_token and access_token)
      let fullConnectionDetails = await this.getEmailConnectionById(connectionConfig.id); // Fetch full connection details
      if (!fullConnectionDetails) {
        throw new Error('Domain email connection configuration not found.');
      }

      // Check if access token is valid or needs refresh
      if (!fullConnectionDetails.access_token || (fullConnectionDetails.access_token_expires_at && new Date() >= new Date(fullConnectionDetails.access_token_expires_at).getTime() - 60000)) {
        this.logService.log('EMAIL_ACCESS_TOKEN_EXPIRED', 'Access token expired or expiring, attempting refresh', { connectionId: fullConnectionDetails.id, emailAddress: fullConnectionDetails.email_address });
        fullConnectionDetails.access_token = await this.refreshAccessToken(fullConnectionDetails);
      }

      let imapConfig;
      const isOAuth = credentials.type === 'oauth';
      const secret = credentials.secret;

      if (!secret) {
        throw new Error('Missing authentication secret for email connection');
      }

      if (connectionConfig.email_provider === 'outlook') {
        imapConfig = {
          host: 'outlook.office365.com',
          port: 993,
          secure: true,
          auth: isOAuth
            ? {
                user: connection.email_address,
                accessToken: secret
              }
            : {
                user: connection.email_address,
                pass: secret
              } 
        };
      } else if (connectionConfig.email_provider === 'gmail') {
																			   
        imapConfig = {
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          auth: {
            user: connectionConfig.email_address, // This should be the email address associated with the token
            pass: secret
          },
        };
      } else {
        throw new Error(`Unsupported email provider: ${connectionConfig.email_provider}`);
      }

      client = new ImapFlow(imapConfig);
      await client.connect();
      
      this.logService.log('EMAIL_CONNECT_SUCCESS', 'Email connection established', { 
        email: connectionConfig.email_address 
      });
      
      return client;
    } catch (error) {
      this.logService.log('EMAIL_CONNECT_ERROR', 'Email connection failed', { 
        email: connectionConfig.email_address, 
        error: error.message 
      }, 'ERROR');
      throw error;
    } finally {
      // Ensure client is logged out if connection was established but failed later
      if (client && client.connected) {
        try {
          await client.logout();
        } catch (logoutError) {
          this.logService.log('EMAIL_LOGOUT_ERROR', 'Error during IMAP client logout', { email: connectionConfig.email_address, error: logoutError.message }, 'WARNING');
        }
      }
    }
  }

  // AI-powered logistics detection
  analyzeEmailForLogistics(emailContent) {
    try {
      const content = emailContent.toLowerCase();
      const foundKeywords = [];
      let keywordCount = 0;

      // Check for logistics keywords
      this.logisticsKeywords.forEach(keyword => {
        if (content.includes(keyword.toLowerCase())) {
          foundKeywords.push(keyword);
          keywordCount++;
        }
      });

      // Calculate confidence score
      const confidenceScore = Math.min(keywordCount / 5, 1.0); // Max confidence at 5+ keywords
      const isLogisticsOrder = confidenceScore >= 0.3; // 30% threshold

      this.logService.log('EMAIL_AI_ANALYSIS', 'Email analyzed for logistics content', {
        keywordCount,
        confidenceScore,
        isLogisticsOrder,
        foundKeywords: foundKeywords.slice(0, 10) 
      });

      return {
        isLogisticsOrder,
        confidenceScore,
        foundKeywords
      };
    } catch (error) {
      this.logService.log('EMAIL_AI_ANALYSIS_ERROR', 'Email analysis failed', { error: error.message }, 'ERROR');
      return {
        isLogisticsOrder: false,
        confidenceScore: 0,
        foundKeywords: []
      };
    }
  }

  // Extract order information from email
  extractOrderInformation(emailContent, subject) {
    try {
      const content = emailContent || '';
      const rawMatches = {};
      const takeFirstLine = value => value.split(/\r?\n/)[0].trim();
      const extractedData = {};

      // Extract order number (simple pattern matching)
      const orderMatch = this.findValueByKeywords(content, this.extractionKeywords.customerOrderNumber, {
        pattern: /([A-Z0-9][A-Z0-9#\/-]{3,})/i,
        transform: value => this.normalizeOrderNumber(value)
      });
      if (orderMatch) {
        extractedData.customerOrderNumber = orderMatch.value;
        extractedData.orderNumber = orderMatch.value;
        rawMatches.customerOrderNumber = orderMatch;
      } else {
        const fallback = content.match(/(?:order|ord|ref|tracking)[^A-Za-z0-9]{0,10}([A-Z0-9#\/-]{4,})/i);
        if (fallback && fallback[1]) {
          const normalized = this.normalizeOrderNumber(fallback[1]);
          if (normalized) {
            extractedData.customerOrderNumber = normalized;
            extractedData.orderNumber = normalized;
          }
        }
      }

      // Extract weight information
      const pickupName = this.findValueByKeywords(content, this.extractionKeywords.pickupLocationName, {
        transform: takeFirstLine,
        maxLength: 120
      });
      if (pickupName) {
        extractedData.pickupLocationName = pickupName.value;
        rawMatches.pickupLocationName = pickupName;
      }

      const pickupPostal = this.findValueByKeywords(content, this.extractionKeywords.pickupLocationPostalCode, {
        pattern: /([A-Z0-9][A-Z0-9\s-]{3,9})/i,
        transform: value => this.normalizePostalCode(value)
      });
      if (pickupPostal) {
        extractedData.pickupLocationPostalCode = pickupPostal.value;
        extractedData.pickupPostal = pickupPostal.value;
        rawMatches.pickupLocationPostalCode = pickupPostal;
      }

      // Extract package count
      const pickupAddress = this.findValueByKeywords(content, this.extractionKeywords.pickupLocationAddress, {
        transform: takeFirstLine,
        maxLength: 200
      });
      if (pickupAddress) {
        extractedData.pickupLocationAddress = pickupAddress.value;
        extractedData.pickupAddress = pickupAddress.value;
        rawMatches.pickupLocationAddress = pickupAddress;
      }

      const pickupCity = this.findValueByKeywords(content, this.extractionKeywords.pickupLocationCity, {
        transform: takeFirstLine,
        maxLength: 120
      });
      if (pickupCity) {
        extractedData.pickupLocationCity = pickupCity.value;
        extractedData.pickupCity = pickupCity.value;
        rawMatches.pickupLocationCity = pickupCity;
      }

      // Extract customer name (simple pattern)
      const pickupState = this.findValueByKeywords(content, this.extractionKeywords.pickupLocationState, {
        transform: takeFirstLine,
        maxLength: 120
      });
      if (pickupState) {
        extractedData.pickupLocationState = pickupState.value;
        extractedData.pickupState = pickupState.value;
        rawMatches.pickupLocationState = pickupState;
      }

      const pickupCountry = this.findValueByKeywords(content, this.extractionKeywords.pickupLocationCountryCode, {
        transform: value => this.normalizeCountryCode(value)
      });
      if (pickupCountry) {
        extractedData.pickupLocationCountryCode = pickupCountry.value;
        extractedData.pickupCountry = pickupCountry.value;
        rawMatches.pickupLocationCountryCode = pickupCountry;
      }

      const pickupDate = this.findValueByKeywords(content, this.extractionKeywords.pickupDate, {
        pattern: /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+\d{2,4})/,
        transform: value => this.normalizeDateValue(value)
      });
      if (pickupDate) {
        extractedData.pickupDate = pickupDate.value;
        rawMatches.pickupDate = pickupDate;
      }

      const pickupContact = this.findValueByKeywords(content, this.extractionKeywords.pickupContact, {
        transform: takeFirstLine,
        maxLength: 120
      });
      if (pickupContact) {
        extractedData.pickupContact = pickupContact.value;
        rawMatches.pickupContact = pickupContact;
      }

      const deliveryName = this.findValueByKeywords(content, this.extractionKeywords.deliveryLocationName, {
        transform: takeFirstLine,
        maxLength: 120
      });
      if (deliveryName) {
        extractedData.deliveryLocationName = deliveryName.value;
        rawMatches.deliveryLocationName = deliveryName;
      }

      const deliveryPostal = this.findValueByKeywords(content, this.extractionKeywords.deliveryLocationPostalCode, {
        pattern: /([A-Z0-9][A-Z0-9\s-]{3,9})/i,
        transform: value => this.normalizePostalCode(value)
      });
      if (deliveryPostal) {
        extractedData.deliveryLocationPostalCode = deliveryPostal.value;
        extractedData.deliveryPostal = deliveryPostal.value;
        rawMatches.deliveryLocationPostalCode = deliveryPostal;
      }

      const deliveryAddress = this.findValueByKeywords(content, this.extractionKeywords.deliveryLocationAddress, {
        transform: takeFirstLine,
        maxLength: 200
      });
      if (deliveryAddress) {
        extractedData.deliveryLocationAddress = deliveryAddress.value;
        extractedData.deliveryAddress = deliveryAddress.value;
        rawMatches.deliveryLocationAddress = deliveryAddress;
      }

      const deliveryCity = this.findValueByKeywords(content, this.extractionKeywords.deliveryLocationCity, {
        transform: takeFirstLine,
        maxLength: 120
      });
      if (deliveryCity) {
        extractedData.deliveryLocationCity = deliveryCity.value;
        extractedData.deliveryCity = deliveryCity.value;
        rawMatches.deliveryLocationCity = deliveryCity;
      }

      const deliveryState = this.findValueByKeywords(content, this.extractionKeywords.deliveryLocationState, {
        transform: takeFirstLine,
        maxLength: 120
      });
      if (deliveryState) {
        extractedData.deliveryLocationState = deliveryState.value;
        extractedData.deliveryState = deliveryState.value;
        rawMatches.deliveryLocationState = deliveryState;
      }

      const deliveryCountry = this.findValueByKeywords(content, this.extractionKeywords.deliveryLocationCountryCode, {
        transform: value => this.normalizeCountryCode(value)
      });
      if (deliveryCountry) {
        extractedData.deliveryLocationCountryCode = deliveryCountry.value;
        extractedData.deliveryCountry = deliveryCountry.value;
        rawMatches.deliveryLocationCountryCode = deliveryCountry;
      }

      const weightMatch = content.match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?|kgs|lbs?|pounds?|tons?)/i);
      if (weightMatch) {
        extractedData.weight = parseFloat(weightMatch[1]);
        extractedData.weightUnit = weightMatch[2] ? weightMatch[2].toLowerCase() : 'kg';
        rawMatches.weight = { keyword: 'weight', value: `${weightMatch[1]} ${weightMatch[2] || ''}`.trim() };
      }

      const packageMatch = content.match(/(\d+)\s*(packages?|boxes?|items?|colli|pallets?)/i);
      if (packageMatch) {
        extractedData.packageCount = parseInt(packageMatch[1], 10);
        rawMatches.packageCount = { keyword: 'package', value: packageMatch[0] };
      }

      const customerMatch = content.match(/(?:customer|client|company|attn|attention)\s*[:\-]?\s*([^\r\n]+)/i);
      if (customerMatch) {
        extractedData.customerName = customerMatch[1].trim();
        rawMatches.customerName = { keyword: 'customer', value: customerMatch[1].trim() };
      }

      if (!extractedData.description) {
        const trimmedBody = content.replace(/\s+/g, ' ').trim();
        extractedData.description = subject || trimmedBody.substring(0, 200);
      }

      extractedData.rawMatches = rawMatches;

      this.logService.log('EMAIL_ORDER_EXTRACTION', 'Order information extracted', {
        customerOrderNumber: extractedData.customerOrderNumber,
        pickupLocationName: extractedData.pickupLocationName,
        deliveryLocationName: extractedData.deliveryLocationName
      });

      return extractedData;
    } catch (error) {
      this.logService.log('EMAIL_ORDER_EXTRACTION_ERROR', 'Order extraction failed', { error: error.message }, 'ERROR');
      return {};
    }
  }

  // Generate XML for Oracle API
  generateOrderXML(orderData) {
    try {
      const orderId = orderData.customerOrderNumber || orderData.orderNumber || `AUTO_${Date.now()}`;
      const pickupAddress = orderData.pickupLocationAddress || orderData.pickupAddress || 'TBD';
      const pickupCity = orderData.pickupLocationCity || orderData.pickupCity || 'TBD';
      const pickupPostal = orderData.pickupLocationPostalCode || orderData.pickupPostal || 'TBD';
      const pickupCountry = orderData.pickupLocationCountryCode || orderData.pickupCountry || 'TBD';
      const deliveryAddress = orderData.deliveryLocationAddress || orderData.deliveryAddress || 'TBD';
      const deliveryCity = orderData.deliveryLocationCity || orderData.deliveryCity || 'TBD';
      const deliveryPostal = orderData.deliveryLocationPostalCode || orderData.deliveryPostal || 'TBD';
      const deliveryCountry = orderData.deliveryLocationCountryCode || orderData.deliveryCountry || 'TBD';
      const weightUnit = (orderData.weightUnit || 'kg').toUpperCase();
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TransportOrder>
    <OrderID>${orderId}</OrderID>
    <CustomerName>${orderData.customerName || 'Unknown Customer'}</CustomerName>
    <OrderDate>${new Date().toISOString().split('T')[0]}</OrderDate>
    <PickupLocation>
        <Address>${pickupAddress}</Address>
        <City>${pickupCity}</City>
        <PostalCode>${pickupPostal}</PostalCode>
        <Country>${pickupCountry}</Country>
    </PickupLocation>
    <DeliveryLocation>
        <Address>${deliveryAddress}</Address>
        <City>${deliveryCity}</City>
        <PostalCode>${deliveryPostal}</PostalCode>
        <Country>${deliveryCountry}</Country>
    </DeliveryLocation>
    <ShipmentDetails>
        <Weight>${orderData.weight || 0}</Weight>
        <WeightUnit>${weightUnit}</WeightUnit>
        <PackageCount>${orderData.packageCount || 1}</PackageCount>
        <Description>${orderData.description || 'Logistics shipment'}</Description>
    </ShipmentDetails>
    <ProcessedDate>${new Date().toISOString()}</ProcessedDate>
</TransportOrder>`;

      this.logService.log('EMAIL_XML_GENERATION', 'XML generated for order', {
        orderNumber: orderData.customerOrderNumber || orderData.orderNumber
      });

      return xml;
    } catch (error) {
      this.logService.log('EMAIL_XML_GENERATION_ERROR', 'XML generation failed', { error: error.message }, 'ERROR');
      return null;
    }
  }

  // Process emails from a connection
  async processEmailsFromConnection(connection) {
    let client = null;
    
    try {
      this.logService.log('EMAIL_PROCESS_START', 'Starting email processing', { 
        email: connection.email_address, 
        domain: connection.domain_id 
      });

      //client = await this.connectToEmail(connection);
      const credentials = await this.resolveConnectionCredentials(connection);
      client = await this.connectToEmail(connection, credentials);
      
      // Select INBOX
      await client.mailboxOpen('INBOX');
      
      // Get recent emails (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Fetch messages with body structure to detect attachments
      const fetchedMessages = [];
      for await (const message of client.fetch({
        since: yesterday
      }, {
        envelope: true,
        bodyText: true,
        bodyStructure: true // Request body structure to detect attachments
        })) {
        fetchedMessages.push(message);
      }

      fetchedMessages.sort((a, b) => {
        const dateA = a.envelope?.date ? new Date(a.envelope.date).getTime() : 0;
        const dateB = b.envelope?.date ? new Date(b.envelope.date).getTime() : 0;
        return dateB - dateA;
      });

      let processedCount = 0;
      const db = DatabaseManager.getInstance();

      for (const message of fetchedMessages) {
        try {
          const emailId = message.envelope.messageId || `msg_${message.seq}`;
          const subject = message.envelope.subject || 'No Subject';
          const senderEmail = message.envelope.from?.[0]?.address || 'unknown@unknown.com';
          const receivedDate = message.envelope.date || new Date();
          const contentText = message.bodyText || '';

          // Check for attachments
          let hasAttachments = false;
          if (message.bodyStructure && message.bodyStructure.childNodes) {
            const findAttachments = (nodes) => {
              for (const node of nodes) {
                if (node.disposition && node.disposition.type === 'attachment') {
                  return true;
                }
                if (node.childNodes && findAttachments(node.childNodes)) {
                  return true;
                }
              }
              return false;
            };
            hasAttachments = findAttachments(message.bodyStructure.childNodes);
          }
          
          if (hasAttachments) {
            this.logService.log('EMAIL_ATTACHMENT_DETECTED', 'Email contains attachments', { emailId, subject, domainId: connection.domain_id });
            // Further processing of attachments (e.g., downloading, analyzing) would go here.
            // For this fix, we are only detecting and logging their presence.
          }

          // Check if already processed
          const existingEmail = await db.query(
            'SELECT id FROM processed_emails WHERE email_id = ? AND domain_id = ?',
            [emailId, connection.domain_id]
          );

          if (existingEmail.rows.length > 0) {
            continue; // Skip already processed emails
          }

          // Analyze email for logistics content
          const analysis = this.analyzeEmailForLogistics(contentText + ' ' + subject);
          
          // Store processed email
          const processedEmailId = crypto.randomUUID().replace(/-/g, ''); 
          await db.query(`
            INSERT INTO processed_emails (
              id, user_id, domain_id, email_connection_id, email_id, subject, 
              sender_email, received_date, processed_date, content_text, 
              has_attachments, is_logistics_order, confidence_score, 
              keywords_found, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)
          `, [
            processedEmailId, connection.user_id, connection.domain_id, 
            connection.id, emailId, subject, senderEmail, receivedDate, 
            contentText, hasAttachments, analysis.isLogisticsOrder, analysis.confidenceScore,
            JSON.stringify(analysis.foundKeywords), 'completed'
          ]);

          // If it's a logistics order, extract order information
          if (analysis.isLogisticsOrder) {
            const orderData = this.extractOrderInformation(contentText, subject);
            const xml = this.generateOrderXML(orderData);

            // Store extracted order
            const extractedOrderId = crypto.randomUUID().replace(/-/g, '');
            const orderRecord = {
              id: extractedOrderId,
              processed_email_id: processedEmailId,
              domain_id: connection.domain_id,
              customer_order_number: orderData.customerOrderNumber || orderData.orderNumber || null,
              customer_name: orderData.customerName || null,
              pickup_location_name: orderData.pickupLocationName || null,
              pickup_date: orderData.pickupDate || null,
              pickup_contact: orderData.pickupContact || null,
              package_count: orderData.packageCount || null,
              description: orderData.description || subject,
              weight_unit: (orderData.weightUnit || 'kg').toUpperCase(),
              weight: orderData.weight || null,
              pickup_location_postal_code: orderData.pickupLocationPostalCode || null,
              pickup_location_country_code: orderData.pickupLocationCountryCode
                ? orderData.pickupLocationCountryCode.toUpperCase()
                : null,
              pickup_location_address: orderData.pickupLocationAddress || null,
              pickup_location_city: orderData.pickupLocationCity || null,
              pickup_location_state: orderData.pickupLocationState || null,
              delivery_location_name: orderData.deliveryLocationName || null,
              delivery_location_postal_code: orderData.deliveryLocationPostalCode || null,
              delivery_location_country_code: orderData.deliveryLocationCountryCode
                ? orderData.deliveryLocationCountryCode.toUpperCase()
                : null,
              delivery_location_address: orderData.deliveryLocationAddress || null,
              delivery_location_city: orderData.deliveryLocationCity || null,
              delivery_location_state: orderData.deliveryLocationState || null,
              xml_generated: xml,
              confidence_percentage: Math.round((analysis.confidenceScore || 0) * 100),
              extracted_data: JSON.stringify(orderData.rawMatches || orderData)
            };

            const orderColumns = Object.keys(orderRecord);
            const orderValues = orderColumns.map(column => orderRecord[column] ?? null);

            await db.query(
              `INSERT INTO extracted_orders (${orderColumns.join(', ')}) VALUES (${orderColumns.map(() => '?').join(', ')})`,
              orderValues
            );

            this.logService.log('EMAIL_ORDER_EXTRACTED', 'Order extracted from email', {
              email: connection.email_address,
              subject,
              orderNumber: orderData.customerOrderNumber || orderData.orderNumber,
              confidence: analysis.confidenceScore
            });
          }

          processedCount++;
          if (processedCount > 0) {
            break; // Only process the most recent unprocessed email
          }
        } catch (emailError) {
          this.logService.log('EMAIL_PROCESS_EMAIL_ERROR', 'Failed to process individual email', {
            error: emailError.message,
            subject: message.envelope?.subject
          }, 'ERROR');
        }
      }

      // Update connection last sync
      await db.query(
        'UPDATE domain_client_mail_map SET updated_at = NOW() WHERE id = ?', // Just update updated_at
        [connection.id] 
      );

      this.logService.log('EMAIL_PROCESS_SUCCESS', 'Email processing completed', {
        email: connection.email_address,
        processedCount
      });

      return { success: true, processedCount };

    } catch (error) {
      this.logService.log('EMAIL_PROCESS_ERROR', 'Email processing failed', {
        email: connection.email_address,
        error: error.message
      }, 'ERROR');

      // Update connection status to error (if we had a status column in domain_client_mail_map)
      // For now, just log the error.
      // const db = DatabaseManager.getInstance();
      // await db.query(
      //   'UPDATE domain_client_mail_map SET status = ? WHERE id = ?',
      //   ['error', connection.id]
      // );

      return { success: false, error: error.message };
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (logoutError) {
          // Ignore logout errors
        }
      }
    }
  }

  // Process all active email connections for a given domain (or all domains if domainId is null)
  async processAllConnections(domainId = null) { 
    if (this.isProcessing) {
      this.logService.log('EMAIL_PROCESS_SKIP', 'Email processing already in progress', {}, 'INFO');
      return;
    }

    this.isProcessing = true;
    
    try {
      this.logService.log('EMAIL_PROCESS_ALL_START', 'Starting processing for all connections', { domainId });

      const db = DatabaseManager.getInstance();
      let query = `
        SELECT dcmm.*, u.id as user_id FROM domain_client_mail_map dcmm
        JOIN users u ON dcmm.domain_id = u.domain_id AND u.role = 'super_admin' -- Assuming super_admin's user_id for processed_emails table
        WHERE 1=1
      `;
      const params = [];

      if (domainId) {
        query += ` AND dcmm.domain_id = ?`;
        params.push(domainId);
      }

      const result = await db.query(query, params);

      const connections = result.rows;
      let totalProcessed = 0;

      for (const connection of connections) {
        try {
          // Pass the user_id from the joined super_admin for processed_emails table
          const connectionWithUserId = { ...connection, user_id: connection.user_id };
          const processResult = await this.processEmailsFromConnection(connectionWithUserId);
          if (processResult.success) {
            totalProcessed += processResult.processedCount;
          }
        } catch (connectionError) {
          this.logService.log('EMAIL_PROCESS_CONNECTION_ERROR', 'Failed to process connection', {
            email: connection.email_address,
            error: connectionError.message
          }, 'ERROR');
        }
      }

      this.logService.log('EMAIL_PROCESS_ALL_SUCCESS', 'All connections processed', {
        connectionsCount: connections.length,
        totalProcessed,
        domainId
      });

    } catch (error) {
      this.logService.log('EMAIL_PROCESS_ALL_ERROR', 'Failed to process all connections', {
        error: error.message
      }, 'ERROR');
    } finally {
      this.isProcessing = false;
    }
  }

  // Start automatic processing
  startAutomaticProcessing(intervalMinutes = 15) {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.logService.log('EMAIL_AUTO_PROCESS_START', 'Starting automatic email processing', {
      intervalMinutes
    }, 'INFO');

    this.processingInterval = setInterval(() => {
      this.processAllConnections(); // Process all connections across all domains
    }, intervalMinutes * 60 * 1000);

    // Process immediately
    this.processAllConnections();
  }

  // Stop automatic processing
  stopAutomaticProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      
      this.logService.log('EMAIL_AUTO_PROCESS_STOP', 'Automatic email processing stopped', {}, 'INFO');
    }
  }

  // Get processing status
  getProcessingStatus() {
    return {
      isProcessing: this.isProcessing,
      automaticProcessing: this.processingInterval !== null
    };
  }

  // --- Email Connection Management Methods (for domain_client_mail_map) ---
  async createEmailConnectionEntry(userId, domainId, emailAddress, emailProvider, clientId, clientSecret, redirectUri, tenantId, accessToken = null, refreshToken = null, expiresIn = null) {
    const db = DatabaseManager.getInstance();
    try {
      const connectionId = crypto.randomUUID().replace(/-/g, '');
      const encryptedClientSecret = this.encryptCredentials(clientSecret);
      const encryptedRefreshToken = refreshToken ? this.encryptCredentials(refreshToken) : null;
      const encryptedAccessToken = accessToken ? this.encryptCredentials(accessToken) : null;
      const accessTokenExpiresAt = expiresIn ? new Date(Date.now() + (expiresIn * 1000)) : null;

      // Check if an entry already exists for this domain and email address
      const existingEntry = await db.query(
        'SELECT id FROM domain_client_mail_map WHERE domain_id = ? AND email_address = ?',
        [domainId, emailAddress]
      );

      if (existingEntry.rows.length > 0) {
        // Update existing entry
        await db.query(`
          UPDATE domain_client_mail_map
          SET client_id = ?, client_secret = ?, redirect_uri = ?, tenant_id = ?, refresh_token = ?, access_token = ?, access_token_expires_at = ?, updated_at = NOW()
          WHERE id = ?
        `, [
          clientId, encryptedClientSecret, redirectUri, tenantId, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt, existingEntry.rows[0].id
        ]);
        this.logService.log('EMAIL_CONNECTION_UPDATE_SUCCESS', 'Email connection entry updated', { emailAddress, domainId });
        return { id: existingEntry.rows[0].id, email_address: emailAddress, email_provider: emailProvider, status: 'updated' };
      } else {
        // Insert new entry
        await db.query(`
          INSERT INTO domain_client_mail_map (id, domain_id, email_address, email_provider, client_id, client_secret, redirect_uri, tenant_id, 
          refresh_token, access_token, access_token_expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [connectionId, domainId, emailAddress, emailProvider, clientId, encryptedClientSecret, redirectUri, tenantId, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt]);
        this.logService.log('EMAIL_CONNECTION_CREATE_SUCCESS', 'Email connection entry created', { emailAddress, domainId });
        return { id: connectionId, email_address: emailAddress, email_provider: emailProvider, status: 'created' };
      }
    } catch (error) {
      this.logService.log('EMAIL_CONNECTION_CREATE_ERROR', 'Failed to create/update email connection entry', { emailAddress, domainId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async getEmailConnections(domainId) {
    const db = DatabaseManager.getInstance();
    try {
      const result = await db.query(
        'SELECT id, email_address, email_provider, access_token_expires_at, created_at, updated_at FROM domain_client_mail_map WHERE domain_id = ?',
        [domainId]
      );
      // Determine status based on access_token_expires_at
      const connections = result.rows.map(conn => ({
        ...conn,
        status: conn.access_token_expires_at && new Date(conn.access_token_expires_at) > new Date() ? 'connected' : 'pending_oauth', // Simplified status
        last_sync: conn.updated_at // Using updated_at as last_sync for simplicity
      }));
      this.logService.log('EMAIL_CONNECTION_FETCH_SUCCESS', 'Email connections fetched', { domainId, count: connections.length });
      return connections;
    } catch (error) {
      this.logService.log('EMAIL_CONNECTION_FETCH_ERROR', 'Failed to fetch email connections', { domainId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async getEmailConnectionById(connectionId) {
    const db = DatabaseManager.getInstance();
    try {
      const result = await db.query(
        'SELECT * FROM domain_client_mail_map WHERE id = ?',
        [connectionId]
      );
      if (result.rows.length > 0) {
        const config = result.rows[0];
        // Decrypt sensitive fields before returning
        config.client_secret = this.decryptCredentials(config.client_secret);
        if (config.refresh_token) {
          config.refresh_token = this.decryptCredentials(config.refresh_token);
        }
        if (config.access_token) {
          config.access_token = this.decryptCredentials(config.access_token);
        }
        return config;
      }
      return null;
    } catch (error) {
      this.logService.log('EMAIL_CONNECTION_FETCH_BY_ID_ERROR', 'Failed to fetch email connection by ID', { connectionId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async deleteEmailConnection(connectionId, domainId) {
    const db = DatabaseManager.getInstance();
    try {
      const result = await db.query(
        'DELETE FROM domain_client_mail_map WHERE id = ? AND domain_id = ?',
        [connectionId, domainId]
      );
      if (result.rowsAffected > 0) {
        this.logService.log('EMAIL_CONNECTION_DELETE_SUCCESS', 'Email connection deleted', { connectionId, domainId });
        return true;
      }
      this.logService.log('EMAIL_CONNECTION_DELETE_NOT_FOUND', 'Email connection not found or not authorized for deletion', { connectionId, domainId }, 'WARNING');
      return false;
    } catch (error) {
      this.logService.log('EMAIL_CONNECTION_DELETE_ERROR', 'Failed to delete email connection', { connectionId, domainId, error: error.message }, 'ERROR');
      throw error;
    }
  }
}

module.exports = EmailProcessingService;
