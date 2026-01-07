import ElectronStore from 'electron-store';
import keytar from 'keytar';

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
};

type StoreSchema = {
  smtpSettings: Omit<SmtpSettings, 'password'>;
};

const store = new ElectronStore<StoreSchema>();

const SMTP_STORE_KEY = 'smtpSettings' as const;
const KEYTAR_SERVICE = 'dentklarEmailer.smtp';

const normalizeAccount = (user: unknown): string => String(user ?? '').trim().toLowerCase();

export async function setSmtpPassword(user: string, password: string): Promise<void> {
  const account = normalizeAccount(user);
  if (!account) throw new Error('SMTP user is required to store password');
  await keytar.setPassword(KEYTAR_SERVICE, account, password);
}

export async function getSmtpPassword(user: string): Promise<string | null> {
  const account = normalizeAccount(user);
  if (!account) return null;
  return keytar.getPassword(KEYTAR_SERVICE, account);
}

export async function deleteSmtpPassword(user: string): Promise<boolean> {
  const account = normalizeAccount(user);
  if (!account) return false;
  return keytar.deletePassword(KEYTAR_SERVICE, account);
}

export function getStoredSmtpSettings(): Omit<SmtpSettings, 'password'> {
  const settings = store.get(SMTP_STORE_KEY, {
    host: '',
    port: 587,
    secure: false,
    user: '',
  }) as any;

  return {
    host: String(settings.host ?? ''),
    port: Number(settings.port ?? 587),
    secure: Boolean(settings.secure ?? false),
    user: String(settings.user ?? ''),
  };
}

export async function saveSmtpSettings(settings: SmtpSettings): Promise<void> {
  const nextSettings: Omit<SmtpSettings, 'password'> = {
    host: String(settings?.host ?? ''),
    port: Number(settings?.port ?? 587),
    secure: Boolean(settings?.secure ?? false),
    user: String(settings?.user ?? ''),
  };

  // If user changed, remove old stored password to avoid orphaned secrets.
  const previous = getStoredSmtpSettings();
  if (previous.user && normalizeAccount(previous.user) !== normalizeAccount(nextSettings.user)) {
    await deleteSmtpPassword(previous.user);
  }

  store.set(SMTP_STORE_KEY, nextSettings);

  const password = String(settings?.password ?? '');
  if (password) {
    await setSmtpPassword(nextSettings.user, password);
  }
}
