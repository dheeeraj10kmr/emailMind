import React, { useState, useEffect } from 'react';
import { Users, Plus, Mail, Settings, Shield, Database, Globe, Send, CheckCircle, XCircle } from 'lucide-react';
import ApiService from '../services/apiService';

interface User {
  id: string;
  username: string;
  email: string;
  company_name: string;
  role: 'client_admin' | 'user';
  is_active: boolean;
  created_at: string;
  domain_name?: string;
}

interface Domain {
  id: string;
  domain_name: string;
  description: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const [clients, setClients] = useState<User[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [newClient, setNewClient] = useState({
    username: '',
    email: '',
    company_name: '',
    role: 'client_admin' as 'client_admin' | 'user',
    domain_name: ''
  });
  const [newDomain, setNewDomain] = useState({
    domain_name: '',
    description: ''
  });
  const [emailConfig, setEmailConfig] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    password: ''
  });

  useEffect(() => {
    loadClients();
    loadDomains();
    checkDatabaseConnection();
    checkEmailStatus();
  }, []);

  const checkDatabaseConnection = async () => {
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.testDatabaseConnection();
      setDbConnected(result.connected);
    } catch (error) {
      setDbConnected(false);
    }
  };

  const checkEmailStatus = async () => {
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.getEmailStatus();
      setEmailConfigured(result.configured && result.connectionTest);
    } catch (error) {
      setEmailConfigured(false);
    }
  };

  const loadClients = async () => {
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.getAllClients();
      setClients(result.clients);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const loadDomains = async () => {
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.getAllDomains();
      setDomains(result.domains);
    } catch (error) {
      console.error('Failed to load domains:', error);
    }
  };

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.createDomain(newDomain);
      
      if (result.success) {
        alert('Domain created successfully!');
        
        setNewDomain({
          domain_name: '',
          description: ''
        });
        setShowDomainForm(false);
        loadDomains();
      } else {
        alert(`Failed to create domain: ${result.error || result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create domain:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create domain: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.createUser(newClient);
      
      if (result.success) {
        // Generate the correct setup link
        const currentOrigin = window.location.origin;
        const setupLink = `${currentOrigin}/setup-password?token=${result.setupToken}`;
        
        // Show a more user-friendly message
        
        setNewClient({
          username: '',
          email: '',
          company_name: '',
          role: 'client_admin',
          domain_name: ''
        });
        setShowCreateForm(false);
        loadClients();
      } else {
        alert(`Failed to create client: ${result.error || result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create client:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create client: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigureEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.configureEmail(emailConfig);
      
      if (result.success) {
        alert('Email service configured successfully!');
        setShowEmailForm(false);
        setEmailConfigured(true);
      } else {
        alert(`Failed to configure email: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to configure email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to configure email: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmail = async () => {
    const testEmail = prompt('Enter email address to send test email:');
    if (!testEmail) return;

    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.testEmail(testEmail);
      
      if (result.success) {
        alert(`Test email sent successfully to ${testEmail}!`);
      } else {
        alert('Failed to send test email');
      }
    } catch (error) {
      alert(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage eMailMind clients and system configuration</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowEmailForm(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Mail className="h-4 w-4" />
              <span>Email Setup</span>
            </button>
            <button
              onClick={() => setShowDomainForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Globe className="h-4 w-4" />
              <span>Create Domain</span>
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Client</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Globe className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Domains</p>
              <p className="text-2xl font-bold text-gray-900">{domains.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Database className={`h-8 w-8 ${dbConnected ? 'text-green-500' : 'text-red-500'}`} />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Database</p>
              <p className={`text-lg font-bold ${dbConnected ? 'text-green-600' : 'text-red-600'}`}>
                {dbConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active Clients</p>
              <p className="text-2xl font-bold text-gray-900">
                {clients.filter(c => c.is_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Mail className={`h-8 w-8 ${emailConfigured ? 'text-green-500' : 'text-red-500'}`} />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Email Service</p>
              <p className={`text-lg font-bold ${emailConfigured ? 'text-green-600' : 'text-red-600'}`}>
                {emailConfigured ? 'Configured' : 'Not Configured'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Email Connections</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Configuration Form */}
      {showEmailForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Configure Email Service</h2>
              <p className="text-gray-600 mt-2">Setup SMTP settings to send setup emails to new clients</p>
            </div>
            
            <form onSubmit={handleConfigureEmail} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={emailConfig.host}
                    onChange={(e) => setEmailConfig({...emailConfig, host: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    value={emailConfig.port}
                    onChange={(e) => setEmailConfig({...emailConfig, port: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailConfig.user}
                  onChange={(e) => setEmailConfig({...emailConfig, user: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="your-email@gmail.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password / App Password
                </label>
                <input
                  type="password"
                  value={emailConfig.password}
                  onChange={(e) => setEmailConfig({...emailConfig, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Your email password or app password"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={emailConfig.secure}
                  onChange={(e) => setEmailConfig({...emailConfig, secure: e.target.checked})}
                  className="mr-2"
                />
                <label className="text-sm text-gray-700">
                  Use SSL/TLS (check for port 465, uncheck for port 587)
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">📧 Common SMTP Settings:</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Gmail:</strong> smtp.gmail.com, Port 587, Use App Password</p>
                  <p><strong>Outlook:</strong> smtp-mail.outlook.com, Port 587</p>
                  <p><strong>Yahoo:</strong> smtp.mail.yahoo.com, Port 587</p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Configuring...' : 'Configure Email'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {emailConfigured && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send Test Email</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Create Domain Form */}
      {showDomainForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Domain</h2>
            </div>
            
            <form onSubmit={handleCreateDomain} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domain Name
                </label>
                <input
                  type="text"
                  value={newDomain.domain_name}
                  onChange={(e) => setNewDomain({...newDomain, domain_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., DSV, ACME_LOGISTICS, CLIENT_ABC"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Use uppercase letters and underscores only</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newDomain.description}
                  onChange={(e) => setNewDomain({...newDomain, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Brief description of this domain/client"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Domain'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDomainForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Client Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Client</h2>
            </div>
            
            <form onSubmit={handleCreateClient} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={newClient.username}
                    onChange={(e) => setNewClient({...newClient, username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newClient.company_name}
                  onChange={(e) => setNewClient({...newClient, company_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Domain
                </label>
                <select
                  value={newClient.domain_name}
                  onChange={(e) => setNewClient({...newClient, domain_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Domain</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.domain_name}>
                      {domain.domain_name} - {domain.description}
                    </option>
                  ))}
                </select>
                {domains.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">Please create a domain first</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={newClient.role}
                  onChange={(e) => setNewClient({...newClient, role: e.target.value as 'client_admin' | 'user'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="client_admin">Client Admin</option>
                  <option value="user">User</option>
                </select>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={isLoading || domains.length === 0}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Client'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Domains Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Domain Management</h2>
        </div>
        
        {domains.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No domains yet</h3>
            <p className="text-gray-600">Create your first domain to organize clients</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Domain Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {domains.map((domain) => (
                  <tr key={domain.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{domain.domain_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {domain.description || 'No description'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {domain.user_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        domain.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {domain.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(domain.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Client Management</h2>
        </div>
        
        {clients.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
            <p className="text-gray-600">Create your first client to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{client.company_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {client.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {client.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {client.domain_name || 'No Domain'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {client.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        client.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {client.is_active ? 'Active' : 'Pending Setup'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}