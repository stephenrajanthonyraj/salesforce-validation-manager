import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  ValidationName: '',
  Description: '',
  errorConditionFormula: '',
  errorMessage: '',
  errorDisplayField: '',
  Active: true,
};

function Field({ label, name, type = 'text', textarea, formData = {}, setFormData }) {
  const value = formData[name] ?? '';  // ← safe fallback, never crashes

  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => setFormData((p) => ({ ...p, [name]: e.target.value }))}
        />
      ) : type === 'checkbox' ? (
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={!!formData[name]}
            onChange={(e) => setFormData((p) => ({ ...p, [name]: e.target.checked }))}
          />
          <span>{formData[name] ? 'Active' : 'Inactive'}</span>
        </label>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => setFormData((p) => ({ ...p, [name]: e.target.value }))}
        />
      )}
    </div>
  );
}

function App() {
  const [accessToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('access_token') || '';
    } catch {
      return '';
    }
  });
  const [instanceUrl] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('instance_url') || '';
    } catch {
      return '';
    }
  });
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [userInfo, setUserInfo] = useState(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  
  const [editingRule, setEditingRule] = useState(null);
  const [deletingRule, setDeletingRule] = useState(null);
  const [saving, setSaving] = useState(false);

  // Helpers
  const showMsg = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const loginToSalesforce = () => {
    window.location.href = `${BACKEND_URL}/auth/salesforce`;
  };

  // Auth 
  useEffect(() => {
    // If tokens were provided in the URL, clear them from the address bar and
    // notify the user. State is initialized from the URL to avoid synchronous
    // setState calls inside the effect which can cause cascading renders.
    if (accessToken && instanceUrl) {
      window.history.replaceState({}, '', '/');
      setTimeout(() =>showMsg(
        'Logged in successfully.', 'success'),0);
    }
  }, [accessToken, instanceUrl]);

  useEffect(() => {
    if (!accessToken || !instanceUrl) return;

    const fetchUserInfo = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/validation-rules/user-info`, {
          params: {
            access_token: accessToken,
            instance_url: decodeURIComponent(instanceUrl),
          },
        });
        setUserInfo(res.data);
      } catch (error) {
        showMsg('Failed to fetch user info.', error.response?.data?.details?.message || 'error');
      }
    };

    fetchUserInfo();
  }, [accessToken, instanceUrl]);

  // READ 
  const getRules = async () => {
    if (!accessToken || !instanceUrl) {
      showMsg('Please login to Salesforce first.', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/api/validation-rules`, {
      params: {
      access_token: accessToken,
      instance_url: decodeURIComponent(instanceUrl)
      }
    });
      setRules(res.data || []);
      showMsg(`Fetched ${res.data?.length ?? 0} validation rules.`, 'success');
    } catch (error) {
      showMsg(
        error.response?.data?.details?.message || 'Failed to fetch validation rules.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // CREATE 
  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!formData.ValidationName || !formData.errorConditionFormula || !formData.errorMessage) {
      showMsg('Rule Name, Formula, and Error Message are required.', 'error');
      return;
    }
    try {
      setSaving(true);
      await axios.post(`${BACKEND_URL}/api/validation-rules/create`, {
        access_token: accessToken,
        instance_url: instanceUrl,
        object_api_name: 'Account',
        rule: formData,
      });
      showMsg(`Rule "${formData.ValidationName}" created successfully.`, 'success');
      setShowCreate(false);
      await getRules();
    } catch (error) {
      showMsg(
        error.response?.data?.details || error.response?.data?.error || 'Failed to create rule.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  //  UPDATE (Edit) 
  const openEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      ValidationName: rule.ValidationName,
      Description: rule.Description || '',
      errorConditionFormula: rule.ErrorConditionFormula || '',
      errorMessage: rule.ErrorMessage || '',
      errorDisplayField: rule.ErrorDisplayField || '',
      Active: rule.Active,
    });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!formData.errorConditionFormula || !formData.errorMessage) {
      showMsg('Formula and Error Message are required.', 'error');
      return;
    }
    try {
      setSaving(true);
      await axios.post(`${BACKEND_URL}/api/validation-rules/update`, {
        access_token: accessToken,
        instance_url: instanceUrl,
        object_api_name: editingRule.EntityDefinition?.DeveloperName || 'Account',
        validation_rule_name: editingRule.ValidationName,
        rule: formData,
      });
      showMsg(`Rule "${editingRule.ValidationName}" updated successfully.`, 'success');
      setShowEdit(false);
      await getRules();
    } catch (error) {
      showMsg(
        error.response?.data?.details || error.response?.data?.error || 'Failed to update rule.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  // TOGGLE (Active/Inactive) 
  const toggleRule = async (rule) => {
    try {
      const newState = !rule.Active;
      await axios.post(`${BACKEND_URL}/api/validation-rules/toggle`, {
        access_token: accessToken,
        instance_url: instanceUrl,
        object_api_name: rule.EntityDefinition?.DeveloperName || 'Account',
        validation_rule_name: rule.ValidationName,
        is_active: newState,
      });
      showMsg(
        `${rule.ValidationName} ${newState ? 'enabled' : 'disabled'} successfully.`,
        'success'
      );
      await getRules();
    } catch (error) {
      showMsg(
        error.response?.data?.details?.message || 'Failed to update rule.',
        'error'
      );
    }
  };

  // DELETE 
  const openDelete = (rule) => {
    setDeletingRule(rule);
    setShowDelete(true);
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await axios.post(`${BACKEND_URL}/api/validation-rules/delete`, {
        access_token: accessToken,
        instance_url: instanceUrl,
        object_api_name: deletingRule.EntityDefinition?.DeveloperName || 'Account',
        validation_rule_name: deletingRule.ValidationName,
      });
      showMsg(`Rule "${deletingRule.ValidationName}" deleted successfully.`, 'success');
      setShowDelete(false);
      await getRules();
    } catch (error) {
      showMsg(
        error.response?.data?.details || error.response?.data?.error || 'Failed to delete rule.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  // Render 
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span>SF Rule Manager</span>
          </div>
          {userInfo && (
            <div className="user-badge">
              <span className="user-dot" />
              <span>{userInfo.preferred_username || userInfo.name}</span>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {!accessToken ? (
          <div className="login-screen">
            <div className="login-card">
              <div className="login-icon">☁️</div>
              <h1>Salesforce Validation Rule Manager</h1>
              <p>Connect your Salesforce org to manage validation rules in one place.</p>
              <button className="btn btn-primary btn-lg" onClick={loginToSalesforce}>
                Login with Salesforce
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Org info bar */}
            <div className="org-bar">
              <div>
                <span className="org-label">Org</span>
                <span className="org-value">{userInfo?.organization_id || instanceUrl}</span>
              </div>
              <div className="org-actions">
                <button className="btn btn-outline" onClick={getRules} disabled={loading}>
                  {loading ? 'Loading…' : '⟳ Refresh Rules'}
                </button>
                <button className="btn btn-primary" onClick={openCreate}>
                  + New Rule
                </button>
              </div>
            </div>

            {/* Toast */}
            {message.text && (
              <div className={`toast toast-${message.type}`}>{message.text}</div>
            )}

            {/* Table */}
            {rules.length === 0 && !loading ? (
              <div className="empty">
                <p>No validation rules found. Click <strong>Refresh Rules</strong> to load.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Object</th>
                      <th>Rule Name</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.Id}>
                        <td>{rule.EntityDefinition?.DeveloperName || '—'}</td>
                        <td><strong>{rule.ValidationName}</strong></td>
                        <td className="desc">{rule.Description || '—'}</td>
                        <td>
                          <span className={`badge ${rule.Active ? 'badge-active' : 'badge-inactive'}`}>
                            {rule.Active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => openEdit(rule)}
                            >
                              Edit
                            </button>
                            <button
                              className={`btn btn-sm ${rule.Active ? 'btn-warn' : 'btn-success'}`}
                              onClick={() => toggleRule(rule)}
                            >
                              {rule.Active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => openDelete(rule)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Create Modal ── */}
      {showCreate && (
  <Modal title="Create Validation Rule" onClose={() => setShowCreate(false)}>
    <div className="modal-body">
      <Field label="Rule Name *"              name="ValidationName" />
      <Field label="Description"              name="Description" />
      <Field label="Error Condition Formula *" name="errorConditionFormula" textarea />
      <Field label="Error Message *"          name="errorMessage" textarea />
      <Field label="Error Display Field"      name="errorDisplayField" />
      <Field label="Active"                   name="Active" type="checkbox" />
    </div>
    <div className="modal-footer">
      <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
      <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
        {saving ? 'Creating…' : 'Create Rule'}
      </button>
    </div>
  </Modal>
)}

      {/* ── Edit Modal ── */}
      {showEdit && (
        <Modal title={`Edit: ${editingRule?.ValidationName}`} onClose={() => setShowEdit(false)}>
          <div className="modal-body">
            <Field label="Description" name="Description" />
            <Field label="Error Condition Formula *" name="errorConditionFormula" textarea />
            <Field label="Error Message *" name="errorMessage" textarea />
            <Field label="Error Display Field" name="errorDisplayField" />
            <Field label="Active" name="Active" type="checkbox" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setShowEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDelete && (
        <Modal title="Confirm Delete" onClose={() => setShowDelete(false)}>
          <div className="modal-body">
            <p>
              Are you sure you want to delete the rule{' '}
              <strong>"{deletingRule?.ValidationName}"</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setShowDelete(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;