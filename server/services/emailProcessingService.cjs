const { ImapFlow } = require('imapflow');
const DatabaseManager = require('../config/database.cjs');
const LogService = require('./logService.cjs');
const crypto = require('crypto');
const axios = require('axios');

// Simple UUID v4 generator function
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).replace(/-/g, '');
}

class EmailProcessingService {
  constructor() {
    this.logService = LogService.getInstance();
    this.isProcessing = false;
    this.processingInterval = null;
    
    // Comprehensive logistics keywords in English and Dutch
    this.logisticsKeywords = [
      // English keywords
      'order', 'orders', 'purchase order', 'po', 'sales order', 'so', 'shipment', 'consignment', 
      'dispatch', 'fulfillment', 'tracking', 'waybill', 'bill of lading', 'packing list', 
      'delivery note', 'incoterms', 'carrier', 'freight forwarder', 'logistics provider', 
      '3pl', 'haulier', 'trucking company', 'courier', 'linehaul', 'freight', 'cargo', 
      'transport mode', 'road', 'rail', 'air', 'sea', 'pallet', 'euro pallet', 'epal', 
      'chep pallet', 'crate', 'carton', 'box', 'load unit', 'package', 'case', 'container',
      'gross weight', 'net weight', 'tare weight', 'chargeable weight', 'cubic meter', 
      'cbm', 'volume', 'density', 'capacity', 'order date', 'shipment date', 'delivery date',
      'pick-up date', 'pickup date', 'transit time', 'lead time', 'eta', 'etd', 
      'estimated time of arrival', 'estimated time of departure', 'truck', 'trailer', 
      'forklift', 'reach stacker', 'crane', 'conveyor', 'loading dock', 'warehouse', 
      'hub', 'delivery', 'consignee', 'consignor', 'shipper', 'final mile', 'drop-off', 
      'pick-up', 'pickup', 'proof of delivery', 'pod', 'transport', 'logistics', 
      'distribution', 'supply chain',
      
      // Dutch keywords
      'bestelling', 'inkooporder', 'verkooporder', 'zending', 'verzending', 'consignatie', 
      'goederenpartij', 'uitzending', 'orderverwerking', 'volgen', 'vrachtbrief', 
      'cognossement', 'paklijst', 'leveringsbon', 'vervoerder', 'expediteur', 
      'logistieke dienstverlener', 'transporteur', 'koerier', 'lijndienst', 'vracht', 
      'lading', 'goederen', 'transportwijze', 'wegvervoer', 'spoorvervoer', 'luchtvracht', 
      'zeevracht', 'europallet', 'chep-pallet', 'krat', 'kist', 'doos', 'karton', 
      'laadeenheid', 'pakket', 'colli', 'brutogewicht', 'nettogewicht', 'tarra gewicht', 
      'berekeningsgewicht', 'kubieke meter', 'inhoud', 'dichtheid', 'capaciteit', 
      'besteldatum', 'verzenddatum', 'leverdatum', 'ophaaldatum', 'doorlooptijd', 
      'transporttijd', 'levertijd', 'verwachte aankomsttijd', 'verwachte vertrektijd', 
      'vrachtwagen', 'aanhangwagen', 'heftruck', 'reachstacker', 'kraan', 'transportband', 
      'laadperron', 'magazijn', 'distributiecentrum', 'dc', 'levering', 'bezorging', 
      'ontvanger', 'verzender', 'afzender', 'laatste kilometer', 'aflevering', 'ophalen', 
      'afleverbewijs'
    ];

    // Oracle API endpoint
    this.oracleApiUrl = 'https://design.integration.eu-frankfurt-1.ocp.oraclecloud.com/?integrationInstance=rsk-dev-oic-frkpvjuqpmjx-fr';
  }

  static getInstance() {
    if (!EmailProcessingService.instance) {
      EmailProcessingService.instance = new EmailProcessingService();
    }
    return EmailProcessingService.instance;
  }

