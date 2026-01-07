import { registerSmtpHandlers } from './smtp-handlers';
import { registerEmailHandlers } from './email-handlers';
import { registerTemplateHandlers } from './template-handlers';
import { registerUserEmailHandlers } from './user-email-handlers';
import { registerUpdateHandlers } from './update-handlers';

export function registerAllIpcHandlers(): void {
  registerSmtpHandlers();
  registerEmailHandlers();
  registerTemplateHandlers();
  registerUserEmailHandlers();
  registerUpdateHandlers();
}
