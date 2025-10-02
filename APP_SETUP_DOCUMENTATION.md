# eMailMind - Application Setup and User Guide

## 📋 Table of Contents
1. [Getting Started](#getting-started)
2. [User Roles and Access](#user-roles-and-access)
3. [Super Admin Setup](#super-admin-setup)
4. [Client Setup Guide](#client-setup-guide)
5. [Email Processing Guide](#email-processing-guide)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## 🚀 Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Email account (Outlook or Gmail with app password)
- Internet connection for email processing
- Oracle API credentials (for order integration)

### Initial Access
1. **Navigate to:** https://email.mind.diligentixconsulting.com/
2. **Login with provided credentials** from system administrator
3. **Complete password setup** if first-time user

### Default Super Admin Login
- **Username:** admin
- **Password:** admin123
- **⚠️ Important:** Change this password immediately after first login

## 👥 User Roles and Access

### Super Administrator
- **Full system access** - Manage all clients and domains
- **System configuration** - Email service, database settings
- **Client management** - Create and manage client accounts
- **Domain management** - Create and organize client domains
- **System monitoring** - View all logs and system status
- **Email processing** - Monitor all email processing activities

### Client Administrator
- **Company management** - Manage users within their domain
- **Email connections** - Set up email accounts for processing
- **Order monitoring** - View processed orders and extracted data
- **Settings configuration** - Configure processing preferences
- **User management** - Create and manage company users

### User
- **Order viewing** - View processed orders for their domain
- **Email monitoring** - Monitor email processing status
- **Basic settings** - Update personal preferences

## 🔧 Super Admin Setup Guide

### 1. Initial System Configuration

#### Step 1: Email Service Setup
1. **Login as Super Admin** using default credentials
2. **Navigate to Dashboard** → Click "Email Setup" button
3. **Configure SMTP Settings:**
   - **Gmail:** 
     - Host: smtp.gmail.com
     - Port: 587
     - Use App Password (not regular password)
   - **Outlook:** 
     - Host: smtp-mail.outlook.com
     - Port: 587
     - Use App Password
4. **Test Configuration** → Send test email to verify setup
5. **Save Settings** → Email service now ready for client notifications

#### Step 2: Domain Creation
1. **Click "Create Domain"** in Super Admin Dashboard
2. **Enter Domain Details:**
   - **Domain Name:** Use uppercase and underscores (e.g., DSV, ACME_LOGISTICS, CLIENT_ABC)
   - **Description:** Brief description of the client/organization
3. **Create Domain** → Domain ready for client assignment

#### Step 3: Client Creation
1. **Click "Create Client"** in Super Admin Dashboard
2. **Fill Client Information:**
   - **Username:** Unique username for login
   - **Email:** Client's email address (they'll receive setup instructions)
   - **Company Name:** Full company name
   - **Domain:** Select from created domains
   - **Role:** Client Admin or User
3. **Create Client** → Setup email sent automatically to client
4. **Client receives email** with setup link and instructions

### 2. System Monitoring

#### Dashboard Overview
- **System Status** - Database connection, email service status
- **Client Statistics** - Total clients, active clients, domains
- **Processing Metrics** - Email processing status and results
- **Quick Actions** - Create clients, domains, configure email

#### System Logs
- **View All Logs** - Super admin sees logs from all domains
- **Filter by Level** - ERROR, WARNING, INFO, DEBUG
- **Search Functionality** - Find specific log entries
- **Real-time Updates** - Monitor system activities

## 👤 Client Setup Guide

### 1. Initial Account Setup

#### Step 1: Password Setup
1. **Check your email** for setup message from eMailMind
2. **Click Setup Link** in email (valid for 24 hours)
3. **Create Password** - Minimum 6 characters
4. **Confirm Password** - Must match initial password
5. **Complete Setup** → Account activated

#### Step 2: First Login
1. **Navigate to Login Page:** https://email.mind.diligentixconsulting.com/
2. **Enter Credentials** - Username and password from setup
3. **Access Dashboard** → Welcome to eMailMind!

### 2. Email Connection Setup

#### Step 1: Prepare Email Account

##### For Gmail:
1. **Enable 2-Factor Authentication** in Google Account
2. **Generate App Password:**
   - Go to Google Account Settings → Security
   - Click "2-Step Verification" → "App Passwords"
   - Select "Mail" and generate password
   - **Copy the 16-character password** (you'll need this)

##### For Outlook:
1. **Enable App Passwords** in Microsoft Account
2. **Generate App Password:**
   - Go to Microsoft Account Security settings
   - Click "Advanced Security Options" → "App Passwords"
   - Create new app password for "Email"
   - **Copy the generated password**

#### Step 2: Add Email Connection
1. **Go to "Email Connections"** page in eMailMind
2. **Click "Add Email Connection"**
3. **Select Provider:** Gmail or Outlook
4. **Enter Details:**
   - **Email Address:** Your business email
   - **App Password:** The password you generated (NOT your regular email password)
5. **Test Connection** → System will verify IMAP access
6. **Save Connection** → Ready for email processing

### 3. Configure Processing Settings

#### Go to Settings Page
1. **Oracle API Configuration:**
   - **Endpoint URL:** Your Oracle Integration Cloud URL
   - **Username:** Oracle API username
   - **Password:** Oracle API password
2. **Processing Preferences:**
   - **Processing Interval:** How often to check emails (15 minutes recommended)
   - **AI Threshold:** Confidence level for order detection (80% recommended)
   - **Auto-Learning:** Enable to improve accuracy over time

## 📧 Email Processing Guide

### 1. How Email Processing Works

#### Automatic Processing
- **Scheduled Scanning** - Checks emails every 15 minutes (configurable)
- **Recent Email Focus** - Processes emails from last 24 hours
- **AI Analysis** - Detects logistics orders using 200+ keywords in English and Dutch
- **Order Extraction** - Pulls order details from email content and attachments
- **XML Generation** - Creates Oracle-compatible XML files
- **Oracle Integration** - Automatically sends XML to Oracle API

#### Manual Processing
1. **Go to Dashboard**
2. **Click "Start Email Processing"**
3. **Monitor Progress** - Real-time processing status
4. **Check Results** - View processed orders in "Processed Orders" page

### 2. Understanding AI Detection

#### Supported Languages
- **English:** order, shipment, delivery, transport, freight, cargo, etc.
- **Dutch:** bestelling, verzending, levering, transport, vracht, lading, etc.

#### Logistics Keywords Detected
- **Order Terms:** order, orders, purchase order, sales order, bestelling, inkooporder
- **Transport Terms:** shipment, transport, delivery, verzending, transport, levering
- **Location Terms:** pickup, delivery, warehouse, ophalen, levering, magazijn
- **Weight Terms:** weight, kg, lbs, tons, gewicht, brutogewicht, nettogewicht
- **Package Terms:** packages, boxes, pallets, pakketten, dozen, pallets
- **Document Terms:** bill of lading, manifest, vrachtbrief, cognossement

#### Confidence Scoring
- **High Confidence (80-100%):** Clear logistics order with multiple keywords
- **Medium Confidence (50-79%):** Likely logistics order, some keywords present
- **Low Confidence (30-49%):** Possible logistics order, few keywords
- **Below Threshold (<30%):** Not considered logistics order

### 3. Attachment Processing

#### Supported File Types
- **PDF Documents** - Extracts text content for analysis
- **Word Documents** (.doc, .docx) - Extracts text content for analysis
- **Email Body** - Processes HTML and plain text content

#### What Gets Extracted
- **Order Numbers** - Reference numbers, PO numbers, order IDs
- **Customer Information** - Company names, contact details
- **Shipment Details** - Weight, package count, dimensions
- **Location Data** - Pickup and delivery addresses
- **Date Information** - Pickup dates, delivery dates, schedules

### 4. Order Management

#### Viewing Processed Orders
1. **Go to "Processed Orders"** page
2. **Filter by Date Range** - Select specific time periods
3. **Search Orders** - Find by order number, customer, or email
4. **View Details** - Click order to see all extracted information
5. **Download XML** - Get Oracle-compatible XML file

#### Order Information Display
- **Order Details** - Number, customer, weight, packages
- **Source Email** - Original email subject and sender
- **Oracle Status** - Whether XML was sent to Oracle API
- **Processing Date** - When order was extracted
- **Confidence Score** - AI detection confidence level

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Email Connection Problems

**Problem:** "Cannot connect to email account"
**Solutions:**
1. ✅ Verify you're using **App Password**, not regular email password
2. ✅ Check that 2-Factor Authentication is enabled
3. ✅ Generate new app password if existing one expired
4. ✅ Verify IMAP is enabled in your email provider settings
5. ✅ Check firewall settings aren't blocking IMAP connections

**Problem:** "Connection keeps failing"
**Solutions:**
1. ✅ Try different email provider (Gmail vs Outlook)
2. ✅ Check email account isn't locked or suspended
3. ✅ Verify email address is typed correctly
4. ✅ Contact your IT department about email security policies

#### 2. No Orders Being Detected

**Problem:** "Emails processed but no orders found"
**Solutions:**
1. ✅ Check if emails contain logistics keywords (see keyword list above)
2. ✅ Lower AI confidence threshold in settings (try 50% instead of 80%)
3. ✅ Verify emails are in English or Dutch
4. ✅ Check that emails aren't just notifications or confirmations
5. ✅ Look at system logs for analysis details

**Problem:** "Wrong orders being detected"
**Solutions:**
1. ✅ Increase AI confidence threshold (try 90%)
2. ✅ Review and train the AI with correct examples
3. ✅ Check if emails contain misleading keywords
4. ✅ Contact support to add domain-specific keywords

#### 3. Processing Issues

**Problem:** "Email processing stuck or slow"
**Solutions:**
1. ✅ Check internet connectivity
2. ✅ Verify email provider isn't rate-limiting connections
3. ✅ Restart email processing from dashboard
4. ✅ Check system logs for specific error messages
5. ✅ Contact system administrator

**Problem:** "Oracle API not receiving orders"
**Solutions:**
1. ✅ Verify Oracle API credentials in settings
2. ✅ Check Oracle API endpoint URL is correct
3. ✅ Test Oracle API connection independently
4. ✅ Review Oracle API response in order details
5. ✅ Check network connectivity to Oracle servers

#### 4. Login and Access Issues

**Problem:** "Cannot access the application"
**Solutions:**
1. ✅ Verify username and password are correct
2. ✅ Check if account setup was completed
3. ✅ Request new setup link if original expired
4. ✅ Clear browser cache and cookies
5. ✅ Try different browser or incognito mode

**Problem:** "Setup link expired"
**Solutions:**
1. ✅ Contact system administrator for new setup link
2. ✅ Setup links expire after 24 hours for security
3. ✅ Complete setup immediately after receiving link

### Error Messages Guide

#### "Email service not configured"
- **Cause:** Super admin hasn't set up SMTP settings
- **Solution:** Super admin needs to configure email in dashboard

#### "Invalid or expired setup token"
- **Cause:** Setup link is older than 24 hours
- **Solution:** Request new setup link from administrator

#### "Domain not found"
- **Cause:** Selected domain doesn't exist in system
- **Solution:** Contact administrator to create domain

#### "Connection failed - authentication error"
- **Cause:** Wrong email credentials or app password
- **Solution:** Generate new app password and try again

#### "Processing timeout"
- **Cause:** Email server not responding or network issues
- **Solution:** Check internet connection and try again

## ✅ Best Practices

### Email Management
1. **Use Dedicated Email** - Create specific email account for order processing
2. **Organize Folders** - Keep logistics emails in specific folders
3. **Regular Monitoring** - Check processing status daily
4. **Clean Up** - Archive old emails regularly to improve performance

### Security Practices
1. **Strong Passwords** - Use complex passwords for all accounts
2. **App Passwords Only** - Never use regular email passwords
3. **Regular Updates** - Keep app passwords updated and secure
4. **Monitor Access** - Review login logs regularly
5. **Secure Networks** - Use secure internet connections

### Processing Optimization
1. **Keyword Training** - Work with support to add company-specific keywords
2. **Threshold Tuning** - Adjust confidence levels based on accuracy results
3. **Regular Review** - Check extracted orders for accuracy weekly
4. **Feedback Loop** - Report issues to improve AI detection

### System Maintenance
1. **Regular Backups** - Ensure order data is backed up
2. **Monitor Logs** - Check system logs for errors weekly
3. **Update Credentials** - Refresh API credentials before expiration
4. **Performance Monitoring** - Track processing success rates

## 📊 Success Metrics

### Key Performance Indicators
- **Email Processing Rate** - Percentage of emails successfully processed
- **Order Detection Accuracy** - Percentage of correctly identified orders
- **Processing Speed** - Time from email receipt to order extraction
- **Oracle Integration Success** - Percentage of orders successfully sent to Oracle
- **System Uptime** - Application availability percentage

### Monthly Review Checklist
- [ ] Review processing accuracy rates
- [ ] Check Oracle API integration status
- [ ] Update email connection credentials if needed
- [ ] Review and clean up old processed emails
- [ ] Check system logs for recurring issues
- [ ] Update AI keywords if needed
- [ ] Verify backup procedures are working

## 📞 Support and Training

### Getting Help
1. **System Logs** - Check for error messages and processing status
2. **Dashboard Metrics** - Monitor processing success rates
3. **Documentation** - Refer to technical documentation for details
4. **Administrator Contact** - Reach out for complex configuration issues

### Training Resources
- **User Manual** - This document for step-by-step procedures
- **Technical Documentation** - Detailed system architecture and API information
- **MilesWeb Setup Guide** - Server deployment and maintenance procedures

### Support Escalation
1. **Level 1:** Check this documentation and system logs
2. **Level 2:** Contact system administrator
3. **Level 3:** Contact DiligentIX Consulting for technical support

---

**Version:** 2.0 with Complete Email Processing
**Last Updated:** January 2025
**Support Contact:** DiligentIX Consulting
**Website:** https://email.mind.diligentixconsulting.com/