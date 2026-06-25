import { buildLoginUrl, exchangeCodeForToken } from '../services/SalesforceService.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export function login(req, res) {
  res.redirect(buildLoginUrl());
}

export async function callback(req, res) {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const tokenData = await exchangeCodeForToken(code);

    const redirectUrl = new URL('/', FRONTEND_URL);
    redirectUrl.searchParams.set('access_token', tokenData.access_token);
    redirectUrl.searchParams.set('instance_url', tokenData.instance_url);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Salesforce OAuth failed');
  }
}