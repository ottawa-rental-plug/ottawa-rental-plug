class SyndicationManager {
  constructor(containerId, unitId) {
    this.container = document.getElementById(containerId);
    this.unitId = unitId;
    this.status = {};
    this.history = [];
    this.syncing = {};
  }

  async init() {
    this.render();
    await this.loadStatus();
    await this.loadHistory();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="syndication-manager">
        <!-- Platform Status Cards -->
        <div class="platforms-grid" id="platformsGrid"></div>

        <!-- Sync History -->
        <div class="sync-history-section" id="historySection" style="display: none;">
          <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 16px; margin-bottom: 8px;">Recent Activity</div>
          <div id="syncHistory" class="sync-history-list"></div>
        </div>

        <!-- Loading State -->
        <div id="loadingState" style="text-align: center; padding: 20px; color: #64748b;">
          Loading syndication status...
        </div>

        <!-- Error State -->
        <div id="errorState" style="display: none; padding: 12px; background: #fee2e2; border-radius: 6px; color: #dc2626; font-size: 13px;"></div>
      </div>
    `;
  }

  async loadStatus() {
    try {
      const response = await fetch(`/.netlify/functions/syndicate/${this.unitId}/status`);

      if (!response.ok) {
        throw new Error(`Failed to load status: ${response.statusText}`);
      }

      const data = await response.json();
      this.status = data.platforms || {};

      this.renderPlatforms();
      document.getElementById('loadingState').style.display = 'none';
    } catch (error) {
      console.error('Error loading syndication status:', error);
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('errorState').style.display = 'block';
      document.getElementById('errorState').textContent = `Error: ${error.message}`;
    }
  }

  async loadHistory() {
    try {
      const response = await fetch(`/.netlify/functions/syndicate/${this.unitId}/history`);

      if (!response.ok) return;

      const data = await response.json();
      this.history = data.history || [];

      this.renderHistory();
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  renderPlatforms() {
    const platforms = ['realtor_ca', 'kijiji', 'airbnb'];
    const platformNames = {
      realtor_ca: 'Realtor.ca',
      kijiji: 'Kijiji',
      airbnb: 'Airbnb'
    };

    const grid = document.getElementById('platformsGrid');
    grid.innerHTML = platforms
      .map(platform => {
        const status = this.status.find(p => p.platform === platform);
        const syncing = this.syncing[platform];

        return `
          <div class="platform-card" data-platform="${platform}">
            <div class="platform-header">
              <span class="platform-name">${platformNames[platform]}</span>
              ${status ? `<span class="status-badge status-${status.status}">${this.formatStatus(status.status)}</span>` : ''}
            </div>

            ${status ? `
              <div class="platform-details">
                ${status.status === 'synced' ? `
                  <div class="detail-row">
                    <span class="detail-label">External ID:</span>
                    <span class="detail-value">${status.external_id || '—'}</span>
                  </div>
                  ${status.external_url ? `
                    <div class="detail-row">
                      <a href="${status.external_url}" target="_blank" rel="noopener" class="external-link">
                        View on ${platformNames[platform]} →
                      </a>
                    </div>
                  ` : ''}
                  ${status.last_sync_at ? `
                    <div class="detail-row">
                      <span class="detail-label">Last synced:</span>
                      <span class="detail-value">${this.formatDate(status.last_sync_at)}</span>
                    </div>
                  ` : ''}
                ` : ''}

                ${status.status === 'failed' ? `
                  <div class="error-message">
                    ${status.last_error || 'Sync failed'}
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <div class="platform-actions">
              <button class="sync-btn ${syncing ? 'syncing' : ''}"
                      data-platform="${platform}"
                      ${syncing ? 'disabled' : ''}>
                ${syncing ? '<span class="spinner"></span> Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach sync button handlers
    grid.querySelectorAll('.sync-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const platform = btn.dataset.platform;
        this.syncPlatform(platform);
      });
    });
  }

  renderHistory() {
    if (this.history.length === 0) {
      document.getElementById('historySection').style.display = 'none';
      return;
    }

    document.getElementById('historySection').style.display = 'block';

    const historyList = document.getElementById('syncHistory');
    historyList.innerHTML = this.history
      .slice(0, 5) // Show last 5 events
      .map(event => `
        <div class="history-item">
          <div class="history-time">${this.formatDate(event.created_at)}</div>
          <div class="history-content">
            <span class="history-platform">${this.platformName(event.platform)}</span>
            <span class="history-action">${this.formatAction(event.action)}</span>
            ${event.details?.external_id ? `<span class="history-id">#${event.details.external_id}</span>` : ''}
          </div>
        </div>
      `)
      .join('');
  }

  async syncPlatform(platform) {
    this.syncing[platform] = true;
    this.renderPlatforms();

    try {
      console.log(`[Syndication] Starting sync for ${platform}`);

      const response = await fetch('/.netlify/functions/syndicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          unitId: this.unitId,
          platforms: [platform]
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `Sync failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Syndication] Sync complete:`, data);

      // Reload status
      await this.loadStatus();
      await this.loadHistory();
    } catch (error) {
      console.error('[Syndication] Sync error:', error);
      alert(`Sync failed: ${error.message}`);
    } finally {
      this.syncing[platform] = false;
      this.renderPlatforms();
    }
  }

  async getAuthToken() {
    // Get token from Supabase session if available
    // Otherwise return empty (will use cookies)
    try {
      if (window.sb && typeof window.sb.auth.getSession === 'function') {
        const { data } = await window.sb.auth.getSession();
        return data.session?.access_token || '';
      }
    } catch (error) {
      console.warn('Could not get auth token:', error);
    }
    return '';
  }

  formatStatus(status) {
    const statusMap = {
      'synced': 'Synced ✓',
      'pending': 'Pending...',
      'failed': 'Failed ✗',
      'deleted': 'Deleted',
      'not_synced': 'Not Synced'
    };
    return statusMap[status] || status;
  }

  formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  formatAction(action) {
    const actionMap = {
      'synced': 'Synced',
      'created': 'Created',
      'updated': 'Updated',
      'deleted': 'Deleted',
      'error': 'Error',
      'viewed': 'Viewed',
      'inquiry': 'Inquiry',
      'saved': 'Saved'
    };
    return actionMap[action] || action;
  }

  platformName(platform) {
    const names = {
      'realtor_ca': 'Realtor.ca',
      'kijiji': 'Kijiji',
      'airbnb': 'Airbnb'
    };
    return names[platform] || platform;
  }

  attachEventListeners() {
    // Event listeners already attached in renderPlatforms
  }
}

// Styles (add to page CSS or use the photo-uploader.css)
const styles = document.createElement('style');
styles.textContent = `
.syndication-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.platform-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  background-color: #f8fafc;
  transition: all 0.2s ease;
}

