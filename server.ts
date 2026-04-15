import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/verify-teacher', async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Simulate sending email (or use nodemailer if credentials exist)
    console.log(`[SERVER] Verification code for ${email}: ${code}`);
    
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: '"English Evolution" <noreply@englishevolution.com>',
          to: 'Ibrahemmatooq@gmail.com',
          subject: 'Teacher Verification Request',
          text: `Teacher ${email} is requesting access. Verification code: ${code}`,
        });
      }
      
      res.json({ success: true, code }); // In a real app, don't return the code to the client
    } catch (error) {
      console.error('Email error:', error);
      res.status(500).json({ success: false, error: 'Failed to send verification email' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
