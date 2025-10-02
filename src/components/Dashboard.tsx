import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  FileText,
  Send,
  Database,
  Activity
} from 'lucide-react';
import ApiService from '../services/apiService';

interface ProcessingStatus {
  isProcessing: boolean;
  automaticProcessing: boolean;
}

interface EmailConnection {
  id: string;
  email_address: string;
  provider: string;
  status: string;
  last_sync: string | null;
}

interface ProcessedEmail {
  id: string;
  subject: string;
  sender_email: string;
  is_logistics_order: boolean;
  confidence_score: number;
  processed_date: string;
  email_address: string;
}

interface ExtractedOrder {
  id: string;
  order_number: string;
  customer_name: string;
  weight: number;
  weight_unit: string;
  package_count: number;
  oracle_api_sent: boolean;
  created_at: string;
  subject: string;
  sender_email: string;
}

export default function Dashboard() {
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    automaticProcessing: false
  });
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([]);
  const [processedEmails, setProcessedEmails] = useState<ProcessedEmail[]>([]);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const apiService = ApiService.getInstance();
      
      // Load all dashboard data
      const [statusResult, connectionsResult, emailsResult, ordersResult] = await Promise.all([
        apiService.getEmailProcessingStatus(),
        apiService.getEmailConnections(),
        apiService.getProcessedEmails(),
        apiService.getExtractedOrders()
      ]);

      setProcessingStatus(statusResult);
      setEmailConnections(connectionsResult.connections || []);
      setProcessedEmails(emailsResult.emails || []);
      setExtractedOrders(ordersResult.orders || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const handleStartProcessing = async () => {
    setIsLoading(true);
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.startEmailProcessing();
      
      if (result.success) {
        alert(`Processing completed! Processed ${result.totalProcessed} emails from ${result.successCount} connections.`);
        loadDashboardData();
      } else {
        alert(`Processing failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Email Processing Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor and control AI-powered logistics email processing</p>
      </div>

      {/* Processing Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Email Connections</p>
              <p className="text-2xl font-bold text-gray-900">{emailConnections.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active Connections</p>
              <p className="text-2xl font-bold text-gray-900">
                {emailConnections.filter(c => c.status === 'connected').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Processed Emails</p>
              <p className="text-2xl font-bold text-gray-900">{processedEmails.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Extracted Orders</p>
              <p className="text-2xl font-bold text-gray-900">{extractedOrders.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email Processing Control</h2>
            <p className="text-gray-600">Manually trigger email processing or monitor automatic processing</p>
          </div>
          <div className="flex items-center space-x-2">
            {processingStatus.isProcessing && (
              <div className="flex items-center text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
            {processingStatus.automaticProcessing && (
              <div className="flex items-center text-green-600">
                <Activity className="h-4 w-4 mr-2" />
                <span className="text-sm">Auto-processing active</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleStartProcessing}
            disabled={isLoading || processingStatus.isProcessing}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading || processingStatus.isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{isLoading || processingStatus.isProcessing ? 'Processing...' : 'Start Processing'}</span>
          </button>

          <button
            onClick={loadDashboardData}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Email Connections Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Email Connections Status</h2>
        </div>
        
        {emailConnections.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No email connections</h3>
            <p className="text-gray-600">Go to Email Connections to add your first email account</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {emailConnections.map((connection) => (
                  <tr key={connection.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{connection.email_address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {connection.provider.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(connection.status)}
                        <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(connection.status)}`}>
                          {connection.status.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {connection.last_sync ? formatDate(connection.last_sync) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Processed Emails */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Processed Emails</h2>
        </div>
        
        {processedEmails.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No processed emails</h3>
            <p className="text-gray-600">Start email processing to see results here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Logistics Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedEmails.slice(0, 10).map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{email.subject}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {email.sender_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {email.is_logistics_order ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${email.confidence_score * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.round(email.confidence_score * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(email.processed_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Extracted Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Extracted Orders</h2>
        </div>
        
        {extractedOrders.length === 0 ? (
          <div className="text-center py-12">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No extracted orders</h3>
            <p className="text-gray-600">Process logistics emails to see extracted orders here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Packages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oracle API</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {extractedOrders.slice(0, 10).map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{order.order_number || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.customer_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.weight ? `${order.weight} ${order.weight_unit}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.package_count || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.oracle_api_sent ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.created_at)}
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