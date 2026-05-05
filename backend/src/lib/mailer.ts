import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetLink: string
) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@emmenegger.ch',
      to: email,
      subject: '🔑 Emmenegger Scheduler - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset the password for your Emmenegger Scheduler account.</p>
          <p>Click the link below to reset your password (valid for 1 hour):</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link:</p>
          <p style="word-break: break-all; color: #666;">
            <code>${resetLink}</code>
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="font-size: 12px; color: #999;">
            If you did not request a password reset, please ignore this email or contact support.
            <br />
            <strong>This link expires in 1 hour.</strong>
          </p>
        </div>
      `,
      text: `Password Reset Request\n\nClick the link to reset your password:\n${resetLink}\n\nThis link expires in 1 hour.`,
    });

    console.log(`✅ Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    throw error;
  }
}
