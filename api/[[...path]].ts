// This file wraps the Express app for Vercel Serverless Functions.
// The [[...path]] filename catches ALL /api/* requests.

import app from '../backend/src/app';

export default app;
