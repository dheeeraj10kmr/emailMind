const nodemailer = require('nodemailer');
const LogService = require('./logService.cjs');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.logService = LogService.getInstance();
  }

  static getInstance() {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async configure(emailConfig) {
    try {
      this.logService.log('EMAIL_CONFIGURE_START', 'Starting email configuration', emailConfig);

      // Create transporter with provided config
      this.transporter = nodemailer.createTransporter({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure, // true for 465, false for other ports
        auth: {
          user: emailConfig.user,
          pass: emailConfig.password
        }
      });

      // Test the connection
      const connectionTest = await this.testConnection();
      
      if (connectionTest) {
        this.isConfigured = true;
        this.logService.log('EMAIL_CONFIGURE_SUCCESS', 'Email service configured successfully');
        return { success: true, message: 'Email service configured successfully' };
      } else {
        this.isConfigured = false;
        this.logService.log('EMAIL_CONFIGURE_FAILED', 'Email configuration test failed');
        return { success: false, error: 'Email configuration test failed' };
      }
    } catch (error) {
      this.isConfigured = false;
      this.logService.log('EMAIL_CONFIGURE_ERROR', 'Email configuration error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async testConnection() {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logService.log('EMAIL_TEST_CONNECTION_ERROR', 'Email connection test failed', { error: error.message });
      return false;
    }
  }

  async sendSetupEmail(email, setupToken, clientData) {
    if (!this.isConfigured || !this.transporter) {
      this.logService.log('EMAIL_SEND_NOT_CONFIGURED', 'Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Use environment variable or fallback to correct URL
      const frontendUrl = process.env.FRONTEND_URL || 'https://email.mind.diligentixconsulting.com';
      const setupLink = `${frontendUrl}/setup-password?token=${setupToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to eMailMind</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .info-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; color: #92400e; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Welcome to eMailMind</h1>
              <p>AI-Powered Email Processing for Logistics</p>
            </div>
            
            <div class="content">
              <h2>Hello ${clientData.company_name}!</h2>
              
              <p>Your eMailMind account has been successfully created. We're excited to help you streamline your logistics email processing with our AI-powered solution.</p>
              
              <div class="info-box">
                <h3>📋 Your Account Details:</h3>
                <ul>
                  <li><strong>Username:</strong> ${clientData.username}</li>
                  <li><strong>Email:</strong> ${clientData.email}</li>
                  <li><strong>Company:</strong> ${clientData.company_name}</li>
                  <li><strong>Role:</strong> ${clientData.role.replace('_', ' ').toUpperCase()}</li>
                </ul>
              </div>
              
              <h3>🔐 Complete Your Setup</h3>
              <p>To get started, please set up your password by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${setupLink}" class="button">Set Up Your Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace;">${setupLink}</p>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This setup link will expire in 24 hours for security reasons. Please complete your setup as soon as possible.
              </div>
              
              <h3>🎯 What's Next?</h3>
              <ol>
                <li>Click the setup link above to create your password</li>
                <li>Log in to your eMailMind dashboard</li>
                <li>Connect your email accounts (Outlook/Gmail)</li>
                <li>Configure your Oracle API settings</li>
                <li>Start processing logistics emails with AI!</li>
              </ol>
              
              <h3>✨ Key Features:</h3>
              <ul>
                <li>🤖 AI-powered email analysis</li>
                <li>📧 Support for Outlook and Gmail</li>
                <li>🔗 Direct Oracle API integration</li>
                <li>📊 Real-time processing dashboard</li>
                <li>🛡️ Secure, domain-based separation</li>
              </ul>
            </div>
            
            <div class="footer">
              <p><strong>Need Help?</strong></p>
              <p>If you have any questions or need assistance, please contact our support team.</p>
              <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
                This email was sent from eMailMind. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@diligentixconsulting.com',
        to: email,
        subject: '🚀 Welcome to eMailMind - Complete Your Setup',
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      
      this.logService.log('EMAIL_SEND_SUCCESS', 'Setup email sent successfully', { 
        email, 
        setupLink,
        company: clientData.company_name 
      });
      
      return { success: true, message: 'Setup email sent successfully' };
    } catch (error) {
      this.logService.log('EMAIL_SEND_ERROR', 'Failed to send setup email', { 
        email, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  async sendTestEmail(email) {
    if (!this.isConfigured || !this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@diligentixconsulting.com',
        to: email,
        subject: '✅ eMailMind Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; text-align: center; border-radius: 8px;">
              <h1>✅ Test Email Successful!</h1>
              <p>Your eMailMind email service is working correctly.</p>
            </div>
            <div style="padding: 20px; background: #f9fafb; margin-top: 20px; border-radius: 8px;">
              <p>This is a test email from your eMailMind system.</p>
              <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
              <p>If you received this email, your SMTP configuration is working properly!</p>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      
      this.logService.log('EMAIL_TEST_SUCCESS', 'Test email sent successfully', { email });
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      this.logService.log('EMAIL_TEST_ERROR', 'Failed to send test email', { email, error: error.message });
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      connectionTest: this.isConfigured && this.transporter !== null
    };
  }
}

module.exports = EmailService;