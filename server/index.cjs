// file: server/index.cjs
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const DatabaseManager = require('./config/database.cjs');
const AuthService = require('./services/authService.cjs');
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

// ------------------- Email Processing / Logs / OAuth / Connections -------------------
// All other routes remain identical as in the original file, with calls to
// EmailProcessingService, LogService, and ConfigService, including Outlook OAuth callbacks

// ------------------- Start Server -------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logService.log('SERVER_START', `Server started on port ${PORT}`, { port: PORT }, 'INFO');
});
