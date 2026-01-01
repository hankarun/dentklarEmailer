import './index.css';
import i18n, { t, changeLanguage, getCurrentLanguage } from './i18n';

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      saveSMTPSettings: (settings: any) => Promise<any>;
      getSMTPSettings: () => Promise<any>;
      testSMTPConnection: (settings: any) => Promise<any>;
      sendEmail: (emailData: any) => Promise<any>;
      selectPDF: () => Promise<any>;
      selectMultiplePDFs: () => Promise<{ success: boolean; filePaths?: string[]; error?: string }>;
      extractPDFData: (filePath: string) => Promise<any>;
      closeWindow: () => void;
      // Template operations
      getTemplates: () => Promise<{ success: boolean; templates?: Template[]; error?: string }>;
      getTemplate: (id: number) => Promise<{ success: boolean; template?: Template; error?: string }>;
      getDefaultTemplate: () => Promise<{ success: boolean; template?: Template; error?: string }>;
      createTemplate: (template: any) => Promise<{ success: boolean; template?: Template; error?: string }>;
      updateTemplate: (id: number, template: any) => Promise<{ success: boolean; template?: Template; error?: string }>;
      deleteTemplate: (id: number) => Promise<{ success: boolean; error?: string }>;
      setDefaultTemplate: (id: number) => Promise<{ success: boolean; error?: string }>;
      // Email history
      getEmailHistory: (limit?: number, offset?: number) => Promise<any>;
      saveEmailHistory: (emailData: any) => Promise<any>;
      searchEmailHistory: (query: string) => Promise<any>;
      getEmailStats: () => Promise<any>;
      deleteEmailHistory: (id: number) => Promise<any>;
      getEmailPdf: (id: number) => Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>;
      // User email operations
      getUserEmailByName: (name: string) => Promise<{ success: boolean; userEmail?: { id: number; name: string; email: string }; error?: string }>;
      getAllUserEmails: () => Promise<{ success: boolean; userEmails?: Array<{ id: number; name: string; email: string }>; error?: string }>;
      saveUserEmail: (name: string, email: string) => Promise<{ success: boolean; userEmail?: { id: number; name: string; email: string }; error?: string }>;
      searchUserEmails: (query: string) => Promise<{ success: boolean; userEmails?: Array<{ id: number; name: string; email: string }>; error?: string }>;
      deleteUserEmail: (id: number) => Promise<{ success: boolean; error?: string }>;
      // Events
      onTemplatesUpdated: (callback: () => void) => () => void;
      // Auto-update
      checkForUpdates: () => Promise<{ success: boolean; result?: any; error?: string }>;
      quitAndInstall: () => void;
      onUpdateChecking: (callback: () => void) => () => void;
      onUpdateAvailable: (callback: (info: any) => void) => () => void;
      onUpdateNotAvailable: (callback: (info: any) => void) => () => void;
      onUpdateError: (callback: (error: string) => void) => () => void;
      onUpdateDownloadProgress: (callback: (progress: any) => void) => () => void;
      onUpdateDownloaded: (callback: (info: any) => void) => () => void;
    };
  }
}

// Check which page to show
const urlParams = new URLSearchParams(window.location.search);
const page = urlParams.get('page');

// Initialize navigation
initNavigation();

// Initialize all pages
initComposePage();
initBulkPage();
initHistoryPage();
initSettingsPage();
initTemplatesPage();
initAboutPage();

// Apply translations on load
updateAllTranslations();

// Listen for language changes
window.addEventListener('language-changed', () => {
  updateAllTranslations();
  // Re-render dynamic content
  loadEmailHistory();
});

// Show initial page
if (page === 'settings') {
  showPage('settings');
} else if (page === 'templates') {
  showPage('templates');
} else if (page === 'history') {
  showPage('history');
} else if (page === 'bulk') {
  showPage('bulk');
} else if (page === 'about') {
  showPage('about');
} else {
  showPage('compose');
}

// Function to update all translations in the UI
function updateAllTranslations() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
  
  // Update all placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      (el as HTMLInputElement).placeholder = t(key);
    }
  });
}

function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageName = (link as HTMLElement).dataset.page;
      if (pageName) {
        showPage(pageName);
      }
    });
  });
}

function showPage(pageName: string) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    (page as HTMLElement).style.display = 'none';
  });
  
  // Remove active class from all nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Show selected page
  const selectedPage = document.getElementById(`${pageName}-page`);
  if (selectedPage) {
    selectedPage.style.display = 'flex';
  }
  
  // Add active class to nav link
  const selectedLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
  if (selectedLink) {
    selectedLink.classList.add('active');
  }

  // Trigger page-specific refresh
  if (pageName === 'history') {
    loadEmailHistory();
  } else if (pageName === 'compose') {
    // Dispatch event to refresh templates on compose page
    window.dispatchEvent(new CustomEvent('refresh-compose-templates'));
  }
}

