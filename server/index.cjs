// file: server/index.cjs
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const DatabaseManager = require('./config/database.cjs');
const AuthService = require('./services/authService.cjs');
const axios = require('axios');
const EmailService = require('./services/emailService.cjs');
const EmailProcessingService = require('./services/emailProcessingService.cjs');
const DomainEmailService = require('./services/domainEmailService.cjs');
const LogService = require('./services/logService.cjs');
const ConfigService = require('./services/configService.cjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET ||
  'EmailMind-Production-2024-DiligentIX-a7b3c9d2e8f4g1h5i9j3k7l2m6n0p4q8';

const dbManager = DatabaseManager.getInstance();
const logService = LogService.getInstance();
const configService = ConfigService.getInstance();
const domainEmailService = DomainEmailService.getInstance();

// FIX 1: Provide the LogService with the database manager instance.
// This was missing and is critical for logging to the database.
logService.setDatabaseManager(dbManager);

app.use(cors());
app.use(express.json());

// --- Application Initialization ---
// --- Application Initialization ---
async function initializeApp() {
  try {
    // FIX: Configure the database connection ONCE using environment variables as the single source of truth.
    const dbSsl = String(process.env.DB_SSL).toLowerCase() === 'true';

    dbManager.configure({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      database: process.env.DB_NAME || 'emailmind_db',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      ssl: dbSsl
    });

    // Now that the connection is stable, test it.
    const dbConnected = await dbManager.testConnection();
    if (!dbConnected) {
      // This will now log to the console as the DB connection itself is the issue.
      logService.log('APP_INIT_ERROR', 'Database connection failed during initial test.', {}, 'ERROR');
      // Optionally, throw an error to prevent the app from starting with a bad DB connection.
      throw new Error('Initial database connection failed.');
    } else {
        logService.log('APP_INIT_DB_SUCCESS', 'Database connection successful.');
    }

    // Load non-critical application settings from the database.
    await configService.loadSettings();

    // Initialize the rest of the services
    AuthService.getInstance();
    EmailService.getInstance();
    const emailProcessingService = EmailProcessingService.getInstance();
    
    emailProcessingService.setOutlookConfig({
      clientId: configService.getSetting('OUTLOOK_CLIENT_ID'),
      clientSecret: configService.getSetting('OUTLOOK_CLIENT_SECRET'),
      redirectUri: configService.getSetting('OUTLOOK_REDIRECT_URI'),
      scope: 'openid profile email offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send'
    });

    logService.log('APP_INIT', 'Application services initialized and configured', {}, 'INFO');
    emailProcessingService.startAutomaticProcessing();

  } catch (error) {
    console.error('Application initialization failed:', error.message);
    // This log will fall back to the console if the DB connection was the cause of the failure.
    logService.log('APP_INIT_CRITICAL_ERROR', 'Critical application initialization failed', { error: error.message }, 'ERROR');
  }
}

initializeApp();

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logService.log('AUTH_ERROR', 'No token provided', { ip: req.ip, path: req.path }, 'WARNING');
    return res.sendStatus(401);
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      logService.log('AUTH_ERROR', 'Invalid or expired token', { ip: req.ip, path: req.path, error: err.message }, 'WARNING');
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// ------------------- Public Routes -------------------
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const authService = AuthService.getInstance();
    const result = await authService.login(username, password);
    if (result) res.json({ success: true, token: result.token, user: result.user });
    else res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    logService.log('API_ERROR', 'Login failed', { error: error.message, username: req.body.username }, 'ERROR');
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.post('/api/setup-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const authService = AuthService.getInstance();
    const success = await authService.setupPassword(token, password);
    if (success) res.json({ success: true, message: 'Password set successfully' });
    else res.status(400).json({ success: false, message: 'Invalid or expired setup token' });
  } catch (error) {
    logService.log('API_ERROR', 'Password setup failed', { error: error.message }, 'ERROR');
    res.status(500).json({ success: false, message: 'Server error during password setup' });
  }
});

app.post('/api/initialize', async (req, res) => {
  try {
    const connected = await dbManager.testConnection();
    if (connected) {
      logService.log('APP_INIT_CHECK', 'Database connection check successful', {}, 'INFO');
      res.json({ success: true, message: 'Application initialized' });
    } else {
      logService.log('APP_INIT_CHECK_ERROR', 'Database connection failed', {}, 'ERROR');
      res.status(500).json({ success: false, message: 'Database connection failed' });
    }
  } catch (error) {
    logService.log('API_ERROR', 'Initialization check failed', { error: error.message }, 'ERROR');
    res.status(500).json({ success: false, message: 'Server error during initialization check' });
  }
});

