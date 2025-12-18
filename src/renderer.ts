/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

declare global {
  interface Window {
    electronAPI: {
      saveSMTPSettings: (settings: any) => Promise<any>;
      getSMTPSettings: () => Promise<any>;
      testSMTPConnection: (settings: any) => Promise<any>;
      sendEmail: (emailData: any) => Promise<any>;
      selectPDF: () => Promise<any>;
      extractPDFData: (filePath: string) => Promise<any>;
      closeWindow: () => void;
    };
  }
}

// Check if we're on settings page
const urlParams = new URLSearchParams(window.location.search);
const isSettingsPage = urlParams.get('page') === 'settings';

if (isSettingsPage) {
  initSettingsPage();
} else {
  initMainPage();
}

function initMainPage() {
  const mainPage = document.getElementById('main-page');
  const settingsPage = document.getElementById('settings-page');
  
  if (mainPage) mainPage.style.display = 'block';
  if (settingsPage) settingsPage.style.display = 'none';

  const emailForm = document.getElementById('email-form') as HTMLFormElement;
  const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const browseBtnSpan = document.getElementById('browse-btn') as HTMLSpanElement;
  const fileNameDisplay = document.getElementById('file-name') as HTMLParagraphElement;
  const statusMessage = document.getElementById('status-message') as HTMLDivElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
  const nameInput = document.getElementById('name') as HTMLInputElement;
  const anredeSelect = document.getElementById('anrede') as HTMLSelectElement;
  const messageTextarea = document.getElementById('message') as HTMLTextAreaElement;

  let selectedFile: string | null = null;

  // Template for invoice email - use {{ANREDE}} and {{NAME}} as placeholders
  const invoiceTemplate = `Sehr geehrte{{ANREDE_SUFFIX}} {{ANREDE}} {{NAME}},

anbei erhalten Sie Ihre Rechnung für die zahnärztliche Behandlung in unserer Praxis.

Bitte überweisen Sie den Rechnungsbetrag innerhalb von 14 Tagen auf das in der Rechnung angegebene Konto.

Bei Fragen zu Ihrer Rechnung stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihre Zahnarztpraxis
ZÄ Turan & Kaganaslan`;

  // Function to generate message from template
  function generateMessageFromTemplate(anrede: string, name: string): string {
    let message = invoiceTemplate;
    
    // Set the suffix based on gender (r for Herr, empty for Frau)
    const suffix = anrede === 'Herr' ? 'r' : '';
    
    message = message.replace('{{ANREDE_SUFFIX}}', suffix);
    message = message.replace('{{ANREDE}}', anrede || '');
    message = message.replace('{{NAME}}', name || '');
    
    return message;
  }

  // Helper function to handle PDF selection and extraction
  async function handlePDFSelection() {
    const result = await window.electronAPI.selectPDF();
    if (result.success && result.filePath) {
      selectedFile = result.filePath;
      const fileName = result.filePath.split('/').pop() || result.filePath.split('\\').pop();
      fileNameDisplay.textContent = `📄 ${fileName}`;
      
      // Extract data from PDF
      showStatus('Extracting data from PDF...', 'success');
      const extractResult = await window.electronAPI.extractPDFData(result.filePath);
      
      if (extractResult.success && extractResult.data) {
        // Set the Anrede field with extracted salutation
        if (extractResult.data.anrede) {
          anredeSelect.value = extractResult.data.anrede;
        }
        
        // Set the name field with extracted data
        if (extractResult.data.name) {
          nameInput.value = extractResult.data.name;
          const anredeText = extractResult.data.anrede ? `${extractResult.data.anrede} ` : '';
          showStatus(`Extracted: ${anredeText}${extractResult.data.name}`, 'success');
        }
        
        // Generate and set the message from template
        const generatedMessage = generateMessageFromTemplate(
          extractResult.data.anrede || '',
          extractResult.data.name || ''
        );
        messageTextarea.value = generatedMessage;
        
        // Show extracted text for debugging
        if (extractResult.data.extractedText) {
          console.log('Extracted text:', extractResult.data.extractedText);
        }
      } else {
        showStatus(extractResult.error || 'Failed to extract data from PDF', 'error');
      }
    }
  }

  // Drag and drop handlers
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    // Trigger file selection dialog instead of using dropped file path
    // This is necessary because file paths from drag/drop are restricted in Electron
    await handlePDFSelection();
  });

  // Browse button click
  browseBtnSpan?.addEventListener('click', async () => {
    await handlePDFSelection();
  });

  dropZone?.addEventListener('click', async (e) => {
    if (e.target !== browseBtnSpan) {
      await handlePDFSelection();
    }
  });

  // File input is no longer needed but keep for compatibility
  fileInput?.addEventListener('change', async () => {
    await handlePDFSelection();
  });

  // Form submission
  emailForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(emailForm);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const message = formData.get('message') as string;

    if (!name || !email || !message) {
      showStatus('Please fill in all required fields', 'error');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
      const result = await window.electronAPI.sendEmail({
        name,
        email,
        recipientEmail: email, // You can modify this to send to a specific recipient
        message,
        pdfPath: selectedFile,
      });

      if (result.success) {
        showStatus(result.message, 'success');
        emailForm.reset();
        selectedFile = null;
        fileNameDisplay.textContent = '';
      } else {
        showStatus(result.error || 'Failed to send email', 'error');
      }
    } catch (error) {
      showStatus('An error occurred while sending the email', 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Email';
    }
  });

  function showStatus(message: string, type: 'success' | 'error') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 5000);
  }
}

