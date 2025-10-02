const express = require('express');
const cors = require('cors');
const path = require('path');
const DatabaseManager = require('./config/database.cjs');
const AuthService = require('./services/authService.cjs');
const EmailService = require('./services/emailService.cjs');
const EmailProcessingService = require('./services/emailProcessingService.cjs');
const DomainEmailService = require('./services/domainEmailService.cjs');
const LogService = require('./services/logService.cjs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize services
const db = DatabaseManager.getInstance();
const authService = AuthService.getInstance();
const emailService = EmailService.getInstance();
const emailProcessingService = EmailProcessingService.getInstance();
const logService = LogService.getInstance();
const domainEmailService = DomainEmailService.getInstance();

// Initialize database on startup
db.initialize().then(result => {
  if (result.success) {
    console.log('✅ Database initialized successfully');
    // Start automatic email processing
    emailProcessingService.startAutomaticProcessing(15); // Every 15 minutes
  } else {
    console.error('❌ Database initialization failed:', result.error);
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }

  req.user = decoded;
  logService.setContext(decoded.userId, decoded.domainId);
  next();
};

// Super admin middleware
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: 'Super admin access required' });
  }
  next();
};

// Routes

// Initialize database
app.post('/api/initialize', async (req, res) => {
  try {
    const result = await db.initialize();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test database connection
app.get('/api/database-test', async (req, res) => {
  try {
    const connected = await db.testConnection();
    res.json({ connected });
  } catch (error) {
    res.status(500).json({ connected: false, error: error.message });
  }
});

// Authentication routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    
    if (result) {
      res.json({ success: true, ...result });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/setup-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const success = await authService.setupPassword(token, password);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Domain management routes
app.get('/api/domains', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const domains = await authService.getAllDomains();
    res.json({ success: true, domains });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/domains', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { domain_name, description } = req.body;
    const domain = await authService.createDomain(domain_name, description);
    res.json({ success: true, domain });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// User management routes
app.get('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const clients = await authService.getAllClients();
    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const userData = req.body;
    const result = await authService.createUser(userData);
    
    // Send setup email
    const emailResult = await emailService.sendSetupEmail(
      userData.email,
      result.setupToken,
      userData
    );
    
    res.json({ 
      success: true, 
      user: result.user, 
      setupToken: result.setupToken,
      emailSent: emailResult.success
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Email configuration routes
app.post('/api/configure-email', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const emailConfig = req.body;
    const result = await emailService.configure(emailConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/email-status', authenticateToken, async (req, res) => {
  try {
    const status = emailService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/test-email', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    const result = await emailService.sendTestEmail(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// OAuth authorization for Microsoft Graph
app.post('/api/oauth/global-graph-authorize', authenticateToken, async (req, res) => {
  try {
    const { provider = 'microsoft_graph', redirectUri, connectionId, domainId: payloadDomainId } = req.body;

    const domainId = payloadDomainId || req.user.domainId || null;
    const metadata = {
      connectionId: connectionId || null,
      userId: req.user.userId,
      domainId,
      ...(redirectUri ? { redirectUri } : {})
    };

    const { authorizationUrl } = await domainEmailService.buildAuthorizationUrl({
      provider,
      domainId,
      redirectUri,
      metadata
    });

    res.json({ success: true, authorizationUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Microsoft Graph OAuth callback
app.get('/api/oauth/global-graph-callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    logService.log('OAUTH_CALLBACK_ERROR', 'OAuth callback returned an error', {
      error,
      errorDescription
    });
    return res.status(400).json({ success: false, error: errorDescription || error });
  }

  let context;
  try {
    context = await domainEmailService.consumeNonce(state);
  } catch (validationError) {
    return res.status(400).json({ success: false, error: validationError.message });
  }

  try {
    const tokens = await domainEmailService.exchangeAuthorizationCode(code, context);
    await domainEmailService.finalizeNonce(context.nonce);

    res.json({
      success: true,
      provider: context.provider,
      domainId: context.domainId,
      connectionId: context.metadata?.connectionId || null,
      tokensStored: Boolean(context.metadata?.connectionId && tokens?.access_token)
    });
  } catch (tokenError) {
    await domainEmailService.finalizeNonce(context.nonce);
    res.status(500).json({ success: false, error: tokenError.message });
  }
});
// Email connection routes
app.post('/api/email-connections', authenticateToken, async (req, res) => {
  try {
    const { email_address, provider, password } = req.body;
    const connectionId = db.generateUUID();
    
    // Encrypt the password
    const encryptedPassword = emailProcessingService.encryptCredentials(password);
    
    await db.query(`
      INSERT INTO email_connections (
        id, user_id, domain_id, email_address, provider, 
        access_token_encrypted, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      connectionId, req.user.userId, req.user.domainId, 
      email_address, provider, encryptedPassword
    ]);

    // Test the connection
    try {
      const connection = {
        id: connectionId,
        user_id: req.user.userId,
        domain_id: req.user.domainId,
        email_address,
        provider,
        access_token_encrypted: encryptedPassword
      };
      
      const client = await emailProcessingService.connectToEmail(connection);
      await client.logout();
      
      // Update status to connected
      await db.query(
        'UPDATE email_connections SET status = ? WHERE id = ?',
        ['connected', connectionId]
      );
      
      res.json({ success: true, message: 'Email connection created and tested successfully' });
    } catch (testError) {
      // Update status to error
      await db.query(
        'UPDATE email_connections SET status = ? WHERE id = ?',
        ['error', connectionId]
      );
      
      res.status(400).json({ 
        success: false, 
        error: 'Failed to connect to email: ' + testError.message 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/email-connections', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT id, email_address, provider, status, last_sync, created_at FROM email_connections WHERE 1=1';
    const params = [];
    
    // Domain-based filtering
    if (req.user.role !== 'super_admin') {
      query += ' AND domain_id = ?';
      params.push(req.user.domainId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await db.query(query, params);
    res.json({ success: true, connections: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/email-connections/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let query = 'DELETE FROM email_connections WHERE id = ?';
    const params = [id];
    
    // Domain-based filtering for security
    if (req.user.role !== 'super_admin') {
      query += ' AND domain_id = ?';
      params.push(req.user.domainId);
    }
    
    await db.query(query, params);
    res.json({ success: true, message: 'Email connection deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Email processing routes
app.post('/api/email-processing/start', authenticateToken, async (req, res) => {
  try {
    const result = await emailProcessingService.processAllConnections();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/email-processing/status', authenticateToken, async (req, res) => {
  try {
    const status = emailProcessingService.getProcessingStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Processed emails routes
app.get('/api/processed-emails', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT pe.*, ec.email_address 
      FROM processed_emails pe 
      JOIN email_connections ec ON pe.email_connection_id = ec.id 
      WHERE 1=1
    `;
    const params = [];
    
    // Domain-based filtering
    if (req.user.role !== 'super_admin') {
      query += ' AND pe.domain_id = ?';
      params.push(req.user.domainId);
    }
    
    query += ' ORDER BY pe.processed_date DESC LIMIT 100';
    
    const result = await db.query(query, params);
    res.json({ success: true, emails: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Extracted orders routes
app.get('/api/extracted-orders', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT eo.*, pe.subject, pe.sender_email, ec.email_address 
      FROM extracted_orders eo 
      JOIN processed_emails pe ON eo.processed_email_id = pe.id 
      JOIN email_connections ec ON pe.email_connection_id = ec.id 
      WHERE 1=1
    `;
    const params = [];
    
    // Domain-based filtering
    if (req.user.role !== 'super_admin') {
      query += ' AND eo.domain_id = ?';
      params.push(req.user.domainId);
    }
    
    query += ' ORDER BY eo.created_at DESC LIMIT 100';
    
    const result = await db.query(query, params);
    res.json({ success: true, orders: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// System logs routes
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, type = '', level = '' } = req.query;
    const logs = await logService.getLogs(
      parseInt(limit), 
      type, 
      level, 
      req.user.domainId, 
      req.user.role
    );
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../emailmind')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../emailmind/index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 eMailMind server running on port ${PORT}`);
  console.log(`📧 Email processing service started`);
  console.log(`🔗 Oracle API endpoint: ${emailProcessingService.oracleApiUrl}`);
});

module.exports = app;
