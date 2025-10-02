import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  Package,
  Weight,
  User,
  Mail,
  Send
} from 'lucide-react';
import ApiService from '../services/apiService';

interface ExtractedOrder {
  id: string;
  order_number: string;
  customer_name: string;
  weight: number;
  weight_unit: string;
  package_count: number;
  description: string;
  extracted_data: any;
  xml_generated: string;
  oracle_api_sent: boolean;
  oracle_api_response: string;
  created_at: string;
  subject: string;
  sender_email: string;
  email_address: string;
}

export default function ProcessedOrders() {
  const [orders, setOrders] = useState<ExtractedOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ExtractedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<ExtractedOrder | null>(null);
  const [showXmlModal, setShowXmlModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, filterStatus]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const apiService = ApiService.getInstance();
      const result = await apiService.getExtractedOrders();
      setOrders(result.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.sender_email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'sent') {
        filtered = filtered.filter(order => order.oracle_api_sent);
      } else if (filterStatus === 'pending') {
        filtered = filtered.filter(order => !order.oracle_api_sent);
      }
    }

    setFilteredOrders(filtered);
  };

  const downloadXML = (order: ExtractedOrder) => {
    if (!order.xml_generated) {
      alert('No XML available for this order');
      return;
    }

    const blob = new Blob([order.xml_generated], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order_${order.order_number || order.id}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const viewOrderDetails = (order: ExtractedOrder) => {
    setSelectedOrder(order);
  };

  const viewXML = (order: ExtractedOrder) => {
    setSelectedOrder(order);
    setShowXmlModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatExtractedData = (data: any) => {
    if (!data) return 'No additional data';
    
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return Object.entries(parsed)
        .filter(([key, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } catch {
      return 'Invalid data format';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Processed Orders</h1>
        <p className="text-gray-600 mt-2">View and manage extracted logistics orders from processed emails</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Sent to Oracle</p>
              <p className="text-2xl font-bold text-gray-900">
                {orders.filter(o => o.oracle_api_sent).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {orders.filter(o => !o.oracle_api_sent).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Weight className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Weight</p>
              <p className="text-2xl font-bold text-gray-900">
                {orders.reduce((sum, o) => sum + (o.weight || 0), 0).toFixed(0)} kg
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number, customer, subject, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Orders</option>
              <option value="sent">Sent to Oracle</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Extracted Orders ({filteredOrders.length})</h2>
        </div>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600">
              {orders.length === 0 
                ? 'Process some logistics emails to see extracted orders here'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight & Packages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oracle Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {order.order_number || 'No Order Number'}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {order.description || order.subject}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {order.customer_name || 'Unknown Customer'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="flex items-center text-gray-900">
                          <Weight className="h-4 w-4 text-gray-400 mr-1" />
                          {order.weight ? `${order.weight} ${order.weight_unit}` : 'N/A'}
                        </div>
                        <div className="flex items-center text-gray-500 mt-1">
                          <Package className="h-4 w-4 text-gray-400 mr-1" />
                          {order.package_count || 'N/A'} packages
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="flex items-center text-gray-900">
                          <Mail className="h-4 w-4 text-gray-400 mr-1" />
                          {order.sender_email}
                        </div>
                        <div className="text-gray-500 truncate max-w-xs mt-1">
                          {order.subject}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {order.oracle_api_sent ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                        )}
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          order.oracle_api_sent 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.oracle_api_sent ? 'Sent' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(order.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => viewOrderDetails(order)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => viewXML(order)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          XML
                        </button>
                        <button
                          onClick={() => downloadXML(order)}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && !showXmlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
              <p className="text-gray-600 mt-1">Order: {selectedOrder.order_number || 'No Order Number'}</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Order Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Order Number:</strong> {selectedOrder.order_number || 'N/A'}</div>
                    <div><strong>Customer:</strong> {selectedOrder.customer_name || 'N/A'}</div>
                    <div><strong>Weight:</strong> {selectedOrder.weight ? `${selectedOrder.weight} ${selectedOrder.weight_unit}` : 'N/A'}</div>
                    <div><strong>Package Count:</strong> {selectedOrder.package_count || 'N/A'}</div>
                    <div><strong>Description:</strong> {selectedOrder.description || 'N/A'}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Source Email</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>From:</strong> {selectedOrder.sender_email}</div>
                    <div><strong>Subject:</strong> {selectedOrder.subject}</div>
                    <div><strong>Processed:</strong> {formatDate(selectedOrder.created_at)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Oracle API Status</h3>
                <div className="flex items-center space-x-2 mb-2">
                  {selectedOrder.oracle_api_sent ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedOrder.oracle_api_sent 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedOrder.oracle_api_sent ? 'Successfully Sent' : 'Pending'}
                  </span>
                </div>
                {selectedOrder.oracle_api_response && (
                  <div className="mt-2">
                    <strong>API Response:</strong>
                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                      {selectedOrder.oracle_api_response}
                    </pre>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Extracted Data</h3>
                <div className="text-sm bg-gray-50 p-3 rounded">
                  {formatExtractedData(selectedOrder.extracted_data)}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => downloadXML(selectedOrder)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download XML</span>
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XML Modal */}
      {selectedOrder && showXmlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Generated XML</h2>
              <p className="text-gray-600 mt-1">Order: {selectedOrder.order_number || 'No Order Number'}</p>
            </div>
            
            <div className="p-6">
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                {selectedOrder.xml_generated || 'No XML generated'}
              </pre>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => downloadXML(selectedOrder)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download XML</span>
              </button>
              <button
                onClick={() => {
                  setShowXmlModal(false);
                  setSelectedOrder(null);
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}