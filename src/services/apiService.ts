// file: src/services/apiService.ts
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
    try {
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
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }

        // Return error in a format the frontend expects
        return {
          success: false,
          message: errorData.message || `HTTP error! status: ${response.status}`,
          status: response.status
        };
      }

      const data = await response.json();
      // Ensure we always have a success field
      if (data.success === undefined) {
        data.success = true;
      }
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
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

 async deleteDomain(id: string) {
  return this.request(`/domains/${id}/delete`, {
    method: 'POST',
  });
}


  // Removed domain-smtp-settings methods

  // Removed global SMTP configuration methods

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
 private getStoredDomainId(): string | null {
    const storedUser = localStorage.getItem('user_data');
    if (!storedUser) {
      return null;
    }

    try {
      const parsed = JSON.parse(storedUser);
      return parsed.domain_id || parsed.domainId || null;
    } catch (error) {
      console.warn('Unable to parse stored user data for domain lookup', error);
      return null;
    }
  }

  async startEmailProcessing(domainId?: string) {
    const targetDomainId = domainId ?? this.getStoredDomainId();

    if (!targetDomainId) {
      return {
        success: false,
        message: 'Domain ID is required to process emails but none was provided.'
      };
    }

    const encodedDomainId = encodeURIComponent(targetDomainId);

    return this.request(`/domains/${encodedDomainId}/emails/process-latest`, {
    method: 'POST',
  });
}


  async getEmailProcessingStatus() {
    return this.request('/email-processing/status');
  }

  async getProcessedEmails(domainId?: string) { // Added optional domainId
    const query = domainId ? `?domainId=${domainId}` : '';
    return this.request(`/processed-emails${query}`);
  }

  async getExtractedOrders(domainId?: string) { // Added optional domainId
    const query = domainId ? `?domainId=${domainId}` : '';
    return this.request(`/extracted-orders${query}`);
  }

  async getLogs(limit = 100, logType = '') {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (logType) params.append('type', logType);
    
    const queryString = params.toString();
    return this.request(`/logs${queryString ? '?' + queryString : ''}`);
  }

  // Application Settings methods
  async getAppSettings() {
    return this.request('/app-settings');
  }

  async updateAppSetting(key: string, value: string, isSensitive: boolean) {
    return this.request('/app-settings', {
      method: 'POST',
      body: JSON.stringify({ key, value, isSensitive }),
    });
  }

  // Email connections methods (for Client Admin/User AND Super Admin)
  // Super Admin can pass domainId to manage connections for other domains
  async initiateOutlookOAuth(connectionId: string) { // Now takes connectionId
														  
    return this.request(`/oauth/outlook/initiate?connectionId=${connectionId}`);
  }

  // createEmailConnection is now for saving the initial per-domain OAuth app credentials
  async createEmailConnection(connectionData: {
    domainId: string;
    emailAddress: string;
    emailProvider: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authUrl: string; // NEW
    tokenUrl: string; // NEW
    scope: string;    // NEW
  }) {
    return this.request(`/email-connections?domainId=${connectionData.domainId}`, {
      method: 'POST',
      body: JSON.stringify(connectionData),
    });
  }

  async getEmailConnections(domainId?: string) {
    const query = domainId ? `?domainId=${domainId}` : '';
    return this.request(`/email-connections${query}`);
  }

  async deleteEmailConnection(id: string, domainId?: string) {
    const query = domainId ? `?domainId=${domainId}` : '';
    return this.request(`/email-connections/${id}${query}`, {
      method: 'DELETE',
    });
  }
}

export default ApiService;
