import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { sendPasswordResetEmail } from '../lib/mailer';
import { z } from 'zod';

export const passwordResetRouter = Router();

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/v1/password-reset/forgot
passwordResetRouter.post('/forgot', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // Don't reveal if email exists (security best practice)
      return res.json({
        success: true,
        message: 'If this email exists, a reset link has been sent.',
      });
    }

    // Generate JWT token valid for 1 hour
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production',
      { expiresIn: '1h' }
    );

    // Build reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email
    await sendPasswordResetEmail(email, resetToken, resetLink);

    res.json({
      success: true,
      message: 'Password reset email sent. Check your inbox.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof z.ZodError ? error.errors[0].message : 'Failed to send reset email',
    });
  }
});

// POST /api/v1/password-reset/reset
passwordResetRouter.post('/reset', async (req, res) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production'
      ) as { userId: string; email: string };
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const passwordHash = await bcryptjs.hash(newPassword, 12);

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date() })
      .eq('id', decoded.userId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof z.ZodError ? error.errors[0].message : 'Failed to reset password',
    });
  }
});

// GET /api/v1/password-reset/verify/:token (verify token validity)
passwordResetRouter.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    jwt.verify(
      token,
      process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production'
    );

    res.json({ valid: true, message: 'Token is valid' });
  } catch {
    res.status(401).json({ valid: false, message: 'Token is invalid or expired' });
  }
});
