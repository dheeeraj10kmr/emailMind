import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import ProcessedOrders from './components/ProcessedOrders';
import EmailConnections from './components/EmailConnections';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import PasswordSetup from './components/PasswordSetup';
import SystemLogs from './components/SystemLogs';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ApiService from './services/apiService';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeApplication();
  }, []);

  const initializeApplication = async () => {
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.initializeDatabase();
      setIsInitialized(result.success);
    } catch (error) {
      console.error('Application initialization failed:', error);
      setIsInitialized(false);
    } finally {
      setIsInitializing(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing eMailMind...</p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Initialization Failed</h1>
          <p className="text-gray-600 mb-4">Unable to initialize the application. Please check server logs.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/setup-password" element={<PasswordSetup />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <SuperAdminRoute>
                    <Layout>
                      <SuperAdminDashboard />
                    </Layout>
                  </SuperAdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <ClientRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ClientRoute>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <ClientRoute>
                    <Layout>
                      <Settings />
                    </Layout>
                  </ClientRoute>
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute>
                  <ClientRoute>
                    <Layout>
                      <ProcessedOrders />
                    </Layout>
                  </ClientRoute>
                </ProtectedRoute>
              } />
              <Route path="/email-connections" element={
                <ProtectedRoute>
                  <ClientRoute>
                    <Layout>
                      <EmailConnections />
                    </Layout>
                  </ClientRoute>
                </ProtectedRoute>
              } />
              <Route path="/logs" element={
                <ProtectedRoute>
                  <SuperAdminRoute>
                    <Layout>
                      <SystemLogs />
                    </Layout>
                  </SuperAdminRoute>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}

// Route protection components
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (user?.role !== 'super_admin') {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (user?.role === 'super_admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export default App;