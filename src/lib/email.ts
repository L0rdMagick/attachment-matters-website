export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  headline: string;
  bodyHtml: string;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Dispatch a notification email via the serverless API route
 */
export async function sendPortalEmail(payload: SendEmailPayload): Promise<boolean> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Failed to send portal email:", errText);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Error triggering portal email dispatch:", err);
    return false;
  }
}