.platform-card:hover {
  border-color: #06b6d4;
  background-color: #cffafe;
}

.platform-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.platform-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.status-badge {
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.status-synced {
  background-color: #d1fae5;
  color: #065f46;
}

.status-pending {
  background-color: #fef3c7;
  color: #92400e;
}

.status-failed {
  background-color: #fee2e2;
  color: #991b1b;
}

.status-deleted {
  background-color: #f3f4f6;
  color: #6b7280;
}

.platform-details {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  line-height: 1.4;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.detail-label {
  font-weight: 500;
  color: #475569;
}

.detail-value {
  color: #64748b;
  text-align: right;
  word-break: break-all;
}

.external-link {
  color: #06b6d4;
  text-decoration: none;
  font-weight: 600;
  display: inline-block;
}

.external-link:hover {
  text-decoration: underline;
}

.error-message {
  padding: 8px;
  background-color: #fee2e2;
  border-radius: 4px;
  color: #991b1b;
  font-size: 12px;
  margin-top: 8px;
}

.platform-actions {
  display: flex;
  gap: 8px;
}

.sync-btn {
  flex: 1;
  padding: 8px 12px;
  background-color: #06b6d4;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.sync-btn:hover:not(:disabled) {
  background-color: #0d9488;
}

.sync-btn:disabled {
  background-color: #cbd5e1;
  cursor: not-allowed;
  opacity: 0.6;
}

.sync-btn.syncing {
  background-color: #f59e0b;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sync-history-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}

.sync-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  background-color: #f8fafc;
  border-radius: 4px;
  font-size: 12px;
}

.history-time {
  color: #94a3b8;
  white-space: nowrap;
  font-weight: 500;
}

.history-content {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.history-platform {
  font-weight: 600;
  color: #0f172a;
}

.history-action {
  color: #64748b;
}

.history-id {
  background-color: #e2e8f0;
  padding: 2px 4px;
  border-radius: 2px;
  color: #475569;
  font-family: monospace;
  font-size: 11px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .platform-card {
    background-color: #1e293b;
    border-color: #334155;
  }

  .platform-card:hover {
    background-color: #0f172a;
  }

  .platform-name {
    color: #f1f5f9;
  }

  .platform-details {
    color: #cbd5e1;
  }

  .detail-label {
    color: #cbd5e1;
  }

  .detail-value {
    color: #cbd5e1;
  }

  .history-item {
    background-color: #1e293b;
  }

  .history-platform {
    color: #f1f5f9;
  }

  .history-action {
    color: #cbd5e1;
  }

  .history-id {
    background-color: #334155;
    color: #cbd5e1;
  }
}
`;
document.head.appendChild(styles);
