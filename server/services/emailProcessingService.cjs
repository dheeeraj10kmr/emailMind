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

    // Outlook OAuth2 Configuration - will be set dynamically
   /*
   this.outlookConfig = {
      clientId: null,
      clientSecret: null,
      redirectUri: null,
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', // Standard URL
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', // Standard URL
      scope: 'openid profile email offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send'
    };
	*/
  }

  static getInstance() {
    if (!EmailProcessingService.instance) {
      EmailProcessingService.instance = new EmailProcessingService();
    }
    return EmailProcessingService.instance;
  }
setOutlookConfig(config) {
    // Backwards compatibility: older code sets a global Outlook config.
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
  // NEW: Method to set Outlook config dynamically
  /*
  setOutlookConfig(config) {
    this.outlookConfig = { ...this.outlookConfig, ...config };
    this.logService.log('EMAIL_OUTLOOK_CONFIG_UPDATED', 'Outlook configuration updated', {
      clientId: config.clientId ? 'configured' : 'not configured',
      redirectUri: config.redirectUri
    });
  }
*/
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
      const content = emailContent.toLowerCase();
      const extractedData = {};

      // Extract order number (simple pattern matching)
      const orderNumberPatterns = [
        /order\s*#?\s*(\w+)/i,
        /order\s*number\s*:?\s*(\w+)/i,
        /ref\s*:?\s*(\w+)/i
      ];

      for (const pattern of orderNumberPatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.orderNumber = match[1];
          break;
        }
      }

      // Extract weight information
      const weightPatterns = [
        /(\d+(?:\.\d+)?)\s*(kg|kilograms?|lbs?|pounds?|tons?)/i,
        /weight\s*:?\s*(\d+(?:\.\d+)?)/i
      ];

      for (const pattern of weightPatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.weight = parseFloat(match[1]);
          extractedData.weightUnit = match[2] || 'kg';
          break;
        }
      }

      // Extract package count
      const packagePatterns = [
        /(\d+)\s*packages?/i,
        /(\d+)\s*boxes?/i,
        /(\d+)\s*items?/i
      ];

      for (const pattern of packagePatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.packageCount = parseInt(match[1]);
          break;
        }
      }

      // Extract customer name (simple pattern)
      const customerPatterns = [
        /customer\s*:?\s*([^\n\r]+)/i,
        /client\s*:?\s*([^\n\r]+)/i,
        /company\s*:?\s*([^\n\r]+)/i
      ];

      for (const pattern of customerPatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.customerName = match[1].trim();
          break;
        }
      }

      this.logService.log('EMAIL_ORDER_EXTRACTION', 'Order information extracted', extractedData);

      return extractedData;
    } catch (error) {
      this.logService.log('EMAIL_ORDER_EXTRACTION_ERROR', 'Order extraction failed', { error: error.message }, 'ERROR');
      return {};
    }
  }

  // Generate XML for Oracle API
  generateOrderXML(orderData) {
    try {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TransportOrder>
    <OrderID>${orderData.orderNumber || 'AUTO_' + Date.now()}</OrderID>
    <CustomerName>${orderData.customerName || 'Unknown Customer'}</CustomerName>
    <OrderDate>${new Date().toISOString().split('T')[0]}</OrderDate>
    <PickupLocation>
        <Address>${orderData.pickupAddress || 'TBD'}</Address>
        <City>${orderData.pickupCity || 'TBD'}</City>
        <PostalCode>${orderData.pickupPostal || 'TBD'}</PostalCode>
        <Country>${orderData.pickupCountry || 'TBD'}</Country>
    </PickupLocation>
    <DeliveryLocation>
        <Address>${orderData.deliveryAddress || 'TBD'}</Address>
        <City>${orderData.deliveryCity || 'TBD'}</City>
        <PostalCode>${orderData.deliveryPostal || 'TBD'}</PostalCode>
        <Country>${orderData.deliveryCountry || 'TBD'}</Country>
    </DeliveryLocation>
    <ShipmentDetails>
        <Weight>${orderData.weight || 0}</Weight>
        <WeightUnit>${orderData.weightUnit || 'kg'}</WeightUnit>
        <PackageCount>${orderData.packageCount || 1}</PackageCount>
        <Description>${orderData.description || 'Logistics shipment'}</Description>
    </ShipmentDetails>
    <ProcessedDate>${new Date().toISOString()}</ProcessedDate>
</TransportOrder>`;

      this.logService.log('EMAIL_XML_GENERATION', 'XML generated for order', { 
        orderNumber: orderData.orderNumber 
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
      const messages = await client.fetch({
        since: yesterday
      }, {
        envelope: true,
        bodyText: true,
        bodyStructure: true // Request body structure to detect attachments
      });

      let processedCount = 0;
      const db = DatabaseManager.getInstance();

      for await (const message of messages) {
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
            await db.query(`
              INSERT INTO extracted_orders (
                id, processed_email_id, domain_id, order_number, customer_name,
                pickup_location, delivery_location, weight, weight_unit,
                package_count, description, extracted_data, xml_generated, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
              extractedOrderId, processedEmailId, connection.domain_id,
              orderData.orderNumber || null, orderData.customerName || null,
              JSON.stringify({}), JSON.stringify({}), orderData.weight || null,
              orderData.weightUnit || 'kg', orderData.packageCount || null,
              orderData.description || subject, JSON.stringify(orderData), xml
            ]);

            this.logService.log('EMAIL_ORDER_EXTRACTED', 'Order extracted from email', {
              email: connection.email_address,
              subject,
              orderNumber: orderData.orderNumber,
              confidence: analysis.confidenceScore
            });
          }

          processedCount++;
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
