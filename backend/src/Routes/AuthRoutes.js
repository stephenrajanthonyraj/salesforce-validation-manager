//AuthRoutes.js
import { Router } from 'express';
import { login, callback } from '../controllers/AuthController.js';

const router = Router();

router.get('/salesforce', login);
router.get('/salesforce/callback', callback);

export default router;