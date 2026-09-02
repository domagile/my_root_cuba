import { AccessRequest, AccessControlConfig } from '../types';

export interface EmailDispatchResult {
  success: boolean;
  method: 'webhook' | 'mailto' | 'gmail_web';
  mailtoUrl: string;
  gmailWebUrl: string;
  subject: string;
  body: string;
  adminEmail: string;
  adminEmails: string[];
}

export function formatAccessRequestEmail(
  request: AccessRequest,
  config: AccessControlConfig,
  customAdminEmails?: string[]
): { subject: string; body: string; adminEmail: string; adminEmails: string[] } {
  // Collect all admin emails, removing duplicates and normalizing
  const emailSet = new Set<string>();

  if (customAdminEmails && customAdminEmails.length > 0) {
    customAdminEmails.forEach((em) => em.trim() && emailSet.add(em.trim().toLowerCase()));
  }

  if (config.adminNotificationEmail) {
    config.adminNotificationEmail
      .split(/[,;\s]+/)
      .forEach((em) => em.trim() && emailSet.add(em.trim().toLowerCase()));
  }

  // Ensure default root admins are included
  emailSet.add('fastagile7@gmail.com');
  emailSet.add('cubatarara400@gmail.com');

  const adminEmails = Array.from(emailSet);
  const primaryAdmin = adminEmails[0];
  const otherAdmins = adminEmails.slice(1);
  const adminEmailFormatted = adminEmails.join(', ');

  const roleLabel =
    request.requestedRole === 'admin'
      ? 'Головний Адміністратор'
      : request.requestedRole === 'editor'
      ? 'Редактор'
      : request.requestedRole === 'researcher'
      ? 'Дослідник'
      : 'Переглядач';

  const dateStr = new Date(request.createdAt).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://genealogy.app';

  const subject = `🔔 [Родовід] Новий запит на доступ до архіву від ${request.name}`;

  const body = 
`Доброго дня, шановні Адміністратори родоводу!

Отримано новий запит на включення до Білого списку (Whitelist) вашого сімейного архіву.

Деталі заявника:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Ім'я та прізвище: ${request.name}
📧 Google Email: ${request.email}
🎯 Бажана роль: ${roleLabel}
📅 Дата та час запиту: ${dateStr}
📝 Повідомлення / Родинний зв'язок:
"${request.note || 'Не вказано'}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Сповіщення надіслано всім адміністраторам:
${adminEmails.map((e) => `• ${e}`).join('\n')}

Щоб переглянути заявку та схвалити доступ у 1 клік, відкрийте панель керування родоводом:
${appUrl}/?tab=settings

З повагою,
Система безпеки та контролю доступу Родоводу`;

  return {
    subject,
    body,
    adminEmail: adminEmailFormatted,
    adminEmails
  };
}

export async function sendAdminAccessNotification(
  request: AccessRequest,
  config: AccessControlConfig,
  allAdminEmails?: string[]
): Promise<EmailDispatchResult> {
  const { subject, body, adminEmail, adminEmails } = formatAccessRequestEmail(
    request,
    config,
    allAdminEmails
  );

  const primaryAdmin = adminEmails[0] || 'CubaTarara400@gmail.com';
  const otherAdmins = adminEmails.slice(1);

  // Generate Mailto URL with comma separated recipients or CC for all administrators
  const mailtoRecipients = adminEmails.join(',');
  const mailtoUrl = `mailto:${encodeURIComponent(mailtoRecipients)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  // Generate Gmail Web Compose URL with primary recipient and other admins in CC
  let gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    primaryAdmin
  )}`;
  if (otherAdmins.length > 0) {
    gmailWebUrl += `&cc=${encodeURIComponent(otherAdmins.join(','))}`;
  }
  gmailWebUrl += `&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // If a custom webhook or Formspree endpoint is configured, try sending POST request in background
  if (config.webhookUrl && config.enableEmailNotifications !== false) {
    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: adminEmails,
          recipients: adminEmails,
          subject,
          body,
          applicantName: request.name,
          applicantEmail: request.email,
          requestedRole: request.requestedRole,
          note: request.note,
          createdAt: request.createdAt
        })
      });
      return {
        success: true,
        method: 'webhook',
        mailtoUrl,
        gmailWebUrl,
        subject,
        body,
        adminEmail,
        adminEmails
      };
    } catch {
      // fallback
    }
  }

  return {
    success: true,
    method: 'gmail_web',
    mailtoUrl,
    gmailWebUrl,
    subject,
    body,
    adminEmail,
    adminEmails
  };
}