function initSettingsPage() {
  const mainPage = document.getElementById('main-page');
  const settingsPage = document.getElementById('settings-page');
  
  if (mainPage) mainPage.style.display = 'none';
  if (settingsPage) settingsPage.style.display = 'block';

  const settingsForm = document.getElementById('settings-form') as HTMLFormElement;
  const testBtn = document.getElementById('test-btn') as HTMLButtonElement;
  const settingsStatus = document.getElementById('settings-status') as HTMLDivElement;
  const closeBtn = document.getElementById('close-settings-btn') as HTMLButtonElement;
  const secureCheckbox = document.getElementById('smtp-secure') as HTMLInputElement;
  const portInput = document.getElementById('smtp-port') as HTMLInputElement;

  // Auto-update port when TLS checkbox changes
  secureCheckbox?.addEventListener('change', () => {
    if (secureCheckbox.checked) {
      portInput.value = '465';
    } else {
      portInput.value = '587';
    }
  });

  // Close button handler
  closeBtn?.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });

  // Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.electronAPI.closeWindow();
    }
  });

  // Load existing settings
  loadSettings();

  async function loadSettings() {
    try {
      const result = await window.electronAPI.getSMTPSettings();
      if (result.success && result.settings) {
        const settings = result.settings;
        (document.getElementById('smtp-host') as HTMLInputElement).value = settings.host || '';
        (document.getElementById('smtp-port') as HTMLInputElement).value = settings.port || '587';
        (document.getElementById('smtp-secure') as HTMLInputElement).checked = settings.secure || false;
        (document.getElementById('smtp-user') as HTMLInputElement).value = settings.user || '';
        (document.getElementById('smtp-password') as HTMLInputElement).value = settings.password || '';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // Test connection button
  testBtn?.addEventListener('click', async () => {
    const settings = getFormSettings();
    
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
      const result = await window.electronAPI.testSMTPConnection(settings);
      
      if (result.success) {
        showSettingsStatus(result.message, 'success');
      } else {
        showSettingsStatus(result.error || 'Connection failed', 'error');
      }
    } catch (error) {
      showSettingsStatus('Failed to test connection', 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  });

  // Save settings
  settingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const settings = getFormSettings();

    try {
      const result = await window.electronAPI.saveSMTPSettings(settings);
      
      if (result.success) {
        showSettingsStatus('Settings saved successfully!', 'success');
      } else {
        showSettingsStatus(result.error || 'Failed to save settings', 'error');
      }
    } catch (error) {
      showSettingsStatus('Failed to save settings', 'error');
    }
  });

  function getFormSettings() {
    return {
      host: (document.getElementById('smtp-host') as HTMLInputElement).value,
      port: parseInt((document.getElementById('smtp-port') as HTMLInputElement).value),
      secure: (document.getElementById('smtp-secure') as HTMLInputElement).checked,
      user: (document.getElementById('smtp-user') as HTMLInputElement).value,
      password: (document.getElementById('smtp-password') as HTMLInputElement).value,
    };
  }

  function showSettingsStatus(message: string, type: 'success' | 'error') {
    settingsStatus.textContent = message;
    settingsStatus.className = `status-message ${type}`;
    
    setTimeout(() => {
      settingsStatus.className = 'status-message';
    }, 5000);
  }
}