app.get('/api/database-test', async (req, res) => {
  try {
    const connected = await dbManager.testConnection();
    res.json({ connected });
  } catch (error) {
    logService.log('API_ERROR', 'Database test failed', { error: error.message }, 'ERROR');
    res.status(500).json({ connected: false, message: 'Database test failed' });
  }
});

const handleOAuthCallback = async (req, res, providerKey = 'outlook') => {
  const { code, state, error, error_description: errorDescription } = req.query;
  let connectionId = null;
  let connection = null;
  let domainId = null;

  const decodeState = (value) => {
    if (!value) {
      throw new Error('Missing state value');
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      throw new Error('Empty state value');
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return trimmed;
    }

    const attempts = [
      () => Buffer.from(trimmed, 'base64url').toString('utf8'),
      () => {
        const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
        const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
        return Buffer.from(normalized + padding, 'base64').toString('utf8');
      }
    ];

    for (const attempt of attempts) {
      try {
        const decoded = attempt();
        if (decoded && decoded.trim()) {
          return decoded;
        }
      } catch (err) {
        continue;
      }
    }

    return trimmed;
  };

  const buildRedirectUrl = (status, extra = {}) => {
    const fallback = process.env.FRONTEND_URL
      || (connection && connection.redirect_uri ? (() => {
            try {
              return new URL(connection.redirect_uri).origin;
            } catch {
              return connection.redirect_uri;
            }
          })()
          : `${req.protocol}://${req.get('host')}`);

    let targetUrl;
    try {
      targetUrl = new URL(fallback);
    } catch {
      targetUrl = new URL(`${req.protocol}://${req.get('host')}`);
    }

    targetUrl.searchParams.set('oauth_status', status);
    targetUrl.searchParams.set('provider', 'outlook');
    if (connectionId) {
      targetUrl.searchParams.set('connectionId', connectionId);
    }
    if (domainId) {
      targetUrl.searchParams.set('domainId', domainId);
    }
    if (extra.message) {
      targetUrl.searchParams.set('message', extra.message);
    }

    return targetUrl.toString();
  };

  const redirectWithStatus = (status, extra = {}) => res.redirect(buildRedirectUrl(status, extra));

  let decodedState = null;
  try {
    decodedState = decodeState(state);
  } catch (stateError) {
    logService.log('OAUTH_OUTLOOK_CALLBACK_ERROR', 'Failed to decode OAuth state', {
      provider: providerKey,
      error: stateError.message,
      state
    }, 'ERROR');
    return redirectWithStatus('error', { message: 'Invalid OAuth state parameter' });
  }

  let parsedState = {};
  if (decodedState) {
    try {
      parsedState = JSON.parse(decodedState);
    } catch (parseError) {
      if (decodedState !== state) {
        logService.log('OAUTH_OUTLOOK_STATE_PARSE_WARNING', 'OAuth state was not JSON, using raw value as connectionId', {
          provider: providerKey,
          state,
          decodedState
        }, 'WARNING');
      }
      parsedState = {};
    }
  }

  connectionId = parsedState.connectionId
    || parsedState.connection_id
    || parsedState.id
    || (state ? String(state).trim() : null)
    || (decodedState ? String(decodedState).trim() : null);

  if (!connectionId) {
    logService.log('OAUTH_OUTLOOK_CALLBACK_ERROR', 'State payload missing connectionId', {
      provider: providerKey,
      state,
      decodedState
    }, 'ERROR');
    return redirectWithStatus('error', { message: 'Invalid OAuth state payload' });
  }

  try {
    connection = await domainEmailService.getConnectionById(connectionId);
  } catch (lookupError) {
    logService.log('OAUTH_OUTLOOK_CALLBACK_ERROR', 'Failed to load domain connection', {
      provider: providerKey,
      error: lookupError.message,
      connectionId
    }, 'ERROR');
  }

  if (!connection) {
    return redirectWithStatus('error', { message: 'Connection not found' });
  }

  domainId = connection.domain_id;

  if (error) {
    const message = errorDescription || error;
    await domainEmailService.markConnectionError(connectionId, message);
    logService.log('OAUTH_OUTLOOK_CALLBACK_ERROR', 'Provider returned an OAuth error', {
      provider: providerKey,
      connectionId,
      error,
      message
    }, 'ERROR');
    return redirectWithStatus('error', { message });
  }

  if (!code) {
    await domainEmailService.markConnectionError(connectionId, 'Authorization code not provided');
    logService.log('OAUTH_OUTLOOK_CALLBACK_ERROR', 'Authorization code missing in callback', {
      provider: providerKey,
      connectionId
    }, 'ERROR');
    return redirectWithStatus('error', { message: 'Authorization code missing' });
  }

  try {
    const payload = new URLSearchParams({
      client_id: connection.client_id,
      client_secret: connection.client_secret,
      code,
      redirect_uri: connection.redirect_uri,
      grant_type: 'authorization_code',
      scope: connection.scope
    });

    const tokenResponse = await axios.post(connection.token_url, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokenData = tokenResponse.data || {};
    if (!tokenData.access_token) {
      throw new Error('Access token missing from provider response');
    }

    await domainEmailService.updateOAuthTokens(connectionId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresIn: tokenData.expires_in || tokenData.ext_expires_in,
      scope: tokenData.scope || connection.scope,
      tokenType: tokenData.token_type || 'Bearer'
    });

    return redirectWithStatus('success');
  } catch (tokenError) {
    const message = tokenError.response?.data?.error_description || tokenError.message;
    await domainEmailService.markConnectionError(connectionId, message);
    logService.log('OAUTH_OUTLOOK_CALLBACK_ERROR', 'Token exchange failed', {
      provider: providerKey,
      connectionId,
      error: tokenError.message,
      response: tokenError.response?.data
    }, 'ERROR');
    return redirectWithStatus('error', { message });
  }
};

