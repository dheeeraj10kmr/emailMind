const DatabaseManager = require('../config/database.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const LogService = require('./logService.cjs');

// Simple UUID v4 generator function
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).replace(/-/g, '');
}

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
        this.logService.log('AUTH_LOGIN_USER_NOT_FOUND', 'User not found or inactive', { username });
        return null;
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        this.logService.log('AUTH_LOGIN_INVALID_PASSWORD', 'Invalid password provided', { username });
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
      this.logService.log('AUTH_LOGIN_ERROR', 'Login process failed', { username, error: error.message });
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
        this.logService.log('DOMAIN_CREATE_EXISTS', 'Domain already exists', { domainName });
        throw new Error('Domain already exists');
      }

      const domainId = generateUUID();
      
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
      this.logService.log('DOMAIN_CREATE_ERROR', 'Domain creation failed', { domainName, error: error.message });
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
      this.logService.log('DOMAIN_FETCH_ERROR', 'Failed to fetch domains', { error: error.message });
      throw error;
    }
  }

  async createUser(userData) {
    const db = DatabaseManager.getInstance();
    
    try {
      this.logService.log('USER_CREATE_START', 'Starting user creation', { username: userData.username });
      
      const userId = generateUUID();
      const setupToken = generateUUID();
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
          this.logService.log('USER_CREATE_DOMAIN_NOT_FOUND', 'Domain not found', { domain: userData.domain_name });
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
      this.logService.log('USER_CREATE_ERROR', 'User creation failed', { username: userData.username, error: error.message });
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
        this.logService.log('PASSWORD_SETUP_INVALID_TOKEN', 'Invalid or expired setup token', { setupToken });
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
      this.logService.log('PASSWORD_SETUP_ERROR', 'Password setup failed', { setupToken, error: error.message });
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
      this.logService.log('CLIENTS_FETCH_ERROR', 'Failed to fetch clients', { error: error.message });
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