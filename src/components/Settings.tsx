import React, { useState } from 'react';
import { Settings as SettingsIcon, Database, Key, Bell, Shield, Save, Mail, Send } from 'lucide-react';
import ApiService from '../services/apiService';

export default function Settings() {
  const [settings, setSettings] = useState({
    apiEndpoint: 'https://rsk-dev-oic-frkpvjuqpmjx-fr.integration.eu-frankfurt-1.ocp.oraclecloud.com/ic/api/integration/v1/flows/rest/FIN_TO_OTM_CREATE_OR/1.0/CreateOrderRelease',
    apiUsername: '',
    apiPassword: '',
    processingInterval: 15,
    retentionDays: 7,
    enableNotifications: true,
    autoLearn: true,
    confidenceThreshold: 0.8
  });
  
  const [emailConfig, setEmailConfig] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    password: ''
  });
  
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [keywords] = useState([
    'order', 'orders', 'shipment', 'transport order', 'transport', 'delivery', 
    'delivery orders', 'delivery order', 'location', 'pickup location', 
    'delivery location', 'time', 'date', 'pickup date', 'delivery date', 
    'order weight', 'weight', 'count of orders', 'freight', 'cargo', 
    'consignment', 'bill of lading', 'manifest', 'warehouse', 'dispatch',
    'logistics', 'supply chain', 'distribution', 'fulfillment', 'tracking',
    'route', 'vehicle', 'driver', 'carrier', 'shipper', 'consignee'
  ]);

  React.useEffect(() => {
    checkEmailStatus();
  }, []);

  const checkEmailStatus = async () => {
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.getEmailStatus();
      setEmailConfigured(result.configured && result.connectionTest);
    } catch (error) {
      setEmailConfigured(false);
    }
  };

  const handleSave = () => {
    // Save settings logic here
    alert('Settings saved successfully!');
  };

  const handleConfigureEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.configureEmail(emailConfig);
      
      if (result.success) {
        alert('Email service configured successfully!');
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
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Configure your AI-powered email processing and API settings</p>
      </div>

      <div className="grid gap-8">
        {/* API Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Database className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Oracle API Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Endpoint URL
              </label>
              <input
                type="url"
                value={settings.apiEndpoint}
                onChange={(e) => setSettings({...settings, apiEndpoint: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Oracle Integration Cloud API endpoint"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Username
                </label>
                <input
                  type="text"
                  value={settings.apiUsername}
                  onChange={(e) => setSettings({...settings, apiUsername: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Password
                </label>
                <input
                  type="password"
                  value={settings.apiPassword}
                  onChange={(e) => setSettings({...settings, apiPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Processing Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <SettingsIcon className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Processing Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Processing Interval (minutes)
                </label>
                <select
                  value={settings.processingInterval}
                  onChange={(e) => setSettings({...settings, processingInterval: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachment Retention (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.retentionDays}
                  onChange={(e) => setSettings({...settings, retentionDays: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Confidence Threshold
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={settings.confidenceThreshold}
                onChange={(e) => setSettings({...settings, confidenceThreshold: parseFloat(e.target.value)})}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Lower Accuracy</span>
                <span>{Math.round(settings.confidenceThreshold * 100)}%</span>
                <span>Higher Accuracy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Email Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Mail className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Email Configuration</h2>
            {emailConfigured && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                Configured
              </span>
            )}
          </div>

          <form onSubmit={handleConfigureEmail} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={emailConfig.host}
                  onChange={(e) => setEmailConfig({...emailConfig, host: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="smtp.gmail.com"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailConfig.user}
                  onChange={(e) => setEmailConfig({...emailConfig, user: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your-email@gmail.com"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your email password"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={emailConfig.secure}
                  onChange={(e) => setEmailConfig({...emailConfig, secure: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Use SSL/TLS</span>
              </label>
              
              <button
                type="submit"
                disabled={isLoading}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Configuring...' : 'Configure Email'}
              </button>
              
              {emailConfigured && (
                <button
                  type="button"
                  onClick={handleTestEmail}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Test Email</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Keywords */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Key className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Logistics Keywords</h2>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              eMailMind uses these keywords to identify logistics orders in emails. 
              Keywords are automatically expanded as the AI learns from processed emails.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        {/* System Preferences */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Bell className="h-6 w-6 text-orange-600" />
            <h2 className="text-xl font-bold text-gray-900">System Preferences</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                <p className="text-sm text-gray-600">Receive notifications when orders are processed</p>
              </div>
              <button
                onClick={() => setSettings({...settings, enableNotifications: !settings.enableNotifications})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enableNotifications ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enableNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Auto Learning</h3>
                <p className="text-sm text-gray-600">Automatically improve accuracy with each processed email</p>
              </div>
              <button
                onClick={() => setSettings({...settings, autoLearn: !settings.autoLearn})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.autoLearn ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoLearn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}