function initComposePage() {
  const composePage = document.getElementById('compose-page');

  const emailForm = document.getElementById('email-form') as HTMLFormElement;
  const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const browseBtnSpan = document.getElementById('browse-btn') as HTMLSpanElement;
  const fileNameDisplay = document.getElementById('file-name') as HTMLParagraphElement;
  const statusMessage = document.getElementById('status-message') as HTMLDivElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
  const nameInput = document.getElementById('name') as HTMLInputElement;
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const anredeSelect = document.getElementById('anrede') as HTMLSelectElement;
  const messageTextarea = document.getElementById('message') as HTMLTextAreaElement;
  const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
  const subjectInput = document.getElementById('subject') as HTMLInputElement;

  let selectedFile: string | null = null;
  let selectedTemplateId: number | null = null;
  let templates: Template[] = [];
  let emailLookupDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Load templates on page load
  loadTemplates();

  // Listen for template updates from main process
  window.electronAPI.onTemplatesUpdated(() => {
    loadTemplates();
  });

  // Listen for page navigation refresh
  window.addEventListener('refresh-compose-templates', () => {
    loadTemplates();
    // Check if name field has value and look up email
    lookupEmailForCurrentName();
  });

  // Function to look up email for current name value
  async function lookupEmailForCurrentName() {
    const name = nameInput.value.trim();
    if (name.length > 0 && !emailInput.value.trim()) {
      const result = await window.electronAPI.getUserEmailByName(name);
      if (result.success && result.userEmail && result.userEmail.email) {
        emailInput.value = result.userEmail.email;
        emailInput.dataset.autoFilled = 'true';
        showStatus(t('compose.emailFound') || `Email found for ${name}`, 'success');
      }
    }
  }

  // Listen for repeat email event from history page
  window.addEventListener('repeat-email', (async (e: CustomEvent) => {
    const email = e.detail;
    if (email) {
      // Populate form fields with email data
      nameInput.value = email.recipient_name || '';
      (document.getElementById('email') as HTMLInputElement).value = email.recipient_email || '';
      subjectInput.value = email.subject || '';
      messageTextarea.value = email.message || '';
      
      // Try to detect anrede from the message or name
      if (email.message?.includes('Sehr geehrter Herr') || email.message?.includes('Lieber Herr')) {
        anredeSelect.value = 'Herr';
      } else if (email.message?.includes('Sehr geehrte Frau') || email.message?.includes('Liebe Frau')) {
        anredeSelect.value = 'Frau';
      }
      
      // Clear template selection since we're using custom data
      templateSelect.value = '';
      selectedTemplateId = null;
      
      // Try to extract PDF from email history if it has one
      if (email.pdf_filename) {
        const pdfResult = await window.electronAPI.getEmailPdf(email.id);
        if (pdfResult.success && pdfResult.filePath) {
          selectedFile = pdfResult.filePath;
          fileNameDisplay.textContent = `📄 ${pdfResult.filename}`;
        } else {
          selectedFile = null;
          fileNameDisplay.textContent = '';
        }
      } else {
        selectedFile = null;
        fileNameDisplay.textContent = '';
      }
    }
  }) as EventListener);

  async function loadTemplates() {
    try {
      const result = await window.electronAPI.getTemplates();
      if (result.success && result.templates) {
        templates = result.templates;
        populateTemplateSelect();
        
        // Select default template if nothing selected yet
        const defaultTemplate = templates.find(t => t.is_default);
        if (defaultTemplate && !selectedTemplateId) {
          templateSelect.value = String(defaultTemplate.id);
          selectedTemplateId = defaultTemplate.id;
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  function populateTemplateSelect() {
    // Clear existing options except the first one
    templateSelect.innerHTML = `<option value="">${t('compose.selectTemplate')}</option>`;
    
    templates.forEach(template => {
      const option = document.createElement('option');
      option.value = String(template.id);
      option.textContent = template.name + (template.is_default ? ' ★' : '');
      templateSelect.appendChild(option);
    });

    // Restore selection if exists
    if (selectedTemplateId) {
      templateSelect.value = String(selectedTemplateId);
    }
  }

  // Template selection handler
  templateSelect?.addEventListener('change', () => {
    const templateId = parseInt(templateSelect.value);
    selectedTemplateId = templateId || null;
    
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        // Set subject
        subjectInput.value = template.subject || '';
        
        // Apply template with current name/anrede if available
        applyTemplate(template, anredeSelect.value, nameInput.value);
      }
    }
  });

  // Function to apply template with placeholders
  function applyTemplate(template: Template, anrede: string, name: string): void {
    let message = template.body;
    
    // Set the suffix based on gender (r for Herr, empty for Frau)
    const suffix = anrede === 'Herr' ? 'r' : '';
    
    message = message.replace(/\{\{ANREDE_SUFFIX\}\}/g, suffix);
    message = message.replace(/\{\{ANREDE\}\}/g, anrede || '');
    message = message.replace(/\{\{NAME\}\}/g, name || '');
    
    messageTextarea.value = message;
  }

  // Update message when anrede or name changes
  anredeSelect?.addEventListener('change', () => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        applyTemplate(template, anredeSelect.value, nameInput.value);
      }
    }
  });

  nameInput?.addEventListener('input', () => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        applyTemplate(template, anredeSelect.value, nameInput.value);
      }
    }
    
    // Look up saved email for this name (debounced)
    if (emailLookupDebounceTimer) {
      clearTimeout(emailLookupDebounceTimer);
    }
    emailLookupDebounceTimer = setTimeout(async () => {
      const name = nameInput.value.trim();
      if (name.length > 0) {
        const result = await window.electronAPI.getUserEmailByName(name);
        if (result.success && result.userEmail && result.userEmail.email) {
          // Only auto-fill if email field is empty or was auto-filled before
          const currentEmail = emailInput.value.trim();
          if (!currentEmail || emailInput.dataset.autoFilled === 'true') {
            emailInput.value = result.userEmail.email;
            emailInput.dataset.autoFilled = 'true';
            showStatus(t('compose.emailFound') || `Email found for ${name}`, 'success');
          }
        }
      }
    }, 300);
  });
  
  // Clear auto-filled flag when user manually edits email
  emailInput?.addEventListener('input', () => {
    emailInput.dataset.autoFilled = 'false';
  });

  // Helper function to handle PDF selection and extraction
  async function handlePDFSelection() {
    const result = await window.electronAPI.selectPDF();
    if (result.success && result.filePath) {
      selectedFile = result.filePath;
      const fileName = result.filePath.split('/').pop() || result.filePath.split('\\').pop();
      fileNameDisplay.textContent = `📄 ${fileName}`;
      
      // Extract data from PDF
      showStatus(t('compose.extracting'), 'success');
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
          showStatus(t('compose.extracted', { anrede: anredeText, name: extractResult.data.name }), 'success');
          
          // Look up saved email for this name
          const emailResult = await window.electronAPI.getUserEmailByName(extractResult.data.name);
          if (emailResult.success && emailResult.userEmail && emailResult.userEmail.email) {
            emailInput.value = emailResult.userEmail.email;
            emailInput.dataset.autoFilled = 'true';
          }
        }
        
        // Apply current template with extracted data
        if (selectedTemplateId) {
          const template = templates.find(t => t.id === selectedTemplateId);
          if (template) {
            // Set subject from template
            subjectInput.value = template.subject || '';
            applyTemplate(template, extractResult.data.anrede || '', extractResult.data.name || '');
          }
        }
        
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
    const subject = formData.get('subject') as string;

    if (!name || !email || !message) {
      showEmailModal('error', t('modal.missingFields'), t('modal.missingFieldsMsg'), '');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = t('compose.sending');

    try {
      const result = await window.electronAPI.sendEmail({
        name,
        email,
        recipientEmail: email,
        message,
        subject: subject || undefined,
        pdfPath: selectedFile,
        templateId: selectedTemplateId,
      });

      if (result.success) {
        // Save user email for future use
        if (name && email) {
          await window.electronAPI.saveUserEmail(name, email);
        }
        
        const details = `
          <div class="detail-row"><span class="detail-label">${t('modal.recipient')}:</span> ${name} &lt;${email}&gt;</div>
          <div class="detail-row"><span class="detail-label">${t('modal.subject')}:</span> ${subject || t('history.noSubject')}</div>
          ${selectedFile ? `<div class="detail-row"><span class="detail-label">${t('modal.attachment')}:</span> ${selectedFile.split('/').pop() || selectedFile.split('\\').pop()}</div>` : ''}
        `;
        showEmailModal('success', t('modal.emailSuccess'), result.message, details);
        emailForm.reset();
        selectedFile = null;
        fileNameDisplay.textContent = '';
        // Reload templates to restore selection
        loadTemplates();
      } else {
        showEmailModal('error', t('modal.emailFailed'), t('modal.emailFailed'), `<div class="detail-row"><span class="detail-label">${t('modal.errorLabel')}:</span> ${result.error || t('modal.unknownError')}</div>`);
      }
    } catch (error) {
      showEmailModal('error', t('modal.error'), t('modal.sendError'), '');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = t('compose.send');
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

// Bulk Email Page
interface BulkEmailEntry {
  id: string;
  filePath: string;
  fileName: string;
  anrede: string;
  name: string;
  email: string;
  templateId: number | null;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  errorMessage?: string;
}

function initBulkPage() {
  const dropZone = document.getElementById('bulk-drop-zone') as HTMLDivElement;
  const browseBtnSpan = document.getElementById('bulk-browse-btn') as HTMLSpanElement;
  const fileInput = document.getElementById('bulk-file-input') as HTMLInputElement;
  const tableBody = document.getElementById('bulk-table-body') as HTMLTableSectionElement;
  const sendAllBtn = document.getElementById('bulk-send-btn') as HTMLButtonElement;
  const clearAllBtn = document.getElementById('bulk-clear-btn') as HTMLButtonElement;
  const statusMessage = document.getElementById('bulk-status-message') as HTMLDivElement;

  let entries: BulkEmailEntry[] = [];
  let templates: Template[] = [];
  let defaultTemplateId: number | null = null;

  // Load templates on init
  loadTemplates();

  // Listen for template updates
  window.electronAPI.onTemplatesUpdated(() => {
    loadTemplates();
  });

  async function loadTemplates() {
    try {
      const result = await window.electronAPI.getTemplates();
      if (result.success && result.templates) {
        templates = result.templates;
        
        // Find default template
        const defaultTemplate = templates.find(t => t.is_default);
        if (defaultTemplate) {
          defaultTemplateId = defaultTemplate.id;
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
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
    await handleMultiplePDFSelection();
  });

  browseBtnSpan?.addEventListener('click', async () => {
    await handleMultiplePDFSelection();
  });

  dropZone?.addEventListener('click', async (e) => {
    if (e.target !== browseBtnSpan) {
      await handleMultiplePDFSelection();
    }
  });

  async function handleMultiplePDFSelection() {
    const result = await window.electronAPI.selectMultiplePDFs();
    if (result.success && result.filePaths) {
      for (const filePath of result.filePaths) {
        await addPDFEntry(filePath);
      }
    }
  }

  async function addPDFEntry(filePath: string) {
    // Check if already exists
    if (entries.some(e => e.filePath === filePath)) {
      return;
    }

    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
    
    const entry: BulkEmailEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      filePath,
      fileName,
      anrede: '',
      name: '',
      email: '',
      templateId: defaultTemplateId,
      status: 'pending'
    };

    // Try to extract data from PDF
    const extractResult = await window.electronAPI.extractPDFData(filePath);
    if (extractResult.success && extractResult.data) {
      entry.anrede = extractResult.data.anrede || '';
      entry.name = extractResult.data.name || '';
      
      // Look up saved email for this name
      if (entry.name) {
        const emailResult = await window.electronAPI.getUserEmailByName(entry.name);
        if (emailResult.success && emailResult.userEmail && emailResult.userEmail.email) {
          entry.email = emailResult.userEmail.email;
        }
      }
    }

    entries.push(entry);
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';
    
    entries.forEach(entry => {
      const tr = document.createElement('tr');
      tr.dataset.id = entry.id;
      
      // Build template options
      let templateOptions = `<option value="">${t('bulk.selectTemplate')}</option>`;
      templates.forEach(template => {
        const isSelected = entry.templateId === template.id;
        templateOptions += `<option value="${template.id}" ${isSelected ? 'selected' : ''}>${template.name}${template.is_default ? ' ★' : ''}</option>`;
      });
      
      // Extract just the filename from the path
      const displayFileName = entry.fileName.split('/').pop()?.split('\\').pop() || entry.fileName;
      
      tr.innerHTML = `
        <td><span class="pdf-name" title="${entry.filePath}">📄 ${displayFileName}</span></td>
        <td>
          <select class="anrede-select" ${entry.status !== 'pending' ? 'disabled' : ''}>
            <option value="">--</option>
            <option value="Herr" ${entry.anrede === 'Herr' ? 'selected' : ''}>${t('compose.herr')}</option>
            <option value="Frau" ${entry.anrede === 'Frau' ? 'selected' : ''}>${t('compose.frau')}</option>
          </select>
        </td>
        <td>
          <input type="text" class="name-input" value="${entry.name}" placeholder="${t('bulk.name')}" ${entry.status !== 'pending' ? 'disabled' : ''}>
        </td>
        <td>
          <input type="email" class="email-input" value="${entry.email}" placeholder="${t('bulk.email')}" ${entry.status !== 'pending' ? 'disabled' : ''}>
        </td>
        <td>
          <select class="template-select" ${entry.status !== 'pending' ? 'disabled' : ''}>
            ${templateOptions}
          </select>
        </td>
        <td class="status-cell">
          <span class="bulk-status ${entry.status}">${getStatusText(entry.status)}</span>
          ${entry.errorMessage ? `<span title="${entry.errorMessage}">⚠️</span>` : ''}
        </td>
        <td>
          <button class="btn-remove" title="${t('bulk.remove')}" ${entry.status === 'sending' ? 'disabled' : ''}>🗑️</button>
        </td>
      `;

      // Add event listeners
      const anredeSelect = tr.querySelector('.anrede-select') as HTMLSelectElement;
      const nameInput = tr.querySelector('.name-input') as HTMLInputElement;
      const emailInput = tr.querySelector('.email-input') as HTMLInputElement;
      const entryTemplateSelect = tr.querySelector('.template-select') as HTMLSelectElement;
      const removeBtn = tr.querySelector('.btn-remove') as HTMLButtonElement;

      anredeSelect?.addEventListener('change', () => {
        entry.anrede = anredeSelect.value;
      });

      nameInput?.addEventListener('input', () => {
        entry.name = nameInput.value;
      });

      emailInput?.addEventListener('input', () => {
        entry.email = emailInput.value;
      });

      entryTemplateSelect?.addEventListener('change', () => {
        entry.templateId = parseInt(entryTemplateSelect.value) || null;
      });

      removeBtn?.addEventListener('click', () => {
        entries = entries.filter(e => e.id !== entry.id);
        renderTable();
      });

      tableBody.appendChild(tr);
    });
  }

  function getStatusText(status: string): string {
    switch (status) {
      case 'pending': return t('bulk.pending');
      case 'sending': return t('bulk.sending');
      case 'sent': return t('bulk.sent');
      case 'failed': return t('bulk.failed');
      default: return status;
    }
  }

  function getTemplateMessage(anrede: string, name: string, templateId: number | null): { message: string; subject: string } {
    if (!templateId) return { message: '', subject: '' };
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return { message: '', subject: '' };

    let message = template.body;
    const suffix = anrede === 'Herr' ? 'r' : '';
    
    message = message.replace(/\{\{ANREDE_SUFFIX\}\}/g, suffix);
    message = message.replace(/\{\{ANREDE\}\}/g, anrede || '');
    message = message.replace(/\{\{NAME\}\}/g, name || '');
    
    return { message, subject: template.subject || '' };
  }

  clearAllBtn?.addEventListener('click', () => {
    if (entries.length === 0) return;
    if (!confirm(t('bulk.confirmClear'))) return;
    
    entries = [];
    renderTable();
  });

  sendAllBtn?.addEventListener('click', async () => {
    // Validate entries
    const pendingEntries = entries.filter(e => e.status === 'pending');
    
    if (pendingEntries.length === 0) {
      showBulkStatus(t('bulk.noEntries'), 'error');
      return;
    }

    // Check for missing emails
    const missingEmail = pendingEntries.find(e => !e.email);
    if (missingEmail) {
      showBulkStatus(`${t('bulk.missingEmail')}: ${missingEmail.fileName}`, 'error');
      return;
    }

    // Check for missing templates
    const missingTemplate = pendingEntries.find(e => !e.templateId);
    if (missingTemplate) {
      showBulkStatus(`${t('bulk.selectTemplate')}: ${missingTemplate.fileName}`, 'error');
      return;
    }

    sendAllBtn.disabled = true;
    sendAllBtn.textContent = t('bulk.sendingAll');

    let sentCount = 0;
    let failedCount = 0;

    for (const entry of pendingEntries) {
      entry.status = 'sending';
      renderTable();

      try {
        const { message, subject } = getTemplateMessage(entry.anrede, entry.name, entry.templateId);
        const result = await window.electronAPI.sendEmail({
          name: entry.name,
          email: entry.email,
          recipientEmail: entry.email,
          message: message,
          subject: subject || undefined,
          pdfPath: entry.filePath,
          templateId: entry.templateId,
        });

        if (result.success) {
          entry.status = 'sent';
          sentCount++;
          
          // Save user email for future use
          if (entry.name && entry.email) {
            await window.electronAPI.saveUserEmail(entry.name, entry.email);
          }
        } else {
          entry.status = 'failed';
          entry.errorMessage = result.error;
          failedCount++;
        }
      } catch (error) {
        entry.status = 'failed';
        entry.errorMessage = (error as Error).message;
        failedCount++;
      }

      renderTable();
    }

    sendAllBtn.disabled = false;
    sendAllBtn.textContent = t('bulk.sendAll');

    if (failedCount === 0) {
      showBulkStatus(t('bulk.allSent'), 'success');
    } else {
      showBulkStatus(t('bulk.someFailed', { sent: sentCount, failed: failedCount }), 'error');
    }
  });

  function showBulkStatus(message: string, type: 'success' | 'error') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 5000);
  }
}

// Email Modal Functions
function showEmailModal(type: 'success' | 'error', title: string, message: string, details: string) {
  const modal = document.getElementById('email-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalIcon = document.getElementById('modal-icon');
  const modalMessage = document.getElementById('modal-message');
  const modalDetails = document.getElementById('modal-details');
  const modalCloseBtn = document.getElementById('modal-close');
  const modalOkBtn = document.getElementById('modal-ok-btn');

  if (!modal || !modalTitle || !modalIcon || !modalMessage || !modalDetails) return;

  modalTitle.textContent = type === 'success' ? t('modal.success') : t('modal.error');
  modalIcon.textContent = type === 'success' ? '✉️' : '⚠️';
  modalIcon.className = `modal-icon ${type}`;
  modalMessage.textContent = title;
  modalDetails.innerHTML = details;

  modal.classList.add('show');

  const closeModal = () => {
    modal.classList.remove('show');
  };

  modalCloseBtn?.addEventListener('click', closeModal, { once: true });
  modalOkBtn?.addEventListener('click', closeModal, { once: true });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  }, { once: true });

  // Close on Escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Email History state
let emailHistoryData: any[] = [];

function loadEmailHistory() {
  const historyList = document.getElementById('history-list');
  const historyStats = document.getElementById('history-stats');
  
  if (!historyList) return;

  window.electronAPI.getEmailHistory(100, 0).then(result => {
    if (result.success && result.history) {
      emailHistoryData = result.history;
      renderHistoryList(emailHistoryData);
    }
  });

  window.electronAPI.getEmailStats().then(result => {
    if (result.success && result.stats && historyStats) {
      const stats = result.stats;
      historyStats.textContent = t('history.stats', { total: stats.total, sent: stats.sent, failed: stats.failed });
    }
  });
}

function renderHistoryList(history: any[]) {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>${t('history.noEmails')}</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = history.map(email => `
    <div class="history-item" data-id="${email.id}">
      <div class="history-item-info">
        <div class="history-item-recipient">${email.recipient_name} &lt;${email.recipient_email}&gt;</div>
        <div class="history-item-subject">${email.subject || t('history.noSubject')}</div>
        <div class="history-item-date">${formatDate(email.sent_at)}</div>
      </div>
      <span class="history-item-status ${email.status}">${email.status === 'sent' ? t('history.sent') : t('history.failed')}</span>
      <div class="history-item-actions">
        <button class="btn-icon repeat" title="${t('history.repeat')}" data-repeat-id="${email.id}">🔄</button>
        <button class="btn-icon delete" title="${t('history.delete')}" data-delete-id="${email.id}">🗑️</button>
      </div>
    </div>
  `).join('');

  // Add repeat handlers
  historyList.querySelectorAll('[data-repeat-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt((btn as HTMLElement).dataset.repeatId!);
      const email = history.find(e => e.id === id);
      if (email) {
        // Dispatch event to populate compose form with email data
        window.dispatchEvent(new CustomEvent('repeat-email', { detail: email }));
        // Navigate to compose page
        showPage('compose');
      }
    });
  });

  // Add delete handlers
  historyList.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt((btn as HTMLElement).dataset.deleteId!);
      if (confirm(t('history.confirmDelete'))) {
        const result = await window.electronAPI.deleteEmailHistory(id);
        if (result.success) {
          loadEmailHistory();
        }
      }
    });
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function initHistoryPage() {
  const searchInput = document.getElementById('history-search') as HTMLInputElement;
  
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    if (query.length === 0) {
      renderHistoryList(emailHistoryData);
    } else {
      const filtered = emailHistoryData.filter(email => 
        email.recipient_name?.toLowerCase().includes(query) ||
        email.recipient_email?.toLowerCase().includes(query) ||
        email.subject?.toLowerCase().includes(query)
      );
      renderHistoryList(filtered);
    }
  });
}

