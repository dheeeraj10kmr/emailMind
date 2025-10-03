// file: server/services/authService.cjs
const DatabaseManager = require('../config/database.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const LogService = require('./logService.cjs');
const crypto = require('crypto'); // Import crypto module

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'EmailMind-Production-2024-DiligentIX-a7b3c9d2e8f4g1h5i9j3k7l2m6n0p4q8';
    this.logService = LogService.getInstance();
  }

  static getInstance() {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async login(username, password) {
    const db = DatabaseManager.getInstance();
    
    try {
      this.logService.log('AUTH_LOGIN_START', 'Starting login process', { username });
      
      const result = await db.query(
        'SELECT u.*, d.domain_name FROM users u LEFT JOIN domains d ON u.domain_id = d.id WHERE u.username = ? AND u.is_active = true',
        [username]
      );

      if (result.rows.length === 0) {
        this.logService.log('AUTH_LOGIN_USER_NOT_FOUND', 'User not found or inactive', { username }, 'WARNING');
        return null;
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        this.logService.log('AUTH_LOGIN_INVALID_PASSWORD', 'Invalid password provided', { username }, 'WARNING');
        return null;
      }

      this.logService.log('AUTH_LOGIN_SUCCESS', 'User authenticated successfully', { username, role: user.role });

      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username, 
          role: user.role,
          domainId: user.domain_id,
          domainName: user.domain_name
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      const { password_hash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      this.logService.log('AUTH_LOGIN_ERROR', 'Login process failed', { username, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async createDomain(domainName, description = '') {
    const db = DatabaseManager.getInstance();
    
    try {
      this.logService.log('DOMAIN_CREATE_START', 'Starting domain creation', { domainName });
      
      // Check if domain already exists
      const existingDomain = await db.query(
        'SELECT id FROM domains WHERE domain_name = ?',
        [domainName]
      );

      if (existingDomain.rows.length > 0) {
        this.logService.log('DOMAIN_CREATE_EXISTS', 'Domain already exists', { domainName }, 'WARNING');
        throw new Error('Domain already exists');
      }

      const domainId = crypto.randomUUID().replace(/-/g, ''); // Use crypto.randomUUID()
      
      await db.query(`
        INSERT INTO domains (id, domain_name, description, is_active, created_at)
        VALUES (?, ?, ?, true, NOW())
      `, [domainId, domainName, description]);

      this.logService.log('DOMAIN_CREATE_SUCCESS', 'Domain created successfully', { domainName, domainId });

      return {
        domainId: domainId,
        id: domainId,
        domain_name: domainName,
        description,
        is_active: true,
        created_at: new Date()
      };
    } catch (error) {
      this.logService.log('DOMAIN_CREATE_ERROR', 'Domain creation failed', { domainName, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async getAllDomains() {
    const db = DatabaseManager.getInstance();
    
    try {
      this.logService.log('DOMAIN_FETCH_START', 'Fetching all domains');
      
      const result = await db.query(`
        SELECT d.*, COUNT(u.id) as user_count
        FROM domains d
        LEFT JOIN users u ON d.id = u.domain_id
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `);

      this.logService.log('DOMAIN_FETCH_SUCCESS', 'Domains fetched successfully', { count: result.rows.length });
      return result.rows;
    } catch (error) {
      this.logService.log('DOMAIN_FETCH_ERROR', 'Failed to fetch domains', { error: error.message }, 'ERROR');
      throw error;
    }
  }

async deleteDomain(domainId) {
    const db = DatabaseManager.getInstance();

    try {
      this.logService.log(
        'DOMAIN_DELETE_START',
        'Starting domain deletion',
        { domainId },
        'INFO',
        null,
        domainId
      );

      const domainResult = await db.query(
        'SELECT id, domain_name FROM domains WHERE id = ? LIMIT 1',
        [domainId]
      );

      if (!domainResult.rows || domainResult.rows.length === 0) {
        this.logService.log(
          'DOMAIN_DELETE_NOT_FOUND',
          'Domain not found for deletion',
          { domainId },
          'WARNING',
          null,
          domainId
        );
        const error = new Error('Domain not found');
        error.code = 'DOMAIN_NOT_FOUND';
        throw error;
      }

      const domainName = domainResult.rows[0].domain_name;

      // REPLACE your current cascadeDeletes array with this:
const cascadeDeletes = [
  { table: 'extracted_orders', sql: 'DELETE FROM extracted_orders WHERE domain_id = ?' },
  { table: 'processed_emails', sql: 'DELETE FROM processed_emails WHERE domain_id = ?' },
  { table: 'email_connections', sql: 'DELETE FROM email_connections WHERE domain_id = ?' },
  { table: 'domain_client_mail_map', sql: 'DELETE FROM domain_client_mail_map WHERE domain_id = ?' },
  { table: 'users', sql: 'DELETE FROM users WHERE domain_id = ?' }
];


      for (const step of cascadeDeletes) {
        try {
          this.logService.log(
            'DOMAIN_DELETE_STEP_START',
            'Starting cascading delete step',
            { domainId, table: step.table },
            'INFO',
            null,
            domainId
          );
          await db.query(step.sql, [domainId]);
          this.logService.log(
            'DOMAIN_DELETE_STEP_SUCCESS',
            'Completed cascading delete step',
            { domainId, table: step.table },
            'INFO',
            null,
            domainId
          );
        } catch (stepError) {
          if (stepError && stepError.code === 'ER_NO_SUCH_TABLE') {
            this.logService.log(
              'DOMAIN_DELETE_MISSING_TABLE',
              'Skipping missing table during domain deletion',
              {
                domainId,
                table: step.table
              },
              'WARNING',
              null,
              domainId
            );
            continue;
          }

          this.logService.log(
            'DOMAIN_DELETE_STEP_ERROR',
            'Failed during cascading delete',
            {
              domainId,
              table: step.table,
              error: stepError.message
            },
            'ERROR',
            null,
            domainId
          );
          throw stepError;
        }
      }

this.logService.log(
        'DOMAIN_DELETE_CASCADE_COMPLETE',
        'Completed all cascading delete steps',
        { domainId },
        'INFO',
        null,
        domainId
      );

      this.logService.log(
        'DOMAIN_DELETE_FINAL_STEP_START',
        'Deleting domain record from domains table',
        { domainId },
        'INFO',
        null,
        domainId
      );

      await db.query('DELETE FROM domains WHERE id = ?', [domainId]);

      this.logService.log(
        'DOMAIN_DELETE_SUCCESS',
        'Domain deleted successfully',
        {
          domainId,
          domainName
        },
        'INFO',
        null,
        domainId
      );

      return { domainId, domainName };
    } catch (error) {
      this.logService.log(
        'DOMAIN_DELETE_ERROR',
        'Domain deletion failed',
        { domainId, error: error.message },
        'ERROR',
        null,
        domainId
      );
      throw error;
    }
  }

  async createUser(userData) {
    const db = DatabaseManager.getInstance();
    
    try {
      this.logService.log('USER_CREATE_START', 'Starting user creation', { username: userData.username });
      
      const userId = crypto.randomUUID().replace(/-/g, ''); // Use crypto.randomUUID()
      const setupToken = crypto.randomUUID().replace(/-/g, ''); // Use crypto.randomUUID()
      const setupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Get domain ID if domain_name is provided
      let domainId = null;
      if (userData.domain_name) {
        const domainResult = await db.query(
          'SELECT id FROM domains WHERE domain_name = ?',
          [userData.domain_name]
        );
        
        if (domainResult.rows.length > 0) {
          domainId = domainResult.rows[0].id;
        } else {
          this.logService.log('USER_CREATE_DOMAIN_NOT_FOUND', 'Domain not found', { domain: userData.domain_name }, 'WARNING');
          throw new Error('Domain not found');
        }
      }

      const result = await db.query(`
        INSERT INTO users (
          id, username, email, company_name, role, domain_id, 
          setup_token, setup_token_expires, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, NOW())
      `, [
        userId, userData.username, userData.email, userData.company_name,
        userData.role, domainId, setupToken, setupTokenExpiry
      ]);

      // Get the created user
      const userResult = await db.query(
        'SELECT u.*, d.domain_name FROM users u LEFT JOIN domains d ON u.domain_id = d.id WHERE u.id = ?',
        [userId]
      );

      this.logService.log('USER_CREATE_SUCCESS', 'User created successfully', { username: userData.username, userId });

      return {
        user: userResult.rows[0],
        setupToken
      };
    } catch (error) {
      this.logService.log('USER_CREATE_ERROR', 'User creation failed', { username: userData.username, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async setupPassword(setupToken, password) {
    const db = DatabaseManager.getInstance();
    
    try {
      this.logService.log('PASSWORD_SETUP_START', 'Starting password setup', { setupToken });
      
      const tokenResult = await db.query(
        'SELECT id FROM users WHERE setup_token = ? AND setup_token_expires > NOW() AND is_active = false',
        [setupToken]
      );

      if (tokenResult.rows.length === 0) {
        this.logService.log('PASSWORD_SETUP_INVALID_TOKEN', 'Invalid or expired setup token', { setupToken }, 'WARNING');
        return false;
      }

      const userId = tokenResult.rows[0].id;
      const passwordHash = await bcrypt.hash(password, 12);

      await db.query(`
        UPDATE users 
        SET password_hash = ?, is_active = true, setup_token = NULL, setup_token_expires = NULL
        WHERE id = ?
      `, [passwordHash, userId]);

      this.logService.log('PASSWORD_SETUP_SUCCESS', 'Password setup completed', { userId });
      return true;
    } catch (error) {
      this.logService.log('PASSWORD_SETUP_ERROR', 'Password setup failed', { setupToken, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async getAllClients() {
    const db = DatabaseManager.getInstance();
    
    try {
      this.logService.log('CLIENTS_FETCH_START', 'Fetching all clients');
      
      const result = await db.query(`
        SELECT u.id, u.username, u.email, u.company_name, u.role, u.domain_id, u.is_active, u.created_at, d.domain_name
        FROM users u
        LEFT JOIN domains d ON u.domain_id = d.id
        WHERE role IN (?, ?)
        ORDER BY created_at DESC
      `, ['client_admin', 'user']);

      this.logService.log('CLIENTS_FETCH_SUCCESS', 'Clients fetched successfully', { count: result.rows.length });
      return result.rows;
    } catch (error) {
      this.logService.log('CLIENTS_FETCH_ERROR', 'Failed to fetch clients', { error: error.message }, 'ERROR');
      throw error;
    }
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }
}

module.exports = AuthService;
