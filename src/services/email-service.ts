import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { getStoredSmtpSettings, getSmtpPassword } from './smtp-service';
import { emailHistoryOperations } from '../database';

export interface EmailData {
  recipientEmail: string;
  name: string;
  message: string;
  subject?: string;
  pdfPath?: string;
  templateId?: number;
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
    const mailOptions: any = {
      from: settings.user,
      to: emailData.recipientEmail,
      subject: subject,
      text: emailData.message,
      html: `
        <h3>Message from DentKlar</h3>
        <p>${emailData.message.replace(/\n/g, '<br>')}</p>
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
