const nodemailer = require('nodemailer');

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

/**
 * Send an email.
 * @param {{ email: string, subject: string, text?: string, html?: string }} opts
 */
const sendEmail = async ({ email, subject, text, html }) => {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        console.warn('⚠️  SMTP credentials not configured. Email not sent.');
        console.warn('   Set SMTP_USER and SMTP_PASS in backend/.env');
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
