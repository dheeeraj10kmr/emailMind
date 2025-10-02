const DatabaseManager = require('../config/database.cjs');

// Simple UUID v4 generator function
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).replace(/-/g, '');
}

class LogService {
  constructor() {
    this.currentUser = null;
    this.currentDomain = null;
  }

  static getInstance() {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  setContext(userId, domainId) {
    this.currentUser = userId;
    this.currentDomain = domainId;
  }

  async log(logType, message, data = null, level = 'INFO', userId = null, domainId = null) {
    try {
      const db = DatabaseManager.getInstance();
      const logId = generateUUID();
      
      // Use provided IDs or fall back to context
      const finalUserId = userId || this.currentUser;
      const finalDomainId = domainId || this.currentDomain;
      
      await db.query(`
        INSERT INTO system_logs (id, domain_id, user_id, log_type, message, data, level, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        logId,
        finalDomainId,
        finalUserId,
        logType,
        message,
        data ? JSON.stringify(data) : null,
        level
      ]);

      // Also log to console for debugging
      console.log(`[${level}] ${logType}: ${message}`, data || '');
    } catch (error) {
      // Fallback to console if database logging fails
      console.error('Failed to write to database log:', error);
      console.log(`[${level}] ${logType}: ${message}`, data || '');
    }
  }

  async getLogs(limit = 100, logType = '', level = '', domainId = null, userRole = 'user') {
    try {
      const db = DatabaseManager.getInstance();
      let query = 'SELECT * FROM system_logs WHERE 1=1';
      const params = [];

      // Domain-based filtering for security
      if (userRole !== 'super_admin' && domainId) {
        query += ' AND domain_id = ?';
        params.push(domainId);
      }

      if (logType) {
        query += ' AND log_type LIKE ?';
        params.push(`%${logType}%`);
      }

      if (level) {
        query += ' AND level = ?';
        params.push(level);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  }

  async getLogStats(domainId = null, userRole = 'user') {
    try {
      const db = DatabaseManager.getInstance();
      let query = 'SELECT level, COUNT(*) as count FROM system_logs WHERE 1=1';
      const params = [];

      // Domain-based filtering for security
      if (userRole !== 'super_admin' && domainId) {
        query += ' AND domain_id = ?';
        params.push(domainId);
      }

      query += ' GROUP BY level';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Failed to retrieve log stats:', error);
      return [];
    }
  }
}

module.exports = LogService;