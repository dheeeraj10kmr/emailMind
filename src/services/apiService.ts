class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = '/api';
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private static instance: ApiService;

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = localStorage.getItem('auth_token');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  // Authentication methods
  async login(username: string, password: string) {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async setupPassword(token: string, password: string) {
    return this.request('/setup-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // User management methods
  async createUser(userData: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getAllClients() {
    return this.request('/users');
  }

  // Domain management methods
  async createDomain(domainData: any) {
    return this.request('/domains', {
      method: 'POST',
      body: JSON.stringify(domainData),
    });
  }

  async getAllDomains() {
    return this.request('/domains');
  }

  // Email configuration methods
  async configureEmail(emailConfig: any) {
    return this.request('/configure-email', {
      method: 'POST',
      body: JSON.stringify(emailConfig),
    });
  }

  async getEmailStatus() {
    return this.request('/email-status');
  }

  async testEmail(email: string) {
    return this.request('/test-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Database methods
  async testDatabaseConnection() {
    return this.request('/database-test');
  }

  async initializeDatabase() {
    return this.request('/initialize', {
      method: 'POST',
    });
  }

  // Email processing methods
  async startEmailProcessing() {
    return this.request('/email-processing/start', {
      method: 'POST',
    });
  }

  async getEmailProcessingStatus() {
    return this.request('/email-processing/status');
  }

  async getProcessedEmails() {
    return this.request('/processed-emails');
  }

  async getExtractedOrders() {
    return this.request('/extracted-orders');
  }

  async getLogs(limit = 100, logType = '') {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (logType) params.append('type', logType);
    
    const queryString = params.toString();
    return this.request(`/logs${queryString ? '?' + queryString : ''}`);
  }

  // Email connections methods
  async createEmailConnection(connectionData: any) {
    return this.request('/email-connections', {
      method: 'POST',
      body: JSON.stringify(connectionData),
    });
  }

  async getEmailConnections() {
    return this.request('/email-connections');
  }

  async updateEmailConnection(id: string, connectionData: any) {
    return this.request(`/email-connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(connectionData),
    });
  }

  async deleteEmailConnection(id: string) {
    return this.request(`/email-connections/${id}`, {
      method: 'DELETE',
    });
  }
}

export default ApiService;