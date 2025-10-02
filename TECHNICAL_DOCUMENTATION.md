# eMailMind - Technical Documentation

## 📋 Table of Contents
1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Backend Services](#backend-services)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Email Processing Workflow](#email-processing-workflow)
7. [Security Implementation](#security-implementation)
8. [File Structure](#file-structure)
9. [Process Flow](#process-flow)

## 🏗️ System Architecture

### Technology Stack
- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express.js
- **Database:** MySQL 8.0 (MilesWeb hosting)
- **Email Processing:** IMAP (ImapFlow library)
- **Authentication:** JWT tokens + bcrypt
- **AI Processing:** Keyword-based logistics detection (English + Dutch)
- **Integration:** Oracle REST API
- **Deployment:** MilesWeb shared hosting

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Express Backend │    │   MySQL Database │
│   (Port 3000)   │◄──►│   (Port 3001)   │◄──►│  (Port 3306)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │ Email Processing │              │
         │              │    Service      │              │
         │              └─────────────────┘              │
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         └──────────────►│   Oracle API    │◄─────────────┘
                        │   Integration   │
                        └─────────────────┘
```

## 🗄️ Database Schema

### Core Tables Structure

#### 1. domains
```sql
CREATE TABLE domains (
  id VARCHAR(32) PRIMARY KEY,
  domain_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
**Purpose:** Organize clients into separate domains for data isolation

#### 2. users
```sql
CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  company_name VARCHAR(100) NOT NULL,
  role ENUM('super_admin', 'client_admin', 'user') NOT NULL,
  domain_id VARCHAR(32),
  setup_token VARCHAR(32),
  setup_token_expires DATETIME,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id)
);
```
**Purpose:** Store user accounts with role-based access control

#### 3. email_connections
```sql
CREATE TABLE email_connections (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  domain_id VARCHAR(32) NOT NULL,
  email_address VARCHAR(100) NOT NULL,
  provider ENUM('outlook', 'gmail') NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  status ENUM('pending', 'connected', 'error', 'disconnected') DEFAULT 'pending',
  last_sync TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (domain_id) REFERENCES domains(id)
);
```
**Purpose:** Store encrypted email credentials for IMAP connections

#### 4. processed_emails
```sql
CREATE TABLE processed_emails (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  domain_id VARCHAR(32) NOT NULL,
  email_connection_id VARCHAR(32) NOT NULL,
  email_id VARCHAR(255) NOT NULL,
  subject TEXT,
  sender_email VARCHAR(100),
  received_date TIMESTAMP,
  processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  content_text LONGTEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_data JSON,
  is_logistics_order BOOLEAN DEFAULT FALSE,
  confidence_score DECIMAL(3,2) DEFAULT 0.00,
  keywords_found JSON,
  status ENUM('pending', 'completed', 'error') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (domain_id) REFERENCES domains(id),
  FOREIGN KEY (email_connection_id) REFERENCES email_connections(id)
);
```
**Purpose:** Store processed email data and AI analysis results

#### 5. extracted_orders
```sql
CREATE TABLE extracted_orders (
  id VARCHAR(32) PRIMARY KEY,
  processed_email_id VARCHAR(32) NOT NULL,
  domain_id VARCHAR(32) NOT NULL,
  order_number VARCHAR(100),
  customer_name VARCHAR(100),
  pickup_location JSON,
  delivery_location JSON,
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'kg',
  package_count INT,
  description TEXT,
  extracted_data JSON,
  xml_generated LONGTEXT,
  oracle_api_sent BOOLEAN DEFAULT FALSE,
  oracle_api_response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (processed_email_id) REFERENCES processed_emails(id),
  FOREIGN KEY (domain_id) REFERENCES domains(id)
);
```
**Purpose:** Store extracted order information and Oracle integration status

#### 6. system_logs
```sql
CREATE TABLE system_logs (
  id VARCHAR(32) PRIMARY KEY,
  domain_id VARCHAR(32),
  user_id VARCHAR(32),
  log_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  data JSON,
  level ENUM('ERROR', 'WARNING', 'INFO', 'DEBUG') DEFAULT 'INFO',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```
**Purpose:** Comprehensive system logging with domain-based filtering

## 🔧 Backend Services

### 1. DatabaseManager (`server/config/database.cjs`)
**Purpose:** MySQL database connection and management
**Key Methods:**
- `getInstance()` - Singleton pattern
- `initialize()` - Create tables and super admin
- `testConnection()` - Verify database connectivity
- `query(sql, params)` - Execute SQL queries
- `createTables()` - Initialize database schema
- `createSuperAdmin()` - Create default admin user

### 2. AuthService (`server/services/authService.cjs`)
**Purpose:** User authentication and authorization
**Key Methods:**
- `login(username, password)` - Authenticate user
- `createUser(userData)` - Create new user account
- `setupPassword(token, password)` - Complete user setup
- `createDomain(name, description)` - Create new domain
- `getAllClients()` - Get all client users
- `verifyToken(token)` - Validate JWT tokens

### 3. EmailService (`server/services/emailService.cjs`)
**Purpose:** SMTP email sending for notifications
**Key Methods:**
- `configure(emailConfig)` - Setup SMTP settings
- `sendSetupEmail(email, token, clientData)` - Send user setup emails
- `sendTestEmail(email)` - Send test emails
- `testConnection()` - Verify SMTP connectivity
- `getStatus()` - Get email service status

### 4. EmailProcessingService (`server/services/emailProcessingService.cjs`)
**Purpose:** Core email processing and AI analysis
**Key Methods:**
- `connectToEmail(connection)` - Establish IMAP connection
- `analyzeEmailForLogistics(content)` - AI-powered logistics detection
- `extractOrderInformation(content, subject, attachments)` - Extract order details
- `generateOrderXML(orderData)` - Create Oracle-compatible XML
- `sendToOracleAPI(xml, orderData)` - Send XML to Oracle
- `processEmailsFromConnection(connection)` - Process emails from one account
- `processAllConnections()` - Process all active connections
- `startAutomaticProcessing(interval)` - Start scheduled processing

### 5. LogService (`server/services/logService.cjs`)
**Purpose:** System logging with domain-based filtering
**Key Methods:**
- `log(type, message, data, level, userId, domainId)` - Write log entry
- `getLogs(limit, type, level, domainId, userRole)` - Retrieve logs
- `getLogStats(domainId, userRole)` - Get log statistics
- `setContext(userId, domainId)` - Set logging context

## 🌐 API Endpoints

### Authentication Endpoints
- `POST /api/initialize` - Initialize database and create tables
- `GET /api/database-test` - Test database connection
- `POST /api/login` - User authentication
- `POST /api/setup-password` - Complete user password setup

### Domain Management (Super Admin Only)
- `GET /api/domains` - Get all domains
- `POST /api/domains` - Create new domain

### User Management (Super Admin Only)
- `GET /api/users` - Get all client users
- `POST /api/users` - Create new user account

### Email Configuration (Super Admin Only)
- `POST /api/configure-email` - Configure SMTP settings
- `GET /api/email-status` - Get email service status
- `POST /api/test-email` - Send test email

### Email Connections
- `POST /api/email-connections` - Create email connection
- `GET /api/email-connections` - Get user's email connections
- `DELETE /api/email-connections/:id` - Delete email connection

### Email Processing
- `POST /api/email-processing/start` - Start manual email processing
- `GET /api/email-processing/status` - Get processing status
- `GET /api/processed-emails` - Get processed emails list
- `GET /api/extracted-orders` - Get extracted orders

### System Monitoring
- `GET /api/logs` - Get system logs (domain-filtered)

## ⚛️ Frontend Components

### Core Components

#### 1. App.tsx
**Purpose:** Main application router and authentication wrapper
**Key Features:**
- Route protection based on user roles
- Application initialization
- Authentication state management
- Role-based navigation (Super Admin vs Client)

#### 2. Login.tsx
**Purpose:** User authentication interface
**Key Features:**
- Username/password authentication
- Responsive design with branding
- Error handling and validation
- Automatic redirection after login

#### 3. Layout.tsx
**Purpose:** Navigation and layout wrapper
**Key Features:**
- Role-based navigation menu
- User profile display
- Logout functionality
- Responsive sidebar navigation

### Dashboard Components

#### 4. SuperAdminDashboard.tsx
**Purpose:** System overview and management for super admins
**Key Features:**
- System status monitoring (database, email service)
- Client and domain management
- Email service configuration
- Real-time statistics display

#### 5. Dashboard.tsx
**Purpose:** Client dashboard with processing controls
**Key Features:**
- Email processing status and controls
- Connection status monitoring
- Recent processed emails display
- Manual processing triggers

#### 6. Settings.tsx
**Purpose:** Configuration management for clients
**Key Features:**
- Oracle API configuration
- Processing preferences
- Email service setup
- AI threshold adjustment

### Email Processing Components

#### 7. EmailConnections.tsx
**Purpose:** Email account management
**Key Features:**
- Add/remove email connections
- Connection status monitoring
- App password setup instructions
- Provider-specific configuration (Gmail/Outlook)

#### 8. ProcessedOrders.tsx
**Purpose:** Order viewing and XML download
**Key Features:**
- Order search and filtering
- Detailed order information display
- XML generation and download
- Oracle API status tracking

#### 9. SystemLogs.tsx
**Purpose:** Log viewing and filtering (Super Admin)
**Key Features:**
- Real-time log display
- Log level filtering
- Search functionality
- Domain-based log separation

### Utility Components

#### 10. PasswordSetup.tsx
**Purpose:** New user password setup
**Key Features:**
- Token validation
- Password confirmation
- Setup completion
- Automatic redirection

#### 11. ProtectedRoute.tsx
**Purpose:** Route protection based on authentication
**Key Features:**
- Authentication verification
- Loading state management
- Automatic login redirection

### Context Providers

#### 12. AuthContext.tsx
**Purpose:** Authentication state management
**Key Features:**
- User session management
- Login/logout functionality
- Token storage and validation
- User role and permissions

#### 13. DataContext.tsx
**Purpose:** Application data management
**Key Features:**
- Shared data state
- Data refresh functionality
- Future extensibility for global state

## 📧 Email Processing Workflow

### 1. Connection Setup Flow
```
User Input → Credential Encryption → IMAP Test → Database Storage → Status Update
```

### 2. Automatic Processing Flow
```
Timer Trigger (15 min) → Get Active Connections → For Each Connection:
  ├── IMAP Connect
  ├── Fetch Recent Emails (24h)
  ├── For Each Email:
  │   ├── Check if Already Processed
  │   ├── Extract Content + Attachments
  │   ├── AI Analysis (Keywords + Confidence)
  │   ├── Store Processed Email
  │   └── If Logistics Order:
  │       ├── Extract Order Information
  │       ├── Generate Oracle XML
  │       ├── Send to Oracle API
  │       └── Store Extracted Order
  └── Update Connection Status
```

### 3. AI Analysis Process
```
Email Content → Keyword Detection (200+ terms) → Confidence Calculation → 
Pattern Matching → Order Information Extraction → XML Generation
```

### 4. Oracle Integration Flow
```
Order Data → XML Generation → Oracle API Call → Response Handling → 
Status Update → Log Results
```

## 🔒 Security Implementation

### Authentication Security
- **JWT Tokens:** 24-hour expiration with secure signing
- **Password Hashing:** bcrypt with 12 rounds
- **Setup Tokens:** Time-limited (24h) for user activation
- **Role-Based Access:** Super Admin, Client Admin, User levels

### Data Security
- **Domain Isolation:** All data filtered by domain_id
- **Credential Encryption:** AES-256 encryption for email passwords
- **SQL Injection Prevention:** Parameterized queries
- **Input Validation:** Server-side validation for all inputs

### Email Security
- **App Passwords:** Required for email connections (no regular passwords)
- **Encrypted Storage:** All email credentials encrypted at rest
- **Secure IMAP:** SSL/TLS connections only
- **Connection Validation:** Real-time IMAP testing

### API Security
- **Token Authentication:** All API endpoints require valid JWT
- **Domain Filtering:** Users only see their domain data
- **Rate Limiting:** Protection against abuse
- **Error Handling:** Secure error messages without sensitive data

## 📁 File Structure

### Backend Structure
```
server/
├── config/
│   └── database.cjs              # MySQL connection and schema
├── services/
│   ├── authService.cjs           # Authentication and user management
│   ├── emailService.cjs          # SMTP email sending
│   ├── emailProcessingService.cjs # Email processing and AI analysis
│   └── logService.cjs            # System logging
└── index.cjs                     # Express server and API routes
```

### Frontend Structure
```
src/
├── components/
│   ├── Dashboard.tsx             # Client dashboard
│   ├── SuperAdminDashboard.tsx   # Super admin dashboard
│   ├── EmailConnections.tsx     # Email account management
│   ├── ProcessedOrders.tsx      # Order viewing and XML download
│   ├── Settings.tsx             # Configuration management
│   ├── SystemLogs.tsx           # Log viewing (Super Admin)
│   ├── Login.tsx                # Authentication interface
│   ├── PasswordSetup.tsx        # New user setup
│   ├── Layout.tsx               # Navigation wrapper
│   └── ProtectedRoute.tsx       # Route protection
├── context/
│   ├── AuthContext.tsx          # Authentication state
│   └── DataContext.tsx          # Application data state
├── services/
│   └── apiService.ts            # API communication
├── App.tsx                      # Main application router
└── main.tsx                     # Application entry point
```

## 🔄 Process Flow

### Application Startup Flow
```
1. main.tsx → React App Initialization
2. App.tsx → Authentication Check
3. AuthContext → Token Validation
4. Route Protection → Role-Based Navigation
5. Component Loading → Data Fetching
```

### User Authentication Flow
```
1. Login.tsx → User Input
2. apiService.ts → API Call (/api/login)
3. authService.cjs → Credential Validation
4. database.cjs → User Lookup
5. JWT Generation → Token Response
6. AuthContext → State Update
7. Route Redirect → Dashboard Loading
```

### Email Processing Flow
```
1. Dashboard.tsx → Manual Trigger OR Timer → Automatic Trigger
2. apiService.ts → API Call (/api/email-processing/start)
3. emailProcessingService.cjs → Process All Connections
4. For Each Connection:
   ├── IMAP Connection → Email Fetching
   ├── AI Analysis → Keyword Detection
   ├── Order Extraction → Data Parsing
   ├── XML Generation → Oracle Format
   ├── Oracle API Call → Integration
   └── Database Storage → Results Logging
5. Status Update → Frontend Notification
```

### Order Management Flow
```
1. ProcessedOrders.tsx → Component Load
2. apiService.ts → API Call (/api/extracted-orders)
3. Database Query → Domain-Filtered Results
4. Order Display → User Interface
5. XML Download → File Generation
6. Oracle Status → Integration Tracking
```

### System Monitoring Flow
```
1. SystemLogs.tsx → Log Request
2. logService.cjs → Domain-Based Filtering
3. Database Query → Log Retrieval
4. Real-Time Display → Log Streaming
5. Search/Filter → Dynamic Updates
```

### File Interaction Sequence

#### Email Processing Sequence
```
1. server/index.cjs (API endpoint) 
   ↓
2. server/services/emailProcessingService.cjs (main processing)
   ↓
3. server/config/database.cjs (data storage)
   ↓
4. server/services/logService.cjs (activity logging)
   ↓
5. Oracle API (external integration)
```

#### User Management Sequence
```
1. src/components/SuperAdminDashboard.tsx (UI)
   ↓
2. src/services/apiService.ts (API calls)
   ↓
3. server/index.cjs (API routing)
   ↓
4. server/services/authService.cjs (user operations)
   ↓
5. server/services/emailService.cjs (setup notifications)
   ↓
6. server/config/database.cjs (data persistence)
```

#### Authentication Sequence
```
1. src/components/Login.tsx (user input)
   ↓
2. src/context/AuthContext.tsx (state management)
   ↓
3. src/services/apiService.ts (API communication)
   ↓
4. server/services/authService.cjs (credential validation)
   ↓
5. server/config/database.cjs (user lookup)
   ↓
6. JWT token generation and response
```

## 🔧 Configuration Files

### Database Configuration
- **File:** `server/config/database.cjs`
- **Purpose:** MySQL connection settings and schema management
- **Key Settings:** Host, port, credentials, connection pooling

### Environment Variables
- **FRONTEND_URL:** Frontend application URL
- **EMAIL_FROM:** SMTP sender address
- **JWT_SECRET:** JWT signing key
- **NODE_ENV:** Environment (production/development)
- **PORT:** Server port (3001)

### Build Configuration
- **File:** `vite.config.ts`
- **Purpose:** Frontend build and development settings
- **Key Settings:** Proxy configuration, build optimization

---

**Version:** 2.0 with Complete Email Processing
**Last Updated:** January 2025
**Maintained By:** DiligentIX Consulting