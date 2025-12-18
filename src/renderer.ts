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
      saveSMTPSettings: (settings: any) => Promise<any>;
      getSMTPSettings: () => Promise<any>;
      testSMTPConnection: (settings: any) => Promise<any>;
      sendEmail: (emailData: any) => Promise<any>;
      selectPDF: () => Promise<any>;
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
      // Events
      onTemplatesUpdated: (callback: () => void) => () => void;
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
initHistoryPage();
initSettingsPage();
initTemplatesPage();

// Show initial page
if (page === 'settings') {
  showPage('settings');
} else if (page === 'templates') {
  showPage('templates');
} else if (page === 'history') {
  showPage('history');
} else {
  showPage('compose');
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
    selectedPage.style.display = 'block';
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
  const anredeSelect = document.getElementById('anrede') as HTMLSelectElement;
  const messageTextarea = document.getElementById('message') as HTMLTextAreaElement;
  const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
  const subjectInput = document.getElementById('subject') as HTMLInputElement;

  let selectedFile: string | null = null;
  let selectedTemplateId: number | null = null;
  let templates: Template[] = [];

  // Load templates on page load
  loadTemplates();

  // Listen for template updates from main process
  window.electronAPI.onTemplatesUpdated(() => {
    loadTemplates();
  });

  // Listen for page navigation refresh
  window.addEventListener('refresh-compose-templates', () => {
    loadTemplates();
  });

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
    templateSelect.innerHTML = '<option value="">-- Vorlage wählen --</option>';
    
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
  });

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
      showEmailModal('error', 'Fehlende Felder', 'Bitte füllen Sie alle erforderlichen Felder aus.', '');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Senden...';

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
        const details = `
          <div class="detail-row"><span class="detail-label">Empfänger:</span> ${name} &lt;${email}&gt;</div>
          <div class="detail-row"><span class="detail-label">Betreff:</span> ${subject || 'Kein Betreff'}</div>
          ${selectedFile ? `<div class="detail-row"><span class="detail-label">Anhang:</span> ${selectedFile.split('/').pop() || selectedFile.split('\\').pop()}</div>` : ''}
        `;
        showEmailModal('success', 'Email erfolgreich gesendet!', result.message, details);
        emailForm.reset();
        selectedFile = null;
        fileNameDisplay.textContent = '';
        // Reload templates to restore selection
        loadTemplates();
      } else {
        showEmailModal('error', 'Senden fehlgeschlagen', 'Die Email konnte nicht gesendet werden.', `<div class="detail-row"><span class="detail-label">Fehler:</span> ${result.error || 'Unbekannter Fehler'}</div>`);
      }
    } catch (error) {
      showEmailModal('error', 'Fehler', 'Ein Fehler ist beim Senden aufgetreten.', '');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Email senden';
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

  modalTitle.textContent = type === 'success' ? '✅ Erfolg' : '❌ Fehler';
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
      historyStats.textContent = `Total: ${stats.total} | Sent: ${stats.sent} | Failed: ${stats.failed}`;
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
        <p>Keine E-Mails gesendet</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = history.map(email => `
    <div class="history-item" data-id="${email.id}">
      <div class="history-item-info">
        <div class="history-item-recipient">${email.recipient_name} &lt;${email.recipient_email}&gt;</div>
        <div class="history-item-subject">${email.subject || 'Kein Betreff'}</div>
        <div class="history-item-date">${formatDate(email.sent_at)}</div>
      </div>
      <span class="history-item-status ${email.status}">${email.status === 'sent' ? 'Gesendet' : 'Fehlgeschlagen'}</span>
      <div class="history-item-actions">
        <button class="btn-icon delete" title="Löschen" data-delete-id="${email.id}">🗑️</button>
      </div>
    </div>
  `).join('');

  // Add delete handlers
  historyList.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt((btn as HTMLElement).dataset.deleteId!);
      if (confirm('E-Mail-Eintrag wirklich löschen?')) {
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
    
    if (!confirm('Vorlage wirklich löschen?')) return;

    try {
      const result = await window.electronAPI.deleteTemplate(selectedTemplateId);
      if (result.success) {
        showTemplateStatus('Vorlage gelöscht!', 'success');
        clearForm();
        selectedTemplateId = null;
        deleteBtn.style.display = 'none';
        loadTemplates();
      } else {
        showTemplateStatus(result.error || 'Löschen fehlgeschlagen', 'error');
      }
    } catch (error) {
      showTemplateStatus('Fehler beim Löschen', 'error');
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
        showTemplateStatus('Vorlage gespeichert!', 'success');
        if (result.template) {
          selectedTemplateId = result.template.id;
          deleteBtn.style.display = 'inline-block';
        }
        loadTemplates();
      } else {
        showTemplateStatus(result.error || 'Speichern fehlgeschlagen', 'error');
      }
    } catch (error) {
      showTemplateStatus('Fehler beim Speichern', 'error');
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
