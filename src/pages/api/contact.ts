import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// Tell Astro not to pre-render this route as static, since it handles live POST requests
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const name = data.get('name')?.toString().trim();
    const email = data.get('email')?.toString().trim();
    const phone = data.get('phone')?.toString().trim();
    const contactMethod = data.get('contactMethod')?.toString();
    const seekingFor = data.get('seekingFor')?.toString();
    const message = data.get('message')?.toString().trim();
    const referral = data.get('referral')?.toString().trim();

    // Basic server-side validation
    if (!name || !email || !phone || !contactMethod || !seekingFor) {
      return new Response(
        JSON.stringify({ error: 'Please fill in all required fields.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve API key from environment variables
    const apiKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY environment variable is not defined.');
      return new Response(
        JSON.stringify({ error: 'Server configuration error. Please try again later.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(apiKey);

    // Build the email body HTML
    const emailHtml = `
      <div style="font-family: sans-serif; color: #2C2A2A; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #EAE1D2; border-radius: 12px; background-color: #F7F2E9;">
        <h2 style="font-family: serif; color: #BF5B33; border-bottom: 2px solid #EAE1D2; padding-bottom: 10px; margin-top: 0;">New Contact Form Inquiry</h2>
        <p style="font-size: 16px; line-height: 1.6;">A visitor has submitted a message on the <strong>Family Trust Therapy</strong> website.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 15px;">
          <tr style="background-color: #EAE1D2;">
            <th style="padding: 12px; border: 1px solid #D9CEBA; text-align: left; width: 180px; font-weight: bold;">Field</th>
            <th style="padding: 12px; border: 1px solid #D9CEBA; text-align: left; font-weight: normal;">Value</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #EAE1D2; font-weight: bold; background-color: #ffffff;">Name</td>
            <td style="padding: 10px; border: 1px solid #EAE1D2; background-color: #ffffff;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #EAE1D2; font-weight: bold; background-color: #ffffff;">Email</td>
            <td style="padding: 10px; border: 1px solid #EAE1D2; background-color: #ffffff;"><a href="mailto:${email}" style="color: #BF5B33; text-decoration: none;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #EAE1D2; font-weight: bold; background-color: #ffffff;">Phone</td>
            <td style="padding: 10px; border: 1px solid #EAE1D2; background-color: #ffffff;"><a href="tel:${phone}" style="color: #BF5B33; text-decoration: none;">${phone}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #EAE1D2; font-weight: bold; background-color: #ffffff;">Preferred Contact</td>
            <td style="padding: 10px; border: 1px solid #EAE1D2; background-color: #ffffff; text-transform: capitalize;">${contactMethod}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #EAE1D2; font-weight: bold; background-color: #ffffff;">Seeking Services For</td>
            <td style="padding: 10px; border: 1px solid #EAE1D2; background-color: #ffffff;">${seekingFor}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #EAE1D2; font-weight: bold; background-color: #ffffff;">Referral Source</td>
            <td style="padding: 10px; border: 1px solid #EAE1D2; background-color: #ffffff;">${referral || 'Not specified'}</td>
          </tr>
        </table>

        <h3 style="margin-top: 25px; font-family: serif; color: #4A5741; border-bottom: 1px solid #EAE1D2; padding-bottom: 5px;">Inquiry / Message Details:</h3>
        <p style="white-space: pre-wrap; font-size: 15px; line-height: 1.6; background-color: #ffffff; padding: 15px; border: 1px solid #EAE1D2; border-radius: 8px; margin: 10px 0 0 0;">
          ${message || 'No additional message was provided.'}
        </p>

        <div style="margin-top: 35px; font-size: 11px; color: #8C8273; border-top: 1px solid #EAE1D2; padding-top: 10px; text-align: center;">
          This email was securely sent from the contact page at <a href="https://familytrusttherapy.com" style="color: #8C8273;">familytrusttherapy.com</a>.
        </div>
      </div>
    `;

    // Send the email using Resend
    const { error: resError } = await resend.emails.send({
      from: 'Family Trust Therapy <website@familytrusttherapy.com>',
      to: 'info@familytrusttherapy.com',
      replyTo: `${name} <${email}>`,
      subject: `New Client Inquiry: ${name}`,
      html: emailHtml,
    });

    if (resError) {
      console.error('Resend API Error:', resError);
      return new Response(
        JSON.stringify({ error: 'Failed to send message via email provider.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: 'Message sent successfully!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Submit Contact Form Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error occurred.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
