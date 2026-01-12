import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { getStoredSmtpSettings, getSmtpPassword } from './smtp-service';
import { emailHistoryOperations, signatureOperations } from '../database';

export interface EmailData {
  recipientEmail: string;
  name: string;
  message: string;
  subject?: string;
  pdfPath?: string;
  templateId?: number;
}

// Convert Quill HTML to email-safe HTML with inline styles
function convertQuillHtmlToEmailHtml(html: string): string {
  if (!html) return '';
  
  // Convert Quill color classes to inline styles
  html = html.replace(/class="ql-color-([^"]+)"/g, (match, color) => {
    return `style="color: ${color};"`;
  });
  
  // Convert Quill background classes to inline styles
  html = html.replace(/class="ql-bg-([^"]+)"/g, (match, color) => {
    return `style="background-color: ${color};"`;
  });
  
  // Convert Quill font classes to inline styles
  html = html.replace(/class="ql-size-([^"]+)"/g, (match, size) => {
    const sizes: { [key: string]: string } = {
      'small': '0.75em',
      'large': '1.5em',
      'huge': '2.5em'
    };
    return `style="font-size: ${sizes[size] || '1em'};"`;
  });
  
  // Convert Quill font family
  html = html.replace(/class="ql-font-([^"]+)"/g, (match, font) => {
    return `style="font-family: ${font};"`;
  });
  
  // Ensure strong, em, u, s tags have proper inline styles for better compatibility
  html = html.replace(/<strong>/g, '<strong style="font-weight: bold;">');
  html = html.replace(/<em>/g, '<em style="font-style: italic;">');
  html = html.replace(/<u>/g, '<u style="text-decoration: underline;">');
  html = html.replace(/<s>/g, '<s style="text-decoration: line-through;">');
  
  // Add inline styles to all <p> tags to ensure proper line breaks
  html = html.replace(/<p>/g, '<p style="margin: 0 0 1em 0; padding: 0;">');
  html = html.replace(/<p([^>]*?)style="([^"]*?)"/g, '<p$1style="$2 margin: 0 0 1em 0; padding: 0;"');
  
  // Ensure links have proper styling
  html = html.replace(/<a /g, '<a style="color: #0066cc; text-decoration: underline;" ');
  
  // Ensure images have proper styling and attributes for email compatibility
  html = html.replace(/<img /g, '<img style="max-width: 100%; height: auto; display: block;" ');
  
  return html;
}

export async function sendEmail(emailData: EmailData): Promise<{ success: boolean; message?: string; error?: string }> {
  let pdfData: Buffer | null = null;
  let pdfFilename: string | null = null;

  try {
    const settings = getStoredSmtpSettings();
    const password = (await getSmtpPassword(settings.user)) ?? '';
    
    if (!settings || !settings.host) {
      throw new Error('SMTP settings not configured. Please configure in Settings.');
    }

    if (!password) {
      throw new Error('SMTP password not set. Please enter it in Settings.');
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: password,
      },
    });

    // Read PDF data for storage if provided
    if (emailData.pdfPath) {
      pdfData = fs.readFileSync(emailData.pdfPath);
      pdfFilename = path.basename(emailData.pdfPath);
    }

    const subject = emailData.subject || `Message from ${emailData.name}`;
    
    // Get default signature
    const defaultSignature = signatureOperations.getDefault();
    let signatureHtml = defaultSignature ? defaultSignature.content : '';
    
    // Convert Quill HTML to email-safe HTML
    signatureHtml = convertQuillHtmlToEmailHtml(signatureHtml);
    
    // Convert message text to HTML paragraphs
    const messageHtml = emailData.message
      .split('\n')
      .map(line => line.trim() ? `<p style="margin: 0 0 1em 0;">${line}</p>` : '<p style="margin: 0 0 1em 0;"><br></p>')
      .join('');
    
    const mailOptions: any = {
      from: settings.user,
      to: emailData.recipientEmail,
      subject: subject,
      text: emailData.message + (defaultSignature ? '\n\n' + defaultSignature.content.replace(/<[^>]*>/g, '') : ''),
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div class="message">
              ${messageHtml}
            </div>
            ${signatureHtml ? `<div style="margin-top: 2em; padding-top: 1em; border-top: 1px solid #ddd;">${signatureHtml}</div>` : ''}
          </div>
        </body>
        </html>
      `,
    };

    // Attach PDF if provided
    if (emailData.pdfPath) {
      mailOptions.attachments = [
        {
          filename: path.basename(emailData.pdfPath),
          path: emailData.pdfPath,
        },
      ];
    }

    await transporter.sendMail(mailOptions);

    // Save to email history
    emailHistoryOperations.create({
      template_id: emailData.templateId || null,
      recipient_name: emailData.name,
      recipient_email: emailData.recipientEmail,
      subject: subject,
      message: emailData.message,
      pdf_filename: pdfFilename,
      pdf_data: pdfData,
      status: 'sent',
      error_message: null
    });

    return { success: true, message: 'Email sent successfully!' };
  } catch (error: any) {
    // Save failed email to history
    emailHistoryOperations.create({
      template_id: emailData.templateId || null,
      recipient_name: emailData.name || '',
      recipient_email: emailData.recipientEmail || '',
      subject: emailData.subject || `Message from ${emailData.name}`,
      message: emailData.message || '',
      pdf_filename: pdfFilename,
      pdf_data: pdfData,
      status: 'failed',
      error_message: error.message
    });

    return { success: false, error: error.message };
  }
}

export async function testSmtpConnection(settings: any): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const user = String(settings?.user ?? '');
    const pass = String(settings?.password ?? '') || (await getSmtpPassword(user)) || '';

    const transporter = nodemailer.createTransport({
      host: String(settings?.host ?? ''),
      port: Number(settings?.port ?? 587),
      secure: Boolean(settings?.secure ?? false),
      auth: {
        user,
        pass,
      },
    });

    await transporter.verify();
    return { success: true, message: 'SMTP connection successful!' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
