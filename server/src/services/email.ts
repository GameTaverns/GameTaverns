import nodemailer from 'nodemailer';
import { config } from '../config.js';

// Email transporter (lazy init)
let transporter: nodemailer.Transporter | null = null;

// Timeout for SMTP operations (15 seconds)
const SMTP_TIMEOUT_MS = 15000;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    // Check if we're using local Postfix (no auth) or external SMTP (with auth)
    const isLocalPostfix = config.smtp.host === 'localhost' && !config.smtp.user;
    
    if (isLocalPostfix) {
      // Local Postfix - no authentication needed
      transporter = nodemailer.createTransport({
        host: 'localhost',
        port: config.smtp.port || 25,
        secure: false,
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
        socketTimeout: SMTP_TIMEOUT_MS,
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      // External SMTP with authentication
      if (!config.smtp.host) {
        throw new Error('SMTP configuration is incomplete');
      }
      
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
        socketTimeout: SMTP_TIMEOUT_MS,
        auth: config.smtp.user ? {
          user: config.smtp.user,
          pass: config.smtp.pass,
        } : undefined,
        // Enable debug logging for troubleshooting
        logger: config.nodeEnv !== 'production',
        debug: config.nodeEnv !== 'production',
      });
    }
  }
  return transporter;
}

/**
 * Check if email is configured (either local Postfix or external SMTP)
 */
export function isEmailConfigured(): boolean {
  // Email is configured if we have an SMTP host - the from address alone is not enough
  // We need an actual mail server to send through
  const isConfigured = !!config.smtp.host;
  
  if (!isConfigured && config.nodeEnv !== 'test') {
    console.log('[Email] SMTP not configured - SMTP_HOST is empty. Email verification disabled.');
  }
  
  return isConfigured;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Verify SMTP connection is working
 * Call this on startup to catch config issues early
 */
export async function verifySmtpConnection(): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.log('SMTP not configured, skipping verification');
    return false;
  }
  
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('✓ SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('✗ SMTP connection verification failed:', error);
    return false;
  }
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const transport = getTransporter();
  
  console.log(`Sending email to ${options.to}: "${options.subject}"`);
  const startTime = Date.now();
  
  try {
    const result = await transport.sendMail({
      from: options.from || config.smtp.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@gametaverns.com?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`✓ Email sent successfully in ${elapsed}ms. MessageId: ${result.messageId}`);
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`✗ Email failed after ${elapsed}ms:`, error.message);
    
    // Reset transporter on connection errors to force reconnect
    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.log('Resetting SMTP transporter due to connection error');
      transporter = null;
    }
    
    throw error;
  }
}

// =====================
// Email Templates
// =====================

function getBaseTemplate(content: string, logoUrl?: string): string {
  const logo = logoUrl || `${config.siteUrl}/logo.png`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.siteName}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header img { max-height: 60px; }
        .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #d97706, #c2410c); color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        h1 { color: #333; margin-bottom: 20px; }
        p { color: #555; line-height: 1.6; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin: 20px 0; color: #856404; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <img src="${logo}" alt="${config.siteName}">
          </div>
          ${content}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${config.siteName}. All rights reserved.</p>
          <p>If you didn't request this email, you can safely ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildVerificationEmail(email: string, token: string, libraryName?: string): { subject: string; html: string } {
  const verifyUrl = `${config.siteUrl}/verify-email?token=${token}`;
  const displayName = libraryName || config.siteName;
  
  const content = `
    <h1>Welcome to ${displayName}!</h1>
    <p>Thanks for signing up. Please verify your email address to complete your registration.</p>
    <p style="text-align: center;">
      <a href="${verifyUrl}" class="button">Verify Email Address</a>
    </p>
    <p>Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; font-size: 12px; color: #888;">${verifyUrl}</p>
    <div class="warning">
      This link will expire in 24 hours.
    </div>
  `;
  
  return {
    subject: `Verify your email for ${displayName}`,
    html: getBaseTemplate(content),
  };
}

export function buildPasswordResetEmail(email: string, token: string): { subject: string; html: string } {
  const resetUrl = `${config.siteUrl}/reset-password?token=${token}`;
  
  const content = `
    <h1>Password Reset Request</h1>
    <p>We received a request to reset the password for your account (${email}).</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; font-size: 12px; color: #888;">${resetUrl}</p>
    <div class="warning">
      This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
    </div>
  `;
  
  return {
    subject: `Reset your ${config.siteName} password`,
    html: getBaseTemplate(content),
  };
}

export function buildContactEmail(
  senderName: string,
  senderEmail: string,
  message: string,
  gameName: string,
  libraryName: string
): { subject: string; html: string } {
  const content = `
    <h1>New Message About: ${gameName}</h1>
    <p><strong>From:</strong> ${senderName} (${senderEmail})</p>
    <p><strong>Library:</strong> ${libraryName}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p>${message.replace(/\n/g, '<br>')}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #888; font-size: 12px;">Reply directly to this email to respond to ${senderName}.</p>
  `;
  
  return {
    subject: `[${libraryName}] Message about ${gameName}`,
    html: getBaseTemplate(content),
  };
}

export function buildWelcomeEmail(email: string, libraryName: string, libraryUrl: string): { subject: string; html: string } {
  const content = `
    <h1>Your library is ready!</h1>
    <p>Congratulations! Your board game library <strong>${libraryName}</strong> has been created.</p>
    <p style="text-align: center;">
      <a href="${libraryUrl}" class="button">Visit Your Library</a>
    </p>
    <p>Here's what you can do next:</p>
    <ul style="color: #555; line-height: 1.8;">
      <li>Add games to your collection</li>
      <li>Customize your library's theme and branding</li>
      <li>Share your library with friends</li>
      <li>Create game night polls</li>
    </ul>
    <p>Need help? Check out our <a href="${config.siteUrl}/docs">documentation</a> or contact us at admin@gametaverns.com.</p>
  `;
  
  return {
    subject: `Your ${config.siteName} library is ready!`,
    html: getBaseTemplate(content),
  };
}
