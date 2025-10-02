const mysql = require('mysql2/promise');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.config = {
      host: '103.191.208.49',
      port: 3306,
      database: 'bevhagfn_emailmind_db',
      user: 'bevhagfn_emailmind_user',
      password: 'DiliGentiX123456',
      ssl: false,
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true
    };
  }

  static getInstance() {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  configure(config) {
    console.log('Configuring MySQL database with:', { ...config, password: '***' });
    this.config = {
      host: config.host || '103.191.208.49',
      port: config.port || 3306,
      database: config.database || 'bevhagfn_emailmind_db',
      user: config.username || 'bevhagfn_emailmind_user',
      password: config.password || 'DiliGentiX123456',
      ssl: config.ssl || false,
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true
    };
    
    this.pool = mysql.createPool(this.config);
    
    // Test connection immediately
    this.testConnection().then(connected => {
      console.log('MySQL connection test result:', connected);
    }).catch(err => {
      console.error('MySQL connection test failed:', err);
    });
  }

  async initialize() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }
    
    try {
      await this.createTables();
      await this.createSuperAdmin();
      return { success: true };
    } catch (error) {
      console.error('Database initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  async createTables() {
    const tables = [
      // Domains table
      `CREATE TABLE IF NOT EXISTS domains (
        id VARCHAR(32) PRIMARY KEY,
        domain_name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(32) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        company_name VARCHAR(100) NOT NULL,
        role ENUM('super_admin', 'client_admin', 'user') NOT NULL,
        domain_id VARCHAR(32),
        setup_token VARCHAR(32),
        setup_token_expires DATETIME,
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (domain_id) REFERENCES domains(id)
      )`,
      
      // Email connections table
      `CREATE TABLE IF NOT EXISTS email_connections (
        id VARCHAR(32) PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL,
        domain_id VARCHAR(32) NOT NULL,
        email_address VARCHAR(100) NOT NULL,
        provider ENUM('outlook', 'gmail') NOT NULL,
        access_token_encrypted TEXT,
        refresh_token_encrypted TEXT,
        status ENUM('pending', 'connected', 'error', 'disconnected') DEFAULT 'pending',
        last_sync TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (domain_id) REFERENCES domains(id)
      )`,
      
      // Processed emails table
      `CREATE TABLE IF NOT EXISTS processed_emails (
        id VARCHAR(32) PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL,
        domain_id VARCHAR(32) NOT NULL,
        email_connection_id VARCHAR(32) NOT NULL,
        email_id VARCHAR(255) NOT NULL,
        subject TEXT,
        sender_email VARCHAR(100),
        received_date TIMESTAMP,
        processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        content_text LONGTEXT,
        has_attachments BOOLEAN DEFAULT FALSE,
        attachment_data JSON,
        is_logistics_order BOOLEAN DEFAULT FALSE,
        confidence_score DECIMAL(3,2) DEFAULT 0.00,
        keywords_found JSON,
        status ENUM('pending', 'completed', 'error') DEFAULT 'pending',
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (domain_id) REFERENCES domains(id),
        FOREIGN KEY (email_connection_id) REFERENCES email_connections(id)
      )`,
      
      // Extracted orders table
      `CREATE TABLE IF NOT EXISTS extracted_orders (
        id VARCHAR(32) PRIMARY KEY,
        processed_email_id VARCHAR(32) NOT NULL,
        domain_id VARCHAR(32) NOT NULL,
        order_number VARCHAR(100),
        customer_name VARCHAR(100),
        pickup_location JSON,
        delivery_location JSON,
        weight DECIMAL(10,2),
        weight_unit VARCHAR(10) DEFAULT 'kg',
        package_count INT,
        description TEXT,
        extracted_data JSON,
        xml_generated LONGTEXT,
        oracle_api_sent BOOLEAN DEFAULT FALSE,
        oracle_api_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (processed_email_id) REFERENCES processed_emails(id),
        FOREIGN KEY (domain_id) REFERENCES domains(id)
      )`,
      
      // System logs table
      `CREATE TABLE IF NOT EXISTS system_logs (
        id VARCHAR(32) PRIMARY KEY,
        domain_id VARCHAR(32),
        user_id VARCHAR(32),
        log_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        data JSON,
        level ENUM('ERROR', 'WARNING', 'INFO', 'DEBUG') DEFAULT 'INFO',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (domain_id) REFERENCES domains(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

      // OAuth state tracking table
      `CREATE TABLE IF NOT EXISTS oauth_states (
        nonce VARCHAR(128) PRIMARY KEY,
        domain_id VARCHAR(32),
        provider VARCHAR(50) NOT NULL,
        metadata JSON,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME DEFAULT NULL,
        FOREIGN KEY (domain_id) REFERENCES domains(id)
      )`
    ];

    for (const tableSQL of tables) {
      await this.query(tableSQL);
    }
  }

  async createSuperAdmin() {
    const bcrypt = require('bcryptjs');
    
    // Check if super admin exists
    const existing = await this.query(
      'SELECT id FROM users WHERE role = ? LIMIT 1',
      ['super_admin']
    );

    if (existing.rows.length === 0) {
      const adminId = this.generateUUID();
      const passwordHash = await bcrypt.hash('admin123', 12);
      
      await this.query(`
        INSERT INTO users (id, username, email, password_hash, company_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
      `, [adminId, 'admin', 'admin@emailmind.com', passwordHash, 'eMailMind System', 'super_admin']);
      
      console.log('Super admin created: username=admin, password=admin123');
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }).replace(/-/g, '');
  }

  async testConnection() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }

    try {
      const connection = await this.pool.getConnection();
      await connection.execute('SELECT 1');
      connection.release();
      return true;
    } catch (error) {
      console.error('MySQL connection test failed:', error);
      return false;
    }
  }

  async query(text, params = []) {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }

    try {
      const [rows] = await this.pool.execute(text, params);
      return { rows };
    } catch (error) {
      console.error('MySQL query error:', error);
      throw error;
    }
  }

  async getConnection() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }
    return this.pool.getConnection();
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = DatabaseManager;
