import { Router } from 'express';
import {
  getRules,
  toggleRule,
  userInfo,
  createRule,
  updateRule,
  deleteRule
} from '../controllers/RulesController.js';

const router = Router();

router.get('/',            getRules);    // READ
router.get('/user-info',   userInfo);    // User info
router.post('/toggle',     toggleRule);  // Toggle active/inactive
router.post('/create',     createRule);  // CREATE
router.post('/update',     updateRule);  // UPDATE (full edit)
router.post('/delete',     deleteRule);  // DELETE

export default router;