  // Decrypt stored credentials
  decryptCredentials(encryptedData) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync('emailmind-encryption-key-2024', 'salt', 32);
      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logService.log('EMAIL_DECRYPT_ERROR', 'Failed to decrypt credentials', { error: error.message });
      return null;
    }
  }

  // Encrypt credentials for storage
  encryptCredentials(data) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync('emailmind-encryption-key-2024', 'salt', 32);
      const cipher = crypto.createCipher(algorithm, key);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      this.logService.log('EMAIL_ENCRYPT_ERROR', 'Failed to encrypt credentials', { error: error.message });
      return null;
    }
  }

  // Connect to email provider using app password
  async connectToEmail(connection) {
    try {
      this.logService.log('EMAIL_CONNECT_START', 'Starting email connection', { 
        email: connection.email_address, 
        provider: connection.provider 
      });

      let imapConfig;
      const password = this.decryptCredentials(connection.access_token_encrypted);
      
      if (connection.provider === 'outlook') {
        imapConfig = {
          host: 'outlook.office365.com',
          port: 993,
          secure: true,
          auth: {
            user: connection.email_address,
            pass: password
          }
        };
      } else if (connection.provider === 'gmail') {
        imapConfig = {
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          auth: {
            user: connection.email_address,
            pass: password
          }
        };
      }

      const client = new ImapFlow(imapConfig);
      await client.connect();
      
      this.logService.log('EMAIL_CONNECT_SUCCESS', 'Email connection established', { 
        email: connection.email_address 
      });
      
      return client;
    } catch (error) {
      this.logService.log('EMAIL_CONNECT_ERROR', 'Email connection failed', { 
        email: connection.email_address, 
        error: error.message 
      });
      throw error;
    }
  }

  // AI-powered logistics detection with English and Dutch keywords
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
        foundKeywords: foundKeywords.slice(0, 10) // Log first 10 keywords
      });

      return {
        isLogisticsOrder,
        confidenceScore,
        foundKeywords
      };
    } catch (error) {
      this.logService.log('EMAIL_AI_ANALYSIS_ERROR', 'Email analysis failed', { error: error.message });
      return {
        isLogisticsOrder: false,
        confidenceScore: 0,
        foundKeywords: []
      };
    }
  }

  // Extract text from PDF and Word attachments
  async extractAttachmentText(attachments) {
    let extractedText = '';
    
    for (const attachment of attachments) {
      try {
        if (attachment.contentType === 'application/pdf') {
          // For PDF extraction, you would need pdf-parse library
          // For now, we'll log that PDF was found
          this.logService.log('EMAIL_PDF_FOUND', 'PDF attachment found', { 
            filename: attachment.filename 
          });
          extractedText += ` PDF_CONTENT_${attachment.filename} `;
        } else if (attachment.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   attachment.contentType === 'application/msword') {
          // For Word extraction, you would need mammoth library
          // For now, we'll log that Word document was found
          this.logService.log('EMAIL_WORD_FOUND', 'Word document found', { 
            filename: attachment.filename 
          });
          extractedText += ` WORD_CONTENT_${attachment.filename} `;
        }
      } catch (error) {
        this.logService.log('EMAIL_ATTACHMENT_EXTRACT_ERROR', 'Failed to extract attachment text', {
          filename: attachment.filename,
          error: error.message
        });
      }
    }
    
    return extractedText;
  }

  // Extract comprehensive order information from email
  extractOrderInformation(emailContent, subject, attachmentText = '') {
    try {
      const content = (emailContent + ' ' + subject + ' ' + attachmentText).toLowerCase();
      const extractedData = {};

      // Extract order number (multiple patterns)
      const orderNumberPatterns = [
        /order\s*#?\s*(\w+)/i,
        /order\s*number\s*:?\s*(\w+)/i,
        /bestelling\s*#?\s*(\w+)/i,
        /ref\s*:?\s*(\w+)/i,
        /reference\s*:?\s*(\w+)/i,
        /po\s*#?\s*(\w+)/i,
        /so\s*#?\s*(\w+)/i
      ];

      for (const pattern of orderNumberPatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.orderNumber = match[1];
          break;
        }
      }

      // Extract weight information (English and Dutch)
      const weightPatterns = [
        /(\d+(?:\.\d+)?)\s*(kg|kilograms?|lbs?|pounds?|tons?|ton)/i,
        /weight\s*:?\s*(\d+(?:\.\d+)?)/i,
        /gewicht\s*:?\s*(\d+(?:\.\d+)?)/i,
        /brutogewicht\s*:?\s*(\d+(?:\.\d+)?)/i,
        /nettogewicht\s*:?\s*(\d+(?:\.\d+)?)/i
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
        /(\d+)\s*items?/i,
        /(\d+)\s*pallets?/i,
        /(\d+)\s*colli/i,
        /(\d+)\s*dozen/i,
        /(\d+)\s*pakketten/i
      ];

      for (const pattern of packagePatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.packageCount = parseInt(match[1]);
          break;
        }
      }

      // Extract customer name
      const customerPatterns = [
        /customer\s*:?\s*([^\n\r]+)/i,
        /client\s*:?\s*([^\n\r]+)/i,
        /company\s*:?\s*([^\n\r]+)/i,
        /klant\s*:?\s*([^\n\r]+)/i,
        /bedrijf\s*:?\s*([^\n\r]+)/i,
        /consignee\s*:?\s*([^\n\r]+)/i,
        /ontvanger\s*:?\s*([^\n\r]+)/i
      ];

      for (const pattern of customerPatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.customerName = match[1].trim();
          break;
        }
      }

      // Extract addresses
      const addressPatterns = [
        /delivery\s*address\s*:?\s*([^\n\r]+)/i,
        /pickup\s*address\s*:?\s*([^\n\r]+)/i,
        /from\s*address\s*:?\s*([^\n\r]+)/i,
        /to\s*address\s*:?\s*([^\n\r]+)/i,
        /leveringsadres\s*:?\s*([^\n\r]+)/i,
        /ophaaladres\s*:?\s*([^\n\r]+)/i
      ];

      extractedData.addresses = [];
      addressPatterns.forEach(pattern => {
        const match = content.match(pattern);
        if (match) {
          extractedData.addresses.push(match[1].trim());
        }
      });

      // Extract dates
      const datePatterns = [
        /delivery\s*date\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        /pickup\s*date\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        /leverdatum\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        /ophaaldatum\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
      ];

      extractedData.dates = [];
      datePatterns.forEach(pattern => {
        const match = content.match(pattern);
        if (match) {
          extractedData.dates.push(match[1]);
        }
      });

      this.logService.log('EMAIL_ORDER_EXTRACTION', 'Order information extracted', extractedData);

      return extractedData;
    } catch (error) {
      this.logService.log('EMAIL_ORDER_EXTRACTION_ERROR', 'Order extraction failed', { error: error.message });
      return {};
    }
  }

  // Generate XML in the specified Oracle format
  generateOrderXML(orderData) {
    try {
      const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<orders xmlns="http://schema.nabek.com/webtor/import">
  <order>
    <customerid>50144</customerid>
    <reference>${orderData.orderNumber || 'AUTO_' + Date.now()}</reference>
    <goods_description>${orderData.description || 'Logistics shipment'}</goods_description>
    <from_name>${orderData.fromName || 'SENDER'}</from_name>
    <from_address>${orderData.fromAddress || 'PICKUP ADDRESS'}</from_address>
    <from_postalcode>${orderData.fromPostalCode || '0000'}</from_postalcode>
    <from_city>${orderData.fromCity || 'PICKUP CITY'}</from_city>
    <from_countryid>${orderData.fromCountry || 'NL'}</from_countryid>
    <to_name>${orderData.customerName || 'RECEIVER'}</to_name>
    <to_address>${orderData.toAddress || 'DELIVERY ADDRESS'}</to_address>
    <to_postalcode>${orderData.toPostalCode || '0000'}</to_postalcode>
    <to_city>${orderData.toCity || 'DELIVERY CITY'}</to_city>
    <to_countryid>${orderData.toCountry || 'NL'}</to_countryid>
    <from_date>${currentDate}</from_date>
    <to_date>${currentDate}</to_date>
    <shipunits>
      <shipunit>
        <goods_description>
          <transporthandlingunit>EURO_PALLET</transporthandlingunit>
          <packageditem>GENERAL_GOODS</packageditem>
          <article_number>${orderData.articleNumber || 'AUTO_' + Date.now()}</article_number>
          <description>${orderData.description || 'Logistics shipment'}</description>
          <packagecount>${orderData.packageCount || 1}</packagecount>
          <lengthdetails>
            <lengthuom>M</lengthuom>
            <length>${orderData.length || 1.3}</length>
          </lengthdetails>
          <widthdetails>
            <widthuom>M</widthuom>
            <width>${orderData.width || 0.8}</width>
          </widthdetails>
          <heightdetails>
            <heightuom>M</heightuom>
            <height>${orderData.height || 0.2}</height>
          </heightdetails>
          <weightdetails>
            <weightuom>${orderData.weightUnit || 'KG'}</weightuom>
            <weight>${orderData.weight || 100}</weight>
          </weightdetails>
        </goods_description>
      </shipunit>
    </shipunits>
    <ordertotalweight>${orderData.weight || 100}</ordertotalweight>
    <ordertotalweightuom>${orderData.weightUnit || 'KG'}</ordertotalweightuom>
    <length>${orderData.length || 1.3}</length>
    <length_uom>M</length_uom>
    <width>${orderData.width || 0.8}</width>
    <width_uom>M</width_uom>
    <height>${orderData.height || 0.2}</height>
    <height_uom>M</height_uom>
    <loading_remarks>loading</loading_remarks>
    <unloading_remarks>unloading</unloading_remarks>
    <status>1</status>
  </order>
</orders>`;

      this.logService.log('EMAIL_XML_GENERATION', 'XML generated for order', { 
        orderNumber: orderData.orderNumber 
      });

      return xml;
    } catch (error) {
      this.logService.log('EMAIL_XML_GENERATION_ERROR', 'XML generation failed', { error: error.message });
      return null;
    }
  }

  // Send XML to Oracle API
  async sendToOracleAPI(xml, orderData) {
    try {
      this.logService.log('ORACLE_API_SEND_START', 'Sending XML to Oracle API', {
        orderNumber: orderData.orderNumber
      });

      const response = await axios.post(this.oracleApiUrl, xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Accept': 'application/xml'
        },
        timeout: 30000
      });

      this.logService.log('ORACLE_API_SEND_SUCCESS', 'XML sent to Oracle API successfully', {
        orderNumber: orderData.orderNumber,
        status: response.status,
        response: response.data
      });

      return {
        success: true,
        status: response.status,
        response: response.data
      };

    } catch (error) {
      this.logService.log('ORACLE_API_SEND_ERROR', 'Failed to send XML to Oracle API', {
        orderNumber: orderData.orderNumber,
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        response: error.response?.data
      };
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

      client = await this.connectToEmail(connection);
      
      // Select INBOX
      await client.mailboxOpen('INBOX');
      
      // Get recent emails (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const messages = await client.fetch({
        since: yesterday
      }, {
        envelope: true,
        bodyText: true,
        headers: true,
        bodyStructure: true
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

          // Check if already processed
          const existingEmail = await db.query(
            'SELECT id FROM processed_emails WHERE email_id = ? AND domain_id = ?',
            [emailId, connection.domain_id]
          );

          if (existingEmail.rows.length > 0) {
            continue; // Skip already processed emails
          }

          // Check for attachments
          let hasAttachments = false;
          let attachmentData = [];
          let attachmentText = '';

          if (message.bodyStructure && message.bodyStructure.childNodes) {
            for (const node of message.bodyStructure.childNodes) {
              if (node.disposition === 'attachment') {
                hasAttachments = true;
                attachmentData.push({
                  filename: node.dispositionParameters?.filename || 'unknown',
                  contentType: node.type + '/' + node.subtype,
                  size: node.size
                });

                // Extract text from PDF/Word attachments
                if (node.type === 'application') {
                  attachmentText += await this.extractAttachmentText([{
                    filename: node.dispositionParameters?.filename || 'unknown',
                    contentType: node.type + '/' + node.subtype
                  }]);
                }
              }
            }
          }

          // Analyze email for logistics content (including attachment text)
          const analysis = this.analyzeEmailForLogistics(contentText + ' ' + subject + ' ' + attachmentText);
          
          // Store processed email
          const processedEmailId = generateUUID();
          await db.query(`
            INSERT INTO processed_emails (
              id, user_id, domain_id, email_connection_id, email_id, subject, 
              sender_email, received_date, processed_date, content_text, 
              has_attachments, attachment_data, is_logistics_order, confidence_score, 
              keywords_found, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)
          `, [
            processedEmailId, connection.user_id, connection.domain_id, 
            connection.id, emailId, subject, senderEmail, receivedDate, 
            contentText, hasAttachments, JSON.stringify(attachmentData), 
            analysis.isLogisticsOrder, analysis.confidenceScore,
            JSON.stringify(analysis.foundKeywords), 'completed'
          ]);

          // If it's a logistics order, extract order information
          if (analysis.isLogisticsOrder) {
            const orderData = this.extractOrderInformation(contentText, subject, attachmentText);
            const xml = this.generateOrderXML(orderData);

            // Send to Oracle API
            const oracleResult = await this.sendToOracleAPI(xml, orderData);

            // Store extracted order
            const extractedOrderId = generateUUID();
            await db.query(`
              INSERT INTO extracted_orders (
                id, processed_email_id, domain_id, order_number, customer_name,
                pickup_location, delivery_location, weight, weight_unit,
                package_count, description, extracted_data, xml_generated, 
                oracle_api_sent, oracle_api_response, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
              extractedOrderId, processedEmailId, connection.domain_id,
              orderData.orderNumber || null, orderData.customerName || null,
              JSON.stringify(orderData.addresses || []), JSON.stringify(orderData.dates || []), 
              orderData.weight || null, orderData.weightUnit || 'kg', 
              orderData.packageCount || null, orderData.description || subject, 
              JSON.stringify(orderData), xml, oracleResult.success,
              JSON.stringify(oracleResult)
            ]);

            this.logService.log('EMAIL_ORDER_EXTRACTED', 'Order extracted and sent to Oracle', {
              email: connection.email_address,
              subject,
              orderNumber: orderData.orderNumber,
              confidence: analysis.confidenceScore,
              oracleSent: oracleResult.success
            });
          }

          processedCount++;
        } catch (emailError) {
          this.logService.log('EMAIL_PROCESS_EMAIL_ERROR', 'Failed to process individual email', {
            error: emailError.message,
            subject: message.envelope?.subject
          });
        }
      }

      // Update connection last sync
      await db.query(
        'UPDATE email_connections SET last_sync = NOW(), status = ? WHERE id = ?',
        ['connected', connection.id]
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
      });

      // Update connection status to error
      const db = DatabaseManager.getInstance();
      await db.query(
        'UPDATE email_connections SET status = ? WHERE id = ?',
        ['error', connection.id]
      );

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

  // Process all active email connections
  async processAllConnections() {
    if (this.isProcessing) {
      this.logService.log('EMAIL_PROCESS_SKIP', 'Email processing already in progress');
      return { success: false, message: 'Processing already in progress' };
    }

    this.isProcessing = true;
    
    try {
      this.logService.log('EMAIL_PROCESS_ALL_START', 'Starting processing for all connections');

      const db = DatabaseManager.getInstance();
      const result = await db.query(`
        SELECT * FROM email_connections 
        WHERE status IN ('connected', 'error') 
        AND access_token_encrypted IS NOT NULL
      `);

      const connections = result.rows;
      let totalProcessed = 0;
      let successCount = 0;

      for (const connection of connections) {
        try {
          const result = await this.processEmailsFromConnection(connection);
          if (result.success) {
            totalProcessed += result.processedCount;
            successCount++;
          }
        } catch (connectionError) {
          this.logService.log('EMAIL_PROCESS_CONNECTION_ERROR', 'Failed to process connection', {
            email: connection.email_address,
            error: connectionError.message
          });
        }
      }

      this.logService.log('EMAIL_PROCESS_ALL_SUCCESS', 'All connections processed', {
        connectionsCount: connections.length,
        successCount,
        totalProcessed
      });

      return {
        success: true,
        connectionsCount: connections.length,
        successCount,
        totalProcessed
      };

    } catch (error) {
      this.logService.log('EMAIL_PROCESS_ALL_ERROR', 'Failed to process all connections', {
        error: error.message
      });
      return { success: false, error: error.message };
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
    });

    this.processingInterval = setInterval(() => {
      this.processAllConnections();
    }, intervalMinutes * 60 * 1000);

    // Process immediately
    this.processAllConnections();
  }

  // Stop automatic processing
  stopAutomaticProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      
      this.logService.log('EMAIL_AUTO_PROCESS_STOP', 'Automatic email processing stopped');
    }
  }

  // Get processing status
  getProcessingStatus() {
    return {
      isProcessing: this.isProcessing,
      automaticProcessing: this.processingInterval !== null
    };
  }
}

module.exports = EmailProcessingService;