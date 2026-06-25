import {
  fetchValidationRules,
  toggleValidationRule,
  createValidationRule,
  updateValidationRule,
  deleteValidationRule,
  getUserInfo
} from '../services/SalesforceService.js';

// GET all rules 
// RulesController.js — fix ALL handlers like this

export async function getRules(req, res) {
  try {
    const { access_token } = req.query;
    const instance_url = decodeURIComponent(req.query.instance_url); 

    if (!access_token || !instance_url)
      return res.status(400).json({ error: 'Missing access_token or instance_url' });

    const rules = await fetchValidationRules(access_token, instance_url);
    return res.json(rules);
  } catch (error) {
    console.error('getRules error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching validation rules',
      details: error.response?.data || error.message
    });
  }
}

// GET user info
export async function userInfo(req, res) {
  try {
    const { access_token } = req.query;
    const instance_url = decodeURIComponent(req.query.instance_url); // ✅

    if (!access_token || !instance_url)
      return res.status(400).json({ error: 'Missing access_token or instance_url' });

    const info = await getUserInfo(access_token, instance_url);
    return res.json(info);
  } catch (error) {
    console.error('userInfo error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching user info',
      details: error.response?.data || error.message
    });
  }
}

// TOGGLE active/inactive 
export async function toggleRule(req, res) {
  try {
    const { access_token, instance_url, object_api_name, validation_rule_name, is_active } = req.body;

    if (!access_token || !instance_url || !object_api_name || !validation_rule_name || typeof is_active !== 'boolean')
      return res.status(400).json({ error: 'Missing required fields' });

    const result = await toggleValidationRule(access_token, instance_url, object_api_name, validation_rule_name, is_active);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('toggleRule error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error updating validation rule',
      details: error.response?.data || error.message
    });
  }
}

// CREATE a new rule
export async function createRule(req, res) {
  try {
    const { access_token, instance_url, object_api_name, rule } = req.body;

    if (!access_token || !instance_url || !object_api_name || !rule)
      return res.status(400).json({ error: 'Missing required fields' });

    if (!rule.ValidationName || !rule.errorConditionFormula || !rule.errorMessage)
      return res.status(400).json({ error: 'ValidationName, errorConditionFormula and errorMessage are required' });

    const result = await createValidationRule(access_token, instance_url, object_api_name, rule);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('createRule error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error creating validation rule',
      details: error.response?.data || error.message
    });
  }
}

// UPDATE (full edit) a rule 
export async function updateRule(req, res) {
  try {
    const { access_token, instance_url, object_api_name, validation_rule_name, rule } = req.body;

    if (!access_token || !instance_url || !object_api_name || !validation_rule_name || !rule)
      return res.status(400).json({ error: 'Missing required fields' });

    const result = await updateValidationRule(access_token, instance_url, object_api_name, validation_rule_name, rule);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('updateRule error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error updating validation rule',
      details: error.response?.data || error.message
    });
  }
}

// DELETE a rule 
export async function deleteRule(req, res) {
  try {
    const { access_token, instance_url, object_api_name, validation_rule_name } = req.body;

    if (!access_token || !instance_url || !object_api_name || !validation_rule_name)
      return res.status(400).json({ error: 'Missing required fields' });

    const result = await deleteValidationRule(access_token, instance_url, object_api_name, validation_rule_name);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('deleteRule error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error deleting validation rule',
      details: error.response?.data || error.message
    });
  }
}