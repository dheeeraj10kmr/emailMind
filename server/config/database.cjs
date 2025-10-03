// file: server/config/database.cjs
const mysql = require('mysql2/promise');
const LogService = require('../services/logService.cjs'); // Import LogService

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.config = {};
    this.logService = LogService.getInstance(); // Get instance of LogService
    this.logService.setDatabaseManager(this); // bind back
  }

  static getInstance() {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  configure(config) {
    this.config = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      // only set ssl if enabled
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      // safe pool defaults
      waitForConnections: true,
      connectionLimit: 10,  // adjust based on workload
      queueLimit: 0
    };

    // Close existing pool if re-configuring
    if (this.pool) {
      this.pool.end()
        .then(() => {
          this.logService.log('DB_POOL_CLOSED', 'Old DB pool closed before reconfiguration', {}, 'INFO');
        })
        .catch(err => {
          this.logService.log('DB_POOL_CLOSE_ERROR', 'Error closing existing DB pool', { error: err.message }, 'WARNING');
        });
      this.pool = null;
    }

    this.pool = mysql.createPool(this.config);

    this.logService.log('DB_CONFIGURED', 'MySQL database configured', { 
      host: config.host, 
      port: config.port, 
      database: config.database, 
      user: config.username, 
      ssl: config.ssl 
    });
  }

  async testConnection() {
    if (!this.pool) {
      this.logService.log('DB_TEST_ERROR', 'Database not configured for connection test', {}, 'ERROR');
      return false;
    }

    try {
      const connection = await this.pool.getConnection();
      await connection.execute('SELECT 1');
      connection.release();
      this.logService.log('DB_TEST_SUCCESS', 'MySQL connection test successful', {}, 'INFO');
      return true;
    } catch (error) {
      this.logService.log('DB_TEST_FAILED', 'MySQL connection test failed', { error: error.message }, 'ERROR');
      return false;
    }
  }

  async query(text, params = []) {
    if (!this.pool) {
      this.logService.log('DB_QUERY_ERROR', 'Database not configured for query', { query: text }, 'ERROR');
      throw new Error('Database not configured');
    }

    try {
      const [rows] = await this.pool.execute(text, params);
      return { rows, rowsAffected: (rows.affectedRows !== undefined) ? rows.affectedRows : rows.length };
    } catch (error) {
      this.logService.log('DB_QUERY_FAILED', 'MySQL query error', { query: text, params, error: error.message }, 'ERROR');
      throw error;
    }
  }

  async getConnection() {
    if (!this.pool) {
      this.logService.log('DB_GET_CONNECTION_ERROR', 'Database not configured for getting connection', {}, 'ERROR');
      throw new Error('Database not configured');
    }
    return this.pool.getConnection();
  }

  async withConnection(callback) {
    const conn = await this.getConnection();
    try {
      return await callback(conn);
    } finally {
      conn.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.logService.log('DB_POOL_CLOSED', 'MySQL connection pool closed', {}, 'INFO');
    }
  }
}

module.exports = DatabaseManager;