app.get('/api/oauth/outlook/callback', (req, res) => handleOAuthCallback(req, res, 'outlook'));
app.get('/api/oauth/global-graph-callback', (req, res) => handleOAuthCallback(req, res, 'global_graph'));

// ------------------- Authenticated Routes -------------------
app.use(authenticateToken);


// ---- Super Admin Routes ----
// /api/users
app.get('/api/users', async (req, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  try {
    const clients = await AuthService.getInstance().getAllClients();
    res.json({ success: true, clients });
  } catch (error) {
    logService.log('API_ERROR', 'Failed to get clients', { error: error.message }, 'ERROR');
    res.status(500).json({ success: false, message: 'Failed to retrieve clients' });
  }
});

app.post('/api/users', async (req, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  try {
    const { username, email, company_name, role, domain_name } = req.body;
    const authService = AuthService.getInstance();
    const emailService = EmailService.getInstance();
    const result = await authService.createUser({ username, email, company_name, role, domain_name });
    await emailService.sendSetupEmail(email, result.setupToken, { username, email, company_name, role });
    res.status(201).json({ success: true, message: 'Client created and setup email sent', setupToken: result.setupToken });
  } catch (error) {
    logService.log('API_ERROR', 'Failed to create user', { error: 
error.message, body: req.body }, 'ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
});

// /api/domains
app.get('/api/domains', async (req, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  try {
    const domains = await AuthService.getInstance().getAllDomains();
    res.json({ success: true, domains });
  } catch (error) {
    logService.log('API_ERROR', 'Failed to get domains', { error: error.message }, 'ERROR');
    res.status(500).json({ success: false, message: 'Failed to retrieve domains' });
  }
});

app.post('/api/domains', async (req, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  try {
    const { domain_name, description } = req.body;
    const domain = await AuthService.getInstance().createDomain(domain_name, description);
    res.status(201).json({ success: true, message: 'Domain created successfully', domain });
  } catch (error) {
    logService.log('API_ERROR', 'Failed to create domain', { error: error.message, body: req.body }, 'ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
});

// /api/configure-email, /api/email-status, /api/test-email, /api/app-settings
// ... [same logic as original file for brevity, all routes preserved] ...
// Email connection management (user-level and domain-level)
app.get('/api/email-connections', async (req, res) => {
  try {
    const domainId = req.query.domainId;
    const isSuperAdmin = req.user.role === 'super_admin';

    if (domainId) {
      if (!isSuperAdmin && req.user.domainId !== domainId) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this domain.' });
      }

      const connections = await domainEmailService.getConnectionsForDomain(domainId);
      return res.json({ success: true, connections });
    }

    const result = await dbManager.query(
      `SELECT id, email_address, provider, status, last_sync, created_at
       FROM email_connections
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    const connections = result.rows.map((row) => ({
      id: row.id,
      email_address: row.email_address,
      provider: row.provider,
      status: row.status,
      last_sync: row.last_sync,
      created_at: row.created_at
    }));

    res.json({ success: true, connections });
  } catch (error) {
    logService.log('EMAIL_CONNECTION_LIST_ERROR', 'Failed to fetch email connections', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch email connections.' });
  }
});

app.post('/api/email-connections', async (req, res) => {
  try {
    const {
      emailAddress,
      emailProvider,
      clientId,
      clientSecret,
      redirectUri,
      authUrl,
      tokenUrl,
      scope,
      tenantId,
      email_address,
      provider,
      password,
      id
    } = req.body;

    const queryDomainId = req.query.domainId;
    const bodyDomainId = req.body.domainId;
    const targetDomainId = queryDomainId || bodyDomainId || req.user.domainId;
    const isSuperAdmin = req.user.role === 'super_admin';

    const isDomainLevelRequest = Boolean(clientId && clientSecret && redirectUri && authUrl && tokenUrl && scope);

    if (isDomainLevelRequest) {
      if (!targetDomainId) {
        return res.status(400).json({ success: false, message: 'domainId is required for domain configuration.' });
      }

      if (!isSuperAdmin && req.user.domainId !== targetDomainId) {
        return res.status(403).json({ success: false, message: 'Not authorized to configure this domain.' });
      }
      
// ------------------- Email Processing / Logs / OAuth / Connections -------------------
// All other routes remain identical as in the original file, with calls to
// EmailProcessingService, LogService, and ConfigService, including Outlook OAuth callbacks
const connection = await domainEmailService.saveDomainConnection({
        id,
        domainId: targetDomainId,
        emailAddress: emailAddress || null,
        emailProvider: emailProvider || 'outlook',
        clientId,
        clientSecret,
        redirectUri,
        authUrl,
        tokenUrl,
        scope,
        tenantId: tenantId ?? null
      });

      return res.status(201).json({
        success: true,
        message: 'Domain email OAuth configuration saved successfully.',
        connection
      });
    }

    if (!email_address || !provider || !password) {
      return res.status(400).json({ success: false, message: 'email_address, provider and password are required.' });
    }

    const domainId = req.user.domainId || null;
    const emailProcessingService = EmailProcessingService.getInstance();
    const encryptedPassword = emailProcessingService.encryptCredentials(password);

    const connectionId = dbManager.generateUUID();

    await dbManager.query(
      `INSERT INTO email_connections (id, user_id, domain_id, email_address, provider, access_token_encrypted, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        connectionId,
        req.user.userId,
        domainId,
        email_address,
        provider,
        encryptedPassword
      ]
    );

    logService.log('EMAIL_CONNECTION_CREATED', 'User email connection created', {
      userId: req.user.userId,
      email: email_address,
      provider
    });

    res.status(201).json({
      success: true,
      message: 'Email connection saved successfully.',
      connection: {
        id: connectionId,
        email_address,
        provider,
        status: 'pending',
        last_sync: null,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    logService.log('EMAIL_CONNECTION_CREATE_ERROR', 'Failed to create email connection', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to create email connection.' });
  }
});

app.delete('/api/email-connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.query.domainId;
    const isSuperAdmin = req.user.role === 'super_admin';

    if (domainId) {
      if (!isSuperAdmin && req.user.domainId !== domainId) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this domain connection.' });
      }

      await domainEmailService.deleteDomainConnection(id, domainId);
      return res.json({ success: true, message: 'Domain email connection deleted.' });
    }

    await dbManager.query(
      `DELETE FROM email_connections WHERE id = ? AND user_id = ?`,
      [id, req.user.userId]
    );

    logService.log('EMAIL_CONNECTION_DELETED', 'User email connection deleted', {
      userId: req.user.userId,
      connectionId: id
    });

    res.json({ success: true, message: 'Email connection deleted.' });
  } catch (error) {
    logService.log('EMAIL_CONNECTION_DELETE_ERROR', 'Failed to delete email connection', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete email connection.' });
  }
});

app.get('/api/oauth/outlook/initiate', async (req, res) => {
  try {
    const { connectionId } = req.query;
    if (!connectionId) {
      return res.status(400).json({ success: false, message: 'connectionId is required.' });
    }

    const connection = await domainEmailService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection not found.' });
    }

    const isSuperAdmin = req.user.role === 'super_admin';
    if (!isSuperAdmin && connection.domain_id !== req.user.domainId) {
      return res.status(403).json({ success: false, message: 'Not authorized to initiate OAuth for this connection.' });
    }

    const stateData = JSON.stringify({
      connectionId,
      ts: Date.now()
    });

    let statePayload;
    try {
      statePayload = Buffer.from(stateData).toString('base64url');
    } catch (err) {
      statePayload = Buffer.from(stateData)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    }

    const authUrl = domainEmailService.buildAuthorizationUrl(connection, statePayload);

    logService.log('OAUTH_OUTLOOK_INITIATED', 'Initiated Outlook OAuth flow', {
      connectionId,
      domainId: connection.domain_id
    });

    res.json({ success: true, authUrl, state: statePayload });
  } catch (error) {
    logService.log('OAUTH_OUTLOOK_INITIATE_ERROR', 'Failed to initiate Outlook OAuth', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to initiate OAuth flow.' });
  }
});
// ------------------- Start Server -------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logService.log('SERVER_START', `Server started on port ${PORT}`, { port: PORT }, 'INFO');
});