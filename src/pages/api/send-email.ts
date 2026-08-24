import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  try {
    const apiKey = import.meta.env.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env.RESEND_API_KEY : '');
    const body = await request.json();
    const { to, subject, headline, bodyHtml, actionUrl, actionText } = body;

    if (!to || !subject || !headline || !bodyHtml) {
      return new Response(JSON.stringify({ error: 'Missing required email fields (to, subject, headline, bodyHtml)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!apiKey) {
      console.warn("⚠️ [EMAIL DISPATCH SIMULATION] RESEND_API_KEY is not configured in .env. Email details:", {
        to,
        subject,
        headline
      });
      return new Response(JSON.stringify({ success: true, simulated: true, message: 'RESEND_API_KEY missing - simulated successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const resend = new Resend(apiKey);
    const recipients = Array.isArray(to) ? to : [to];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #4f46e5; padding: 20px 24px; text-align: left;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Attachment Matters Portal</h1>
            </div>
            <div style="padding: 24px; color: #374151;">
              <h2 style="color: #111827; margin-top: 0; font-size: 18px;">${headline}</h2>
              <div style="font-size: 15px; line-height: 1.6; color: #4b5563;">
                ${bodyHtml}
              </div>
              ${actionUrl ? `
                <div style="margin-top: 28px; text-align: left;">
                  <a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                    ${actionText || 'View in Client Portal'}
                  </a>
                </div>
              ` : ''}
            </div>
            <div style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 16px 24px; text-align: center;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                Attachment Matters &bull; Confidential Practice Notification
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const sendResult = await resend.emails.send({
      from: 'Attachment Matters <onboarding@resend.dev>',
      to: recipients,
      subject: subject,
      html: htmlContent
    });

    return new Response(JSON.stringify({ success: true, sendResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error("Error in /api/send-email:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
