// file: src/components/SuperAdminDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Mail, Settings, Shield, Database, Globe, Send, CheckCircle, XCircle, Key, Server, Link, Trash2, RefreshCw, Loader2, Play, Eye } from 'lucide-react';
import ApiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

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
  domain_id?: string;
}

interface EmailConnection {
  id: string;
  email_address: string;
  email_provider: string; // Changed from 'provider' to 'email_provider'
  status: 'connected' | 'pending_oauth' | 'expired' | 'error'; // Simplified status
  last_sync: string | null;
  created_at: string;
  domain_id?: string;
  token_expires_at?: string | null;
  token_scope?: string | null;
  token_type?: string | null;
  error_message?: string | null;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate(); // Initialize navigate
  const [clients, setClients] = useState<User[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showDomainEmailSettingsModal, setShowDomainEmailSettingsModal] = useState(false);
  const [showAppSettingsForm, setShowAppSettingsForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  // Removed emailConfigured state as global SMTP is no longer UI configurable
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

  // Application Settings State (only DB related)
  const [appSettings, setAppSettings] = useState({
    DB_HOST: '',
    DB_PORT: '',
    DB_NAME: '',
    DB_USER: '',
    DB_PASSWORD: '',
    DB_SSL: 'false',
  });
  const [appSettingsLoading, setAppSettingsLoading] = useState(false);

  // State for Domain Email Settings Modal
  const [selectedDomainForEmail, setSelectedDomainForEmail] = useState<string | null>(null);
  const [clientEmailConnections, setClientEmailConnections] = useState<EmailConnection[]>([]);
  const [clientEmailConnectionsLoading, setClientEmailConnectionsLoading] = useState(false);
  const [isConnectingOutlookForClient, setIsConnectingOutlookForClient] = useState(false);
  const [clientOauthStatus, setClientOauthStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [clientOauthMessage, setClientOauthMessage] = useState('');

  // New state for adding a new email connection
  const [showAddEmailConnectionForm, setShowAddEmailConnectionForm] = useState(false);
  const [newEmailConnection, setNewEmailConnection] = useState({
    emailAddress: '',
    emailProvider: 'outlook', // Default to outlook
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', // Pre-filled
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',   // Pre-filled
    scope: 'Mail.ReadWrite', // Pre-filled
  });

  useEffect(() => {
    loadClients();
    loadDomains();
    checkDatabaseConnection();
    loadAppSettings();
  }, []);

  // Effect to load domain-specific email settings and connections when selectedDomainForEmail changes
  useEffect(() => {
    if (selectedDomainForEmail && showDomainEmailSettingsModal) {
      loadClientEmailConnections(selectedDomainForEmail);
    } else {
      setClientEmailConnections([]);
    }
  /* }, [selectedDomainForEmail, showDomainEmailSettingsModal]);

  // Check for OAuth callback status when the component mounts
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('oauth_status');
  const provider = params.get('provider');
  const message = params.get('message');
  const connectionId = params.get('connectionId'); 

  if (!status || !provider || !connectionId) {
    return; // Only run this effect for OAuth callbacks
  }

  if (status === 'success' && provider === 'outlook') {
    setClientOauthStatus('success');
    setClientOauthMessage('Outlook connected successfully!');
  } else if (status === 'error' && provider === 'outlook') {
    setClientOauthStatus('error');
    setClientOauthMessage(`Outlook connection failed: ${message || 'Unknown error'}`);
  }
  window.history.replaceState({}, document.title, window.location.pathname);

  const domain = domains.find(d => clientEmailConnections.some(conn => conn.id === connectionId && conn.domain_id === d.id));
  if (domain) {
    setSelectedDomainForEmail(domain.id);
    setShowDomainEmailSettingsModal(true);
  } else {
    console.warn("Could not find domain for returned connectionId:", connectionId);
  }
}, [domains, clientEmailConnections]); // Depend on domains and clientEmailConnections to find the right domain
*/
}, [selectedDomainForEmail, showDomainEmailSettingsModal, loadClientEmailConnections]);

  const loadAppSettings = async () => {
    setAppSettingsLoading(true);
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.getAppSettings();
      if (result.success) {
        setAppSettings(prev => ({ ...prev, ...result.settings }));
      }
    } catch (error) {
      console.error('Failed to load app settings:', error);
      alert('Failed to load application settings.');
    } finally {
      setAppSettingsLoading(false);
    }
  };

  const handleSaveAppSetting = async (key: string, value: string, isSensitive: boolean) => {
    setIsLoading(true);
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.updateAppSetting(key, value, isSensitive);
      if (result.success) {
        alert(`Setting ${key} updated successfully!`);
        await loadAppSettings();
        if (key.startsWith('DB_')) {
          checkDatabaseConnection();
        }
      } else {
        alert(`Failed to update setting ${key}: ${result.message}`);
      }
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
      alert(`Failed to update setting ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkDatabaseConnection = async () => {
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.testDatabaseConnection();
      setDbConnected(result.connected);
    } catch (error) {
      setDbConnected(false);
    }
  };

  // Removed checkEmailStatus as global SMTP is no longer UI configurable

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

  const handleDeleteDomain = async (domainId: string, domainName: string) => {
    if (!window.confirm(`Are you sure you want to delete the domain "${domainName}"? This will also delete all associated users, email connections, processed orders, and logs.`)) {
      return;
    }
    setIsLoading(true);
    try {
      console.log('Attempting to delete domain:', domainId, domainName);
      const apiService = ApiService.getInstance();
      const result = await apiService.deleteDomain(domainId);
      console.log('Delete domain response:', result);

      if (result && result.success) {
        alert(`Domain "${domainName}" deleted successfully.`);
        await loadDomains();
        // If the deleted domain was selected in the email settings modal, clear it
        if (selectedDomainForEmail === domainId) {
          setSelectedDomainForEmail(null);
        }
      } else {
        alert(`Failed to delete domain: ${result?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete domain:', error);
      alert(`Failed to delete domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        alert(`Client created successfully! Setup email sent to ${newClient.email}.`);
        
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

  // --- Client Email Connections Management ---
    const loadClientEmailConnections = useCallback(async (domainId: string) => {
    setClientEmailConnectionsLoading(true);
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.getEmailConnections(domainId);
      if (result.success) {
        setClientEmailConnections(Array.isArray(result.connections) ? result.connections : []);
        setClientOauthStatus('idle');
        setClientOauthMessage('');
        if (!Array.isArray(result.connections)) {
          console.warn('Email connections response missing connections array for domain', domainId, result);
        }
      } else {
        setClientEmailConnections([]);
        setClientOauthStatus('error');
        setClientOauthMessage(result.message || 'Failed to load connections.');
      }
    } catch (error) {
      console.error(`Failed to load email connections for domain ${domainId}:`, error);
      setClientOauthStatus('error');
      setClientOauthMessage(`Failed to load connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setClientEmailConnections([]);
    } finally {
      setClientEmailConnectionsLoading(false);
    }
  }, []);

  // Check for OAuth callback status when the component mounts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('oauth_status');
    const provider = params.get('provider');
    const message = params.get('message');
    const connectionId = params.get('connectionId');
    const domainIdFromCallback = params.get('domainId');

    if (!status || provider !== 'outlook' || !connectionId) {
      return;
    }

    if (status === 'success') {
      setClientOauthStatus('success');
      setClientOauthMessage('Outlook connected successfully!');
    } else if (status === 'error') {
      setClientOauthStatus('error');
      setClientOauthMessage(`Outlook connection failed: ${message || 'Unknown error'}`);
    }

    if (domainIdFromCallback) {
      setSelectedDomainForEmail(domainIdFromCallback);
      setShowDomainEmailSettingsModal(true);
      loadClientEmailConnections(domainIdFromCallback);
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, [loadClientEmailConnections]);

  const handleAddEmailConnection = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedDomainForEmail) {
    alert('Please select a domain first.');
    return;
  }
  setIsLoading(true);
  setClientOauthStatus('idle');
  setClientOauthMessage('');

  try {
    // Prepare payload with undefined → null conversion
    const connectionPayload = {
      domainId: selectedDomainForEmail,
      emailAddress: newEmailConnection.emailAddress ?? null,
      emailProvider: newEmailConnection.emailProvider ?? null,
      clientId: newEmailConnection.clientId ?? null,
      clientSecret: newEmailConnection.clientSecret ?? null,
      redirectUri: newEmailConnection.redirectUri ?? null,
      authUrl: newEmailConnection.authUrl ?? null,
      tokenUrl: newEmailConnection.tokenUrl ?? null,
      scope: newEmailConnection.scope ?? null,
    };

    // 1. Save the new connection details
    const apiService = ApiService.getInstance();
    const saveResult = await apiService.createEmailConnection(connectionPayload);
    console.log('Save connection result:', saveResult);

    if (!saveResult || !saveResult.success) {
      setClientOauthStatus('error');
      setClientOauthMessage(`Failed to save connection details: ${saveResult?.message || 'Unknown error'}`);
      setIsLoading(false);
      return;
    }

    if (!saveResult.connection || !saveResult.connection.id) {
      setClientOauthStatus('error');
      setClientOauthMessage('Connection saved but ID is missing. Please refresh and try again.');
      setIsLoading(false);
      return;
    }

    alert('Email connection details saved. Now initiating OAuth flow...');

    // 2. Initiate OAuth flow using the newly created connection's ID
    const oauthResult = await apiService.initiateOutlookOAuth(saveResult.connection.id);
    console.log('OAuth initiate result:', oauthResult);

    if (!oauthResult || !oauthResult.success) {
      setClientOauthStatus('error');
      setClientOauthMessage(`Failed to initiate OAuth: ${oauthResult?.message || 'Unknown error'}`);
      setIsLoading(false);
      return;
    }

    if (!oauthResult.authUrl) {
      setClientOauthStatus('error');
      setClientOauthMessage('OAuth initiated but authorization URL is missing.');
      setIsLoading(false);
      return;
    }

    // Store the connectionId in local storage so we can retrieve it after redirect
    localStorage.setItem('oauth_target_connection_id', saveResult.connection.id);
    window.location.href = oauthResult.authUrl; // Redirect to Outlook for authentication
  } catch (error) {
    console.error('Error adding email connection:', error);
    setClientOauthStatus('error');
    setClientOauthMessage(
      `Error adding connection: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    setIsLoading(false);
  }
};


  const handleDeleteClientConnection = async (connectionId: string) => {
    if (!window.confirm('Are you sure you want to delete this email connection?')) {
      return;
    }
    if (!selectedDomainForEmail) {
      alert('No domain selected.');
      return;
    }
    setClientEmailConnectionsLoading(true);
    try {
      console.log('Attempting to delete email connection:', connectionId, 'for domain:', selectedDomainForEmail);
      const apiService = ApiService.getInstance();
      const result = await apiService.deleteEmailConnection(connectionId, selectedDomainForEmail);
      console.log('Delete email connection response:', result);

      if (result && result.success) {
        alert('Connection deleted successfully!');
        await loadClientEmailConnections(selectedDomainForEmail);
      } else {
        alert(`Failed to delete connection: ${result?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete client connection:', error);
      alert(`Failed to delete connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setClientEmailConnectionsLoading(false);
    }
  };

  const handleProcessEmailsForDomain = async () => { // NEW: Process Emails for Domain
    if (!selectedDomainForEmail) {
      alert('Please select a domain first to process emails.');
      return;
    }
    setIsLoading(true); // Use general loading for this action
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.startEmailProcessing(selectedDomainForEmail);
      if (result.success) {
        alert(`Email processing initiated for domain: ${domains.find(d => d.id === selectedDomainForEmail)?.domain_name || selectedDomainForEmail}. Check Processed Orders for results.`);
        // Optionally navigate to processed orders or show a link
        navigate(`/orders?domainId=${selectedDomainForEmail}`);
      } else {
        alert(`Failed to initiate email processing: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to initiate email processing:', error);
      alert(`Failed to initiate email processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending_oauth': return <RefreshCw className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'expired': return <XCircle className="h-5 w-5 text-orange-500" />;
      default: return <Mail className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'pending_oauth': return 'Pending OAuth';
      case 'error': return 'Connection Error';
      case 'expired': return 'Token Expired';
      default: return status;
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
              onClick={() => setShowAppSettingsForm(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>App Settings</span>
            </button>
            <button
              onClick={() => setShowDomainEmailSettingsModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <Mail className="h-4 w-4" />
              <span>Domain Email Settings</span>
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

        {/* Removed SMTP Service status as it's no longer UI configurable */}
        {/* Removed Email Connections count as it's not easily globally available */}
      </div>

      {/* App Settings Form (only DB settings) */}
      {showAppSettingsForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">Application Settings</h2>
              <p className="text-gray-600 mt-2">Configure core application parameters like database connection.</p>
            </div>
            
            <div className="p-6 space-y-6">
              {appSettingsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                  <p className="text-gray-600">Loading settings...</p>
                </div>
              ) : (
                <>
                  {/* Database Settings */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                      <Database className="h-5 w-5" /> <span>Database Connection</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">DB Host</label>
                        <input type="text" value={appSettings.DB_HOST} onChange={(e) => setAppSettings({...appSettings, DB_HOST: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="localhost" />
                        <button onClick={() => handleSaveAppSetting('DB_HOST', appSettings.DB_HOST, false)} disabled={isLoading} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Save</button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">DB Port</label>
                        <input type="number" value={appSettings.DB_PORT} onChange={(e) => setAppSettings({...appSettings, DB_PORT: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="3306" />
                        <button onClick={() => handleSaveAppSetting('DB_PORT', appSettings.DB_PORT, false)} disabled={isLoading} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Save</button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">DB Name</label>
                        <input type="text" value={appSettings.DB_NAME} onChange={(e) => setAppSettings({...appSettings, DB_NAME: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="emailmind_db" />
                        <button onClick={() => handleSaveAppSetting('DB_NAME', appSettings.DB_NAME, false)} disabled={isLoading} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Save</button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">DB User</label>
                        <input type="text" value={appSettings.DB_USER} onChange={(e) => setAppSettings({...appSettings, DB_USER: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="root" />
                        <button onClick={() => handleSaveAppSetting('DB_USER', appSettings.DB_USER, false)} disabled={isLoading} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Save</button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">DB Password</label>
                        <input type="password" value={appSettings.DB_PASSWORD} onChange={(e) => setAppSettings({...appSettings, DB_PASSWORD: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="********" />
                        <button onClick={() => handleSaveAppSetting('DB_PASSWORD', appSettings.DB_PASSWORD, true)} disabled={isLoading} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Save</button>
                      </div>
                      <div className="flex items-center mt-2">
                        <input type="checkbox" id="dbSsl" checked={appSettings.DB_SSL === 'true'} onChange={(e) => setAppSettings({...appSettings, DB_SSL: e.target.checked ? 'true' : 'false'})}
                          className="mr-2" />
                        <label htmlFor="dbSsl" className="text-sm text-gray-700">Use SSL for DB Connection</label>
                        <button onClick={() => handleSaveAppSetting('DB_SSL', appSettings.DB_SSL, false)} disabled={isLoading} className="ml-auto bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Save</button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAppSettingsForm(false)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Domain Email Settings Modal */}
      {showDomainEmailSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Domain Email Settings</h2>
                <p className="text-gray-600 mt-2">Configure email accounts for reading and processing for a specific domain.</p>
              </div>
              <button onClick={() => setShowDomainEmailSettingsModal(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Domain Selection */}
              <div>
                <label htmlFor="domain-select" className="block text-sm font-medium text-gray-700 mb-2">
  Select Domain
                </label>
                <select
                  id="domain-select"
                  value={selectedDomainForEmail ?? ''}
                  onChange={(e) => {
                    setSelectedDomainForEmail(e.target.value || null);
                    setShowAddEmailConnectionForm(true); // Show email connection form immediately
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a Domain --</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.domain_name} - {domain.description}
                    </option>
                  ))}
                </select>

              </div>

              {selectedDomainForEmail && (
                <>
                  {/* Add New Email Connection Form - shown automatically */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                        <Plus className="h-5 w-5" />
                        <span>Add New Email Connection</span>
                      </h3>
                    </div>
                    <form onSubmit={handleAddEmailConnection} className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="emailAddress">
                          Email Address
                        </label>
                        <input
                          id="emailAddress"
                          type="email"
                          required
                          value={newEmailConnection.emailAddress}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, emailAddress: e.target.value })
                          }
                          placeholder="email@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="emailProvider">
                          Email Provider
                        </label>
                        <select
                          id="emailProvider"
                          required
                          value={newEmailConnection.emailProvider}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, emailProvider: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="outlook">Outlook</option>
                          <option value="gmail">Gmail</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="clientId">
                          Client ID
                        </label>
                        <input
                          id="clientId"
                          type="text"
                          required
                          value={newEmailConnection.clientId}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, clientId: e.target.value })
                          }
                          placeholder="Azure AD Application client ID"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="clientSecret">
                          Client Secret
                        </label>
                        <input
                          id="clientSecret"
                          type="password"
                          required
                          value={newEmailConnection.clientSecret}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, clientSecret: e.target.value })
                          }
                          placeholder="Azure AD Client Secret Value"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="redirectUri">
                          Redirect URI
                        </label>
                        <input
                          id="redirectUri"
                          type="url"
                          required
                          value={newEmailConnection.redirectUri}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, redirectUri: e.target.value })
                          }
                          placeholder="e.g., http://localhost:3001/api/oauth/outlook/callback"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Must match the Redirect URI configured in your Azure AD app registration.
                        </p>
                      </div>

                      {/* New fields for Auth URL, Token URL, Scope */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="authUrl">
                          Auth URL
                        </label>
                        <input
                          id="authUrl"
                          type="url"
                          required
                          value={newEmailConnection.authUrl}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, authUrl: e.target.value })
                          }
                          placeholder="https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="tokenUrl">
                          Access Token URL
                        </label>
                        <input
                          id="tokenUrl"
                          type="url"
                          required
                          value={newEmailConnection.tokenUrl}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, tokenUrl: e.target.value })
                          }
                          placeholder="https://login.microsoftonline.com/common/oauth2/v2.0/token"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="scope">
                          Scope
                        </label>
                        <input
                          id="scope"
                          type="text"
                          required
                          value={newEmailConnection.scope}
                          onChange={(e) =>
                            setNewEmailConnection({ ...newEmailConnection, scope: e.target.value })
                          }
                          placeholder="Mail.ReadWrite"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          e.g., Mail.ReadWrite, openid profile email offline_access
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>Save & Initiate OAuth</span>
                      </button>
                    </form>
                  </div>

                  {/* Email Connections List */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2 mb-4">
                      <Link className="h-5 w-5" /> <span>Existing Connections</span>
                    </h3>
                    {clientOauthStatus === 'success' && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        {clientOauthMessage}
                      </div>
                    )}
                    {clientOauthStatus === 'error' && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
                        <XCircle className="h-5 w-5 mr-2" />
                        {clientOauthMessage}
                      </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {clientEmailConnectionsLoading ? (
                        <div className="text-center py-12">
                          <Loader2 className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                          <p className="text-gray-600">Loading connections...</p>
                        </div>
                      ) : clientEmailConnections.length === 0 ? (
                        <div className="text-center py-12">
                          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No email connections yet</h3>
                          <p className="text-gray-600">Add a new connection using the form above.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Address</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Sync</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token Expiry</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {clientEmailConnections.map((connection) => (
                                <tr key={connection.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{connection.email_address}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{connection.email_provider}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="flex items-center space-x-1">
                                      {getStatusIcon(connection.status)}
                                      <span>{getStatusLabel(connection.status)}</span>
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {connection.last_sync ? new Date(connection.last_sync).toLocaleString() : 'Never'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {connection.token_expires_at ? new Date(connection.token_expires_at).toLocaleString() : 'Not available'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs">
                                    {connection.error_message ? (
                                      <span className="text-red-600">{connection.error_message}</span>
                                    ) : connection.token_scope ? (
                                      <span className="text-gray-600">Scope: {connection.token_scope}</span>
                                    ) : (
                                      <span className="text-gray-400">No additional details</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteClientConnection(connection.id);
                                      }}
                                      disabled={clientEmailConnectionsLoading}
                                      className="text-red-600 hover:text-red-900 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>Delete</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Process Emails Action */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                        <Play className="h-5 w-5" /> <span>Process Emails</span>
                      </h3>
                      <button
                        onClick={handleProcessEmailsForDomain}
                        disabled={isLoading}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span>Process Now</span>
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Manually trigger email processing for this domain. Results will appear in "Processed Orders".</p>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowDomainEmailSettingsModal(false)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteDomain(domain.id, domain.domain_name);
                        }}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-900 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </button>
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