function initSettingsPage() {
  const settingsForm = document.getElementById('settings-form') as HTMLFormElement;
  const testBtn = document.getElementById('test-btn') as HTMLButtonElement;
  const settingsStatus = document.getElementById('settings-status') as HTMLDivElement;
  const secureCheckbox = document.getElementById('smtp-secure') as HTMLInputElement;
  const portInput = document.getElementById('smtp-port') as HTMLInputElement;
  const languageSelect = document.getElementById('language-select') as HTMLSelectElement;

  // Initialize language selector
  languageSelect.value = getCurrentLanguage();
  languageSelect.addEventListener('change', () => {
    changeLanguage(languageSelect.value);
  });

  // Auto-update port when TLS checkbox changes
  secureCheckbox?.addEventListener('change', () => {
    if (secureCheckbox.checked) {
      portInput.value = '465';
    } else {
      portInput.value = '587';
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
    testBtn.textContent = t('settings.testing');

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
      testBtn.textContent = t('settings.test');
    }
  });

  // Save settings
  settingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const settings = getFormSettings();

    try {
      const result = await window.electronAPI.saveSMTPSettings(settings);
      
      if (result.success) {
        showSettingsStatus(t('settings.saved'), 'success');
      } else {
        showSettingsStatus(result.error || t('settings.saveFailed'), 'error');
      }
    } catch (error) {
      showSettingsStatus(t('settings.saveFailed'), 'error');
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

function initTemplatesPage() {
  const templateList = document.getElementById('template-list') as HTMLUListElement;
  const templateForm = document.getElementById('template-form') as HTMLFormElement;
  const templateIdInput = document.getElementById('template-id') as HTMLInputElement;
  const templateNameInput = document.getElementById('template-name') as HTMLInputElement;
  const templateSubjectInput = document.getElementById('template-subject') as HTMLInputElement;
  const templateBodyTextarea = document.getElementById('template-body') as HTMLTextAreaElement;
  const templateDefaultCheckbox = document.getElementById('template-default') as HTMLInputElement;
  const deleteBtn = document.getElementById('delete-template-btn') as HTMLButtonElement;
  const newTemplateBtn = document.getElementById('new-template-btn') as HTMLButtonElement;
  const templateStatus = document.getElementById('template-status') as HTMLDivElement;

  let templates: Template[] = [];
  let selectedTemplateId: number | null = null;

  // Load templates
  loadTemplates();

  // New template button
  newTemplateBtn?.addEventListener('click', () => {
    clearForm();
    selectedTemplateId = null;
    deleteBtn.style.display = 'none';
    templateNameInput.focus();
  });

  // Delete button
  deleteBtn?.addEventListener('click', async () => {
    if (!selectedTemplateId) return;
    
    if (!confirm(t('templates.confirmDelete'))) return;

    try {
      const result = await window.electronAPI.deleteTemplate(selectedTemplateId);
      if (result.success) {
        showTemplateStatus(t('templates.deleted'), 'success');
        clearForm();
        selectedTemplateId = null;
        deleteBtn.style.display = 'none';
        loadTemplates();
      } else {
        showTemplateStatus(result.error || t('templates.deleteFailed'), 'error');
      }
    } catch (error) {
      showTemplateStatus(t('templates.deleteFailed'), 'error');
    }
  });

  // Form submission
  templateForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const templateData = {
      name: templateNameInput.value,
      subject: templateSubjectInput.value,
      body: templateBodyTextarea.value,
      is_default: templateDefaultCheckbox.checked ? 1 : 0,
    };

    try {
      let result;
      if (selectedTemplateId) {
        result = await window.electronAPI.updateTemplate(selectedTemplateId, templateData);
      } else {
        result = await window.electronAPI.createTemplate(templateData);
      }

      if (result.success) {
        showTemplateStatus(t('templates.saved'), 'success');
        if (result.template) {
          selectedTemplateId = result.template.id;
          deleteBtn.style.display = 'inline-block';
        }
        loadTemplates();
      } else {
        showTemplateStatus(result.error || t('templates.saveFailed'), 'error');
      }
    } catch (error) {
      showTemplateStatus(t('templates.saveFailed'), 'error');
    }
  });

  async function loadTemplates() {
    try {
      const result = await window.electronAPI.getTemplates();
      if (result.success && result.templates) {
        templates = result.templates;
        renderTemplateList();
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  function renderTemplateList() {
    templateList.innerHTML = '';
    
    templates.forEach(template => {
      const li = document.createElement('li');
      li.className = 'template-list-item' + (template.id === selectedTemplateId ? ' active' : '');
      li.innerHTML = `
        <span class="template-name">${template.name}</span>
        ${template.is_default ? '<span class="default-badge">★</span>' : ''}
      `;
      li.addEventListener('click', () => {
        selectTemplate(template);
      });
      templateList.appendChild(li);
    });
  }

  function selectTemplate(template: Template) {
    selectedTemplateId = template.id;
    templateIdInput.value = String(template.id);
    templateNameInput.value = template.name;
    templateSubjectInput.value = template.subject || '';
    templateBodyTextarea.value = template.body;
    templateDefaultCheckbox.checked = template.is_default === 1;
    deleteBtn.style.display = 'inline-block';
    
    // Update active state in list
    document.querySelectorAll('.template-list-item').forEach(item => {
      item.classList.remove('active');
    });
    const items = templateList.querySelectorAll('.template-list-item');
    items.forEach((item, index) => {
      if (templates[index].id === template.id) {
        item.classList.add('active');
      }
    });
  }

  function clearForm() {
    templateIdInput.value = '';
    templateNameInput.value = '';
    templateSubjectInput.value = '';
    templateBodyTextarea.value = '';
    templateDefaultCheckbox.checked = false;
    
    document.querySelectorAll('.template-list-item').forEach(item => {
      item.classList.remove('active');
    });
  }

  function showTemplateStatus(message: string, type: 'success' | 'error') {
    templateStatus.textContent = message;
    templateStatus.className = `status-message ${type}`;
    
    setTimeout(() => {
      templateStatus.className = 'status-message';
    }, 3000);
  }
}

function initAboutPage() {
  // Load and display the app version
  const versionElement = document.getElementById('app-version');
  const checkUpdateBtn = document.getElementById('check-update-btn') as HTMLButtonElement;
  const installUpdateBtn = document.getElementById('install-update-btn') as HTMLButtonElement;
  const updateStatus = document.getElementById('update-status') as HTMLDivElement;
  const updateProgress = document.getElementById('update-progress') as HTMLDivElement;
  const updateProgressBar = document.getElementById('update-progress-bar') as HTMLDivElement;
  const updateProgressText = document.getElementById('update-progress-text') as HTMLSpanElement;

  let updateDownloaded = false;
  
  if (versionElement) {
    window.electronAPI.getAppVersion().then(version => {
      versionElement.textContent = version;
    }).catch(() => {
      versionElement.textContent = '1.0.0';
    });
  }

  // Check for updates button
  checkUpdateBtn?.addEventListener('click', async () => {
    checkUpdateBtn.disabled = true;
    checkUpdateBtn.textContent = t('about.checking') || 'Suche nach Updates...';
    updateStatus.textContent = '';
    updateStatus.className = 'update-status';
    
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (!result.success) {
        showUpdateStatus(result.error || t('about.checkFailed'), 'error');
      }
      // Status will be updated via events
    } catch (error) {
      showUpdateStatus(t('about.checkFailed') || 'Fehler bei der Update-Suche', 'error');
    } finally {
      checkUpdateBtn.disabled = false;
      checkUpdateBtn.textContent = t('about.checkUpdate') || 'Nach Updates suchen';
    }
  });

  // Install update button
  installUpdateBtn?.addEventListener('click', () => {
    window.electronAPI.quitAndInstall();
  });

  // Update event listeners
  window.electronAPI.onUpdateChecking(() => {
    showUpdateStatus(t('about.checking') || 'Suche nach Updates...', 'info');
  });

  window.electronAPI.onUpdateAvailable((info: any) => {
    showUpdateStatus(t('about.updateAvailable', { version: info.version }) || `Update verfügbar: ${info.version}`, 'info');
    updateProgress.style.display = 'flex';
  });

  window.electronAPI.onUpdateNotAvailable(() => {
    showUpdateStatus(t('about.upToDate') || 'Sie verwenden die neueste Version', 'success');
  });

  window.electronAPI.onUpdateError((error: string) => {
    showUpdateStatus(`${t('about.updateError') || 'Update-Fehler'}: ${error}`, 'error');
    updateProgress.style.display = 'none';
  });

  window.electronAPI.onUpdateDownloadProgress((progress: any) => {
    const percent = Math.round(progress.percent || 0);
    updateProgressBar.style.width = `${percent}%`;
    updateProgressText.textContent = `${percent}%`;
    showUpdateStatus(t('about.downloading') || 'Update wird heruntergeladen...', 'info');
  });

  window.electronAPI.onUpdateDownloaded((info: any) => {
    updateDownloaded = true;
    updateProgress.style.display = 'none';
    showUpdateStatus(t('about.updateReady', { version: info.version }) || `Update ${info.version} bereit zur Installation`, 'success');
    installUpdateBtn.style.display = 'inline-block';
    checkUpdateBtn.style.display = 'none';
  });

  function showUpdateStatus(message: string, type: 'success' | 'error' | 'info') {
    updateStatus.textContent = message;
    updateStatus.className = `update-status ${type}`;
  }
}
