const nodemailer = require('nodemailer');
const https = require('https');

/**
 * Auto-detects SMTP provider from the key/password format.
 * - Brevo (Sendinblue) keys start with "xsmtpsib-" → use smtp-relay.brevo.com:587
 * - Otherwise uses SMTP_HOST/SMTP_PORT from .env (e.g. Gmail App Password)
 *
 * IMPORTANT FOR BREVO: Your SMTP_USER must be a verified sender email in your Brevo account.
 * Get your SMTP key from: https://app.brevo.com/settings/keys/smtp
 */
const getTransporter = () => {
    const pass = process.env.SMTP_PASS || '';
    const user = process.env.SMTP_USER || '';
    const isBrevo = pass.startsWith('xsmtpsib-');

    const host = isBrevo ? 'smtp-relay.brevo.com' : (process.env.SMTP_HOST || 'smtp.gmail.com');
    const port = isBrevo ? 587 : parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = isBrevo ? false : process.env.SMTP_SECURE === 'true';

    if (isBrevo) {
        console.log(`📧 Using Brevo SMTP relay (user: ${user})`);
    }

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: false,
        },
    });
};

const brevoSend = ({ toEmail, subject, html, text }) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return Promise.resolve(null);

    const fromName = process.env.FROM_NAME || 'WebDevPro';
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@makeasite.online';

    const payload = JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject,
        htmlContent: html || (text ? `<pre style="font-family:sans-serif">${text}</pre>` : ''),
        textContent: text || '',
    });

    const options = {
        method: 'POST',
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        headers: {
            accept: 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
        },
        timeout: 15000,
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ provider: 'brevo-api', statusCode: res.statusCode, body });
                } else {
                    reject(new Error(`Brevo API send failed (${res.statusCode}): ${body || 'No response body'}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Brevo API request timed out')));
        req.write(payload);
        req.end();
    });
};

/**
 * Send an email.
 * @param {{ email: string, subject: string, text?: string, html?: string }} opts
 */
const sendEmail = async ({ email, subject, text, html }) => {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // Preferred in production: Brevo Transactional Email API (HTTPS; avoids SMTP port blocks)
    if (process.env.BREVO_API_KEY) {
        try {
            const info = await brevoSend({ toEmail: email, subject, html, text });
            console.log(`✅ Email sent via Brevo API to ${email}`);
            return info;
        } catch (error) {
            console.error(`❌ Brevo API email send failed to ${email}: ${error.message}`);
            // fall through to SMTP if configured
        }
    }

    if (!user || !pass) {
        console.warn('⚠️  SMTP credentials not configured. Email not sent.');
        console.warn('   Set SMTP_USER and SMTP_PASS in backend/.env');
        if (!process.env.BREVO_API_KEY) {
            console.warn('   Or set BREVO_API_KEY to use Brevo Transactional Email API over HTTPS.');
        }
        return;
    }

    try {
        const transporter = getTransporter();
        const fromName = process.env.FROM_NAME || 'WebDevPro';
        const fromEmail = process.env.FROM_EMAIL || user;

        // Verify connection first
        await transporter.verify().catch(err => {
            console.warn(`⚠️  SMTP connection verify failed: ${err.message}`);
            // Don't throw — still try to send
        });

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: email,
            subject,
            text: text || '',
            html: html || (text ? `<pre style="font-family:sans-serif">${text}</pre>` : ''),
        });

        console.log(`✅ Email sent to ${email} [msgId: ${info.messageId}]`);
        return info;
    } catch (error) {
        console.error(`❌ Email send failed to ${email}: ${error.message}`);
        // If authentication error, give helpful hints
        if (error.message.includes('535') || error.message.includes('auth') || error.message.includes('Authentication')) {
            const isBrevo = (pass || '').startsWith('xsmtpsib-');
            if (isBrevo) {
                console.error('   Brevo SMTP hint: Make sure your SMTP_USER is your Brevo account email (the one registered on app.brevo.com)');
                console.error('   Get SMTP credentials: https://app.brevo.com/settings/keys/smtp');
            } else {
                console.error('   Gmail hint: Use an App Password (not your Gmail password): https://myaccount.google.com/apppasswords');
                console.error('   Enable 2FA on your Google account first, then generate an App Password.');
            }
        }
        // Don't throw — email failures should not crash the auth flow
    }
};

module.exports = sendEmail;
