# eMailMind - MilesWeb Deployment Documentation

## 📋 Table of Contents
1. [Server Configuration](#server-configuration)
2. [Database Setup](#database-setup)
3. [File Structure](#file-structure)
4. [Installation Steps](#installation-steps)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Process](#deployment-process)
7. [Testing Procedures](#testing-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

## 🖥️ Server Configuration

### MilesWeb Hosting Details
- **Website URL:** https://email.mind.diligentixconsulting.com/
- **Subdomain Setup:** email.mind pointing to /home/bevhagfn/email.mind
- **Document Root:** /home/bevhagfn/email.mind
- **Frontend Location:** /home/bevhagfn/email.mind/emailmind/
- **Backend Location:** /home/bevhagfn/email.mind/api/

### Node.js Application Configuration
- **Application Root:** email.mind/api
- **Application URL:** email.mind.diligentixconsulting.com
- **Startup File:** index.cjs
- **Port:** 3001
- **Mode:** Production
- **Node.js Version:** 19.9.0 (recommended)

## 🗄️ Database Setup

### MySQL Database Configuration
```
Host: 103.191.208.49
Port: 3306
Database: bevhagfn_emailmind_db
Username: bevhagfn_emailmind_user
Password: DiliGentiX123456
SSL: false
```

### Database Tables
The application will automatically create these tables on first run:
- `domains` - Client domain organization
- `users` - User accounts and authentication
- `email_connections` - Email account connections
- `processed_emails` - Processed email data
- `extracted_orders` - Extracted order information
- `system_logs` - System activity logs

### Default Super Admin Account
- **Username:** admin
- **Password:** admin123
- **⚠️ Important:** Change this password immediately after deployment

## 📁 File Structure on MilesWeb

### Complete Directory Structure
```
/home/bevhagfn/email.mind/
├── api/                          # Backend Node.js application
│   ├── config/
│   │   └── database.cjs          # Database configuration
│   ├── services/
│   │   ├── authService.cjs       # Authentication service
│   │   ├── emailService.cjs      # SMTP email service
│   │   ├── emailProcessingService.cjs # Email processing engine
│   │   └── logService.cjs        # Logging service
│   ├── index.cjs                 # Main server file
│   ├── package.json              # Node.js dependencies
│   └── node_modules/             # Installed packages
├── emailmind/                    # Frontend React application
│   ├── assets/                   # Static assets
│   ├── index.html                # Main HTML file
│   └── *.js, *.css files         # Built frontend files
└── index.html                    # Root redirect (optional)
```

### File Permissions
- **Directories:** 755
- **Files:** 644
- **Node.js files:** 644
- **Executable files:** 755

## 🚀 Installation Steps

### Step 1: Prepare Local Development
1. **Build Frontend Application:**
   ```bash
   npm run build
   ```
   This creates the `dist/` folder with built files

2. **Prepare Backend Files:**
   - Ensure all `.cjs` files are ready
   - Verify `package.json` has all dependencies

### Step 2: Upload Files to MilesWeb

#### Upload Backend Files
1. **Navigate to:** `/home/bevhagfn/email.mind/api/`
2. **Upload these files:**
   - `index.cjs`
   - `package.json`
   - `config/database.cjs`
   - `services/authService.cjs`
   - `services/emailService.cjs`
   - `services/emailProcessingService.cjs`
   - `services/logService.cjs`

#### Upload Frontend Files
1. **Navigate to:** `/home/bevhagfn/email.mind/emailmind/`
2. **Upload all files from `dist/` folder:**
   - `index.html`
   - `assets/` folder (all CSS and JS files)
   - Any other built files

### Step 3: Install Node.js Dependencies
1. **Access cPanel File Manager**
2. **Navigate to:** `/home/bevhagfn/email.mind/api/`
3. **Open Terminal** (if available) or use cPanel Node.js interface
4. **Install dependencies:**
   ```bash
   npm install
   ```

#### Required Dependencies
```json
{
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5",
    "mysql2": "^3.14.5",
    "bcryptjs": "^3.0.2",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^7.0.6",
    "imapflow": "^1.0.196",
    "crypto-js": "^4.2.0",
    "axios": "^1.7.7",
    "uuid": "^13.0.0",
    "dotenv": "^17.2.2"
  }
}
```

### Step 4: Configure Node.js Application in cPanel

#### Create Node.js Application
1. **Go to cPanel → Node.js Apps**
2. **Click "Create Application"**
3. **Configure:**
   - **Node.js Version:** 19.9.0
   - **Application Mode:** Production
   - **Application Root:** email.mind/api
   - **Application URL:** email.mind.diligentixconsulting.com
   - **Application Startup File:** index.cjs

## ⚙️ Environment Configuration

### Environment Variables in cPanel
Set these variables in the Node.js application settings:

```
EMAIL_FROM=support@diligentixconsulting.com
FRONTEND_URL=https://email.mind.diligentixconsulting.com
JWT_SECRET=EmailMind-Production-2024-DiligentIX-a7b3c9d2e8f4g1h5i9j3k7l2m6n0p4q8
NODE_ENV=production
PORT=3001
```

### Database Configuration
The database settings are hardcoded in `database.cjs`:
```javascript
host: '103.191.208.49',
port: 3306,
database: 'bevhagfn_emailmind_db',
user: 'bevhagfn_emailmind_user',
password: 'DiliGentiX123456',
ssl: false
```

## 🚀 Deployment Process

### Step-by-Step Deployment

#### 1. Pre-Deployment Checklist
- [ ] Frontend built successfully (`npm run build`)
- [ ] All backend files prepared
- [ ] Database credentials verified
- [ ] Environment variables ready

#### 2. File Upload Process
1. **Backend Upload:**
   - Upload to `/home/bevhagfn/email.mind/api/`
   - Maintain directory structure
   - Verify file permissions

2. **Frontend Upload:**
   - Upload built files to `/home/bevhagfn/email.mind/emailmind/`
   - Ensure `index.html` is in root
   - Upload all assets

#### 3. Node.js Configuration
1. **Create application in cPanel**
2. **Set environment variables**
3. **Install dependencies**
4. **Start application**

#### 4. Database Initialization
The application will automatically:
- Create all required tables
- Set up default super admin account
- Initialize system logs

#### 5. Verification Steps
1. **Check Node.js app status** - Should show "Running"
2. **Test frontend access** - Visit https://email.mind.diligentixconsulting.com/
3. **Test login** - Use admin/admin123
4. **Verify database connection** - Check dashboard status

## 🧪 Testing Procedures

### 1. Basic Functionality Tests

#### Test 1: Application Access
1. **Navigate to:** https://email.mind.diligentixconsulting.com/
2. **Expected:** Login page loads correctly
3. **Verify:** No console errors, proper styling

#### Test 2: Authentication
1. **Login with:** admin / admin123
2. **Expected:** Successful login, redirect to dashboard
3. **Verify:** Super admin dashboard loads

#### Test 3: Database Connection
1. **Check dashboard** for database status
2. **Expected:** "Connected" status shown
3. **Verify:** Green indicator, no error messages

### 2. Email Processing Tests

#### Test 4: Email Service Configuration
1. **Go to:** Email Setup in dashboard
2. **Configure SMTP** with valid credentials
3. **Send test email**
4. **Expected:** Email sent successfully

#### Test 5: Email Connection Setup
1. **Create domain** (e.g., "TEST_DOMAIN")
2. **Create client** assigned to domain
3. **Login as client**
4. **Add email connection** with app password
5. **Expected:** Connection status shows "Connected"

#### Test 6: Email Processing
1. **Send test email** with logistics keywords to connected email
2. **Trigger manual processing** from dashboard
3. **Check processed orders** page
4. **Expected:** Order extracted and XML generated

### 3. Oracle Integration Test

#### Test 7: Oracle API Integration
1. **Process logistics email**
2. **Check extracted order** details
3. **Verify Oracle API status**
4. **Expected:** XML sent to Oracle successfully

### 4. System Monitoring Tests

#### Test 8: System Logs
1. **Access system logs** (Super Admin)
2. **Filter by different levels**
3. **Search for specific entries**
4. **Expected:** Logs display correctly, filtering works

#### Test 9: User Management
1. **Create new domain**
2. **Create new client**
3. **Client receives setup email**
4. **Client completes setup**
5. **Expected:** Full user lifecycle works

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue 1: Node.js Application Won't Start
**Symptoms:** Application shows "Stopped" status
**Solutions:**
1. Check startup file path: `index.cjs`
2. Verify all dependencies installed
3. Check environment variables
4. Review error logs in cPanel
5. Ensure file permissions are correct

#### Issue 2: Database Connection Failed
**Symptoms:** "Database Disconnected" in dashboard
**Solutions:**
1. Verify database credentials in `database.cjs`
2. Check MySQL service status
3. Test connection from cPanel phpMyAdmin
4. Verify firewall settings
5. Check database user permissions

#### Issue 3: Frontend Not Loading
**Symptoms:** Blank page or 404 errors
**Solutions:**
1. Verify files uploaded to correct directory
2. Check `index.html` exists in `/emailmind/`
3. Verify file permissions (644 for files, 755 for directories)
4. Clear browser cache
5. Check for JavaScript errors in console

#### Issue 4: Email Processing Not Working
**Symptoms:** No emails being processed
**Solutions:**
1. Verify email connections are "Connected"
2. Check app passwords are correct
3. Verify IMAP is enabled in email provider
4. Check system logs for processing errors
5. Test manual processing trigger

#### Issue 5: Oracle API Integration Failed
**Symptoms:** Orders not sent to Oracle
**Solutions:**
1. Verify Oracle API endpoint URL
2. Check network connectivity to Oracle
3. Verify API credentials
4. Check Oracle API response in order details
5. Review system logs for API errors

### Error Log Locations
- **Node.js Application Logs:** cPanel → Node.js Apps → View Logs
- **System Logs:** Available in application dashboard
- **MySQL Logs:** cPanel → MySQL Databases → Error Logs
- **Apache Logs:** cPanel → Error Logs

### Performance Optimization
1. **Enable compression** in cPanel
2. **Optimize database** queries and indexes
3. **Monitor memory usage** of Node.js app
4. **Set up caching** for static files
5. **Regular cleanup** of old logs and processed emails

## 🔄 Maintenance

### Daily Maintenance
- [ ] Check Node.js application status
- [ ] Monitor email processing success rate
- [ ] Review error logs for issues
- [ ] Verify Oracle API integration status

### Weekly Maintenance
- [ ] Review system logs for patterns
- [ ] Check database performance
- [ ] Update email connection credentials if needed
- [ ] Monitor disk space usage

### Monthly Maintenance
- [ ] Update Node.js dependencies (if needed)
- [ ] Review and archive old processed emails
- [ ] Check security logs
- [ ] Backup database
- [ ] Review user accounts and permissions

### Backup Procedures

#### Database Backup
1. **Access cPanel → phpMyAdmin**
2. **Select database:** bevhagfn_emailmind_db
3. **Export → Custom → All tables**
4. **Download SQL file**
5. **Store securely offsite**

#### File Backup
1. **Download entire `/email.mind/` directory**
2. **Include both frontend and backend files**
3. **Store configuration files separately**
4. **Maintain version history**

### Update Procedures

#### Application Updates
1. **Test updates locally first**
2. **Backup current deployment**
3. **Upload new files to staging area**
4. **Test functionality thoroughly**
5. **Deploy to production**
6. **Monitor for issues**

#### Dependency Updates
1. **Check for security updates**
2. **Test in development environment**
3. **Update `package.json`**
4. **Run `npm install` on server**
5. **Restart Node.js application**

### Security Maintenance
- **Regular password updates** for all accounts
- **Monitor login attempts** and suspicious activity
- **Keep Node.js and dependencies updated**
- **Review user permissions** quarterly
- **Check SSL certificate** status

### Performance Monitoring
- **Monitor response times** for API endpoints
- **Check database query performance**
- **Monitor memory and CPU usage**
- **Track email processing success rates**
- **Review Oracle API response times**

---

**Version:** 2.0 with Complete Email Processing
**Last Updated:** January 2025
**Support Contact:** DiligentIX Consulting
**Deployment URL:** https://email.mind.diligentixconsulting.com/