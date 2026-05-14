import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { z } from 'zod';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, first_name, last_name, role, departments, custom_permissions, is_active')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', email, userError);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.is_active) {
      console.error('❌ User inactive:', email);
      return res.status(401).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    const passwordValid = await bcryptjs.compare(password, user.password_hash);
    if (!passwordValid) {
      console.error('❌ Password mismatch for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // ★ Include departments in JWT payload
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        departments: user.departments || [],  // ★ NEW
      },
      process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production',
      { expiresIn: '7d' }
    );

    console.log(`✅ Login successful for: ${email} (role: ${user.role})`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        departments: user.departments,
        custom_permissions: user.custom_permissions || null,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof z.ZodError ? error.errors[0].message : 'Login failed',
    });
  }
});

// POST /api/v1/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, role, departments } = req.body;

    const passwordHash = await bcryptjs.hash(password, 12);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        first_name: first_name || '',
        last_name: last_name || '',
        role: role || 'EMPLOYEE',
        departments: departments || ['GARTEN_TIEFBAU'],
        is_active: true,
      })
      .select('id, email, first_name, last_name, role, departments, custom_permissions')
      .single();

    if (insertError) {
      return res.status(400).json({
        success: false,
        message: insertError.message,
      });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: newUser,
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(400).json({
      success: false,
      message: 'Registration failed',
    });
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production'
    ) as { userId: string; email: string; role: string };

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, departments, custom_permissions, is_active')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('❌ Auth verify error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
});
