// services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // from .env
        pass: process.env.EMAIL_PASS  // from .env
    }
});

// 🔍 Verify SMTP connection when server starts
transporter.verify(function (error, success) {
    if (error) {
        console.log('❌ SMTP CONNECTION ERROR:', error);
    } else {
        console.log('✅ SMTP SERVER IS READY TO SEND EMAILS');
    }
});

async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"KITS Exam Branch" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log('✅ Email sent to:', to, 'Message ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending email to', to, error.message);
        return false;
    }
}

module.exports = { sendEmail };
