const { supabase, verifyAuth } = require('./utils/supabase');
const SyndicationService = require('./services/SyndicationService');

const syndication = new SyndicationService();

exports.handler = async (event) => {
  try {
    console.log(`[Syndicate] ${event.httpMethod} ${event.path}`);

    // Verify authentication
    const user = await verifyAuth(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const { httpMethod, path, body } = event;

    // POST /syndicate - Trigger sync for a listing
    if (httpMethod === 'POST' && path === '/.netlify/functions/syndicate') {
      return handleSync(user, JSON.parse(body || '{}'));
    }

    // GET /syndicate/:unitId/status - Check syndication status
    if (httpMethod === 'GET' && path.includes('/status')) {
      const unitId = path.split('/').slice(-2, -1)[0];
      return handleStatus(user, unitId);
    }

    // GET /syndicate/:unitId/history - Get sync history
    if (httpMethod === 'GET' && path.includes('/history')) {
      const unitId = path.split('/').slice(-2, -1)[0];
      return handleHistory(user, unitId);
    }

    // POST /syndicate/:unitId/delete - Delete listing from platforms
    if (httpMethod === 'POST' && path.includes('/delete')) {
      const unitId = path.split('/').slice(-2, -1)[0];
      return handleDelete(user, unitId, JSON.parse(body || '{}'));
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' })
    };
  } catch (error) {
    console.error('[Syndicate] Unhandled error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};

async function handleSync(user, data) {
  try {
    const { unitId, platforms = ['realtor_ca', 'kijiji'] } = data;

    if (!unitId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'unitId is required' })
      };
    }

    console.log(`[Syndicate] Syncing unit ${unitId} to ${platforms.join(', ')}`);

    // Verify user owns the unit
    const unit = await verifyUnitOwnership(user, unitId);
    if (!unit) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You do not own this unit' })
      };
    }

    // Perform syndication
    const results = await syndication.syncListing(unitId, platforms);

    // Update syndication_platforms table with results
    for (const [platform, result] of Object.entries(results)) {
      if (result.error) {
        // Record failure
        await supabase
          .from('syndication_platforms')
          .update({
            status: 'failed',
            last_error: result.error,
            last_sync_at: new Date().toISOString()
          })
          .eq('unit_id', unitId)
          .eq('platform', platform);
      } else {
        // Record success
        await supabase
          .from('syndication_platforms')
          .upsert({
            unit_id: unitId,
            platform,
            external_id: result.external_id,
            external_url: result.external_url,
            status: 'synced',
            last_sync_at: new Date().toISOString(),
            last_error: null
          }, { onConflict: 'unit_id,platform' });
      }
    }

    // Send notification if webhook is configured
    if (process.env.NTFY_TOPIC) {
      const successCount = Object.values(results).filter(r => !r.error).length;
      const failureCount = Object.values(results).filter(r => r.error).length;
      await sendNotification(
        'Syndication Complete',
        `Unit ${unitId}: ${successCount} succeeded, ${failureCount} failed`,
        `syndication,${unitId}`
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        unitId,
        results,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[Syndicate] Sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function handleStatus(user, unitId) {
  try {
    if (!unitId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'unitId is required' })
      };
    }

    // Verify ownership
    const unit = await verifyUnitOwnership(user, unitId);
    if (!unit) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You do not own this unit' })
      };
    }

    const statuses = await syndication.getSyndicationStatus(unitId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        unitId,
        platforms: statuses,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[Syndicate] Status error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function handleHistory(user, unitId) {
  try {
    if (!unitId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'unitId is required' })
      };
    }

    // Verify ownership
    const unit = await verifyUnitOwnership(user, unitId);
    if (!unit) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You do not own this unit' })
      };
    }

    const history = await syndication.getSyncHistory(unitId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        unitId,
        history,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[Syndicate] History error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function handleDelete(user, unitId, data) {
  try {
    const { platforms = ['realtor_ca', 'kijiji'] } = data;

    if (!unitId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'unitId is required' })
      };
    }

    console.log(`[Syndicate] Deleting unit ${unitId} from ${platforms.join(', ')}`);

    // Verify ownership
    const unit = await verifyUnitOwnership(user, unitId);
    if (!unit) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You do not own this unit' })
      };
    }

    // Perform deletion
    const results = await syndication.deleteListing(unitId, platforms);

    // Update syndication_platforms table
    for (const [platform, result] of Object.entries(results)) {
      if (result.status === 'deleted') {
        // Remove or mark as deleted
        await supabase
          .from('syndication_platforms')
          .update({
            status: 'deleted',
            last_sync_at: new Date().toISOString()
          })
          .eq('unit_id', unitId)
          .eq('platform', platform);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        unitId,
        results,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[Syndicate] Delete error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function verifyUnitOwnership(user, unitId) {
  try {
    // Get landlord for this user
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (landlordError) {
      console.warn('[Syndicate] Landlord lookup failed:', landlordError);
      return null;
    }

    if (!landlord) {
      console.warn('[Syndicate] No landlord found for user:', user.id);
      return null;
    }

    // Verify user owns this unit
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('*')
      .eq('id', unitId)
      .eq('landlord_id', landlord.id)
      .single();

    if (unitError) {
      console.warn('[Syndicate] Unit lookup failed:', unitError);
      return null;
    }

    return unit;
  } catch (error) {
    console.error('[Syndicate] Verification error:', error);
    return null;
  }
}

async function sendNotification(title, message, tags = '') {
  try {
    if (!process.env.NTFY_TOPIC) return;

    const ntfyUrl = `${process.env.NTFY_BASE_URL || 'https://ntfy.sh'}/${process.env.NTFY_TOPIC}`;

    const response = await fetch(ntfyUrl, {
      method: 'POST',
      headers: {
        'Title': title,
        'Message': message,
        'Tags': tags
      }
    });

    if (!response.ok) {
      console.warn('[Syndicate] Notification failed:', response.status);
    }
  } catch (error) {
    console.error('[Syndicate] Notification error:', error);
    // Don't fail if notification fails
  }
}
