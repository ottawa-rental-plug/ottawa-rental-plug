const { supabase } = require('../utils/supabase');
const RealtorCaIntegration = require('../integrations/RealtorCaIntegration');

const realtorCa = new RealtorCaIntegration();

exports.handler = async (event) => {
  try {
    console.log('[RealtorCa Webhook] Received webhook');

    // Verify webhook signature
    if (!realtorCa.verifyWebhookSignature(event)) {
      console.warn('[RealtorCa Webhook] Invalid signature');
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    const data = JSON.parse(event.body || '{}');
    console.log('[RealtorCa Webhook] Event:', data.event_type || 'unknown');

    // Route event to appropriate handler
    if (data.event_type === 'listing_viewed') {
      return await handleViewEvent(data);
    }

    if (data.event_type === 'listing_inquiry') {
      return await handleInquiryEvent(data);
    }

    if (data.event_type === 'listing_saved') {
      return await handleSaveEvent(data);
    }

    if (data.event_type === 'listing_removed') {
      return await handleRemovalEvent(data);
    }

    if (data.event_type === 'listing_updated') {
      return await handleUpdateEvent(data);
    }

    console.log('[RealtorCa Webhook] Unhandled event type:', data.event_type);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', message: 'Event received but not handled' })
    };
  } catch (error) {
    console.error('[RealtorCa Webhook] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function handleViewEvent(data) {
  try {
    const { listing_id, view_count, viewer_ip, viewed_at } = data;

    console.log(`[RealtorCa Webhook] Listing ${listing_id} viewed (total: ${view_count})`);

    // Find the ORP unit by external ID
    const { data: platform, error } = await supabase
      .from('syndication_platforms')
      .select('unit_id')
      .eq('platform', 'realtor_ca')
      .eq('external_id', listing_id)
      .single();

    if (error || !platform) {
      console.warn('[RealtorCa Webhook] No ORP unit found for listing:', listing_id);
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', message: 'Listing not in ORP system' })
      };
    }

    // Record the view event
    const { error: recordError } = await supabase
      .from('syndication_history')
      .insert([{
        unit_id: platform.unit_id,
        platform: 'realtor_ca',
        action: 'viewed',
        details: {
          external_id: listing_id,
          view_count,
          viewer_ip,
          viewed_at
        }
      }]);

    if (recordError) {
      console.error('[RealtorCa Webhook] Failed to record view:', recordError);
    }

    // Send notification if ntfy is configured
    await sendNotification(
      'Listing Viewed on Realtor.ca',
      `Your listing (${listing_id}) was viewed on Realtor.ca`,
      'realtor-view'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', message: 'View recorded' })
    };
  } catch (error) {
    console.error('[RealtorCa Webhook] View handler error:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', error: error.message })
    };
  }
}

async function handleInquiryEvent(data) {
  try {
    const { listing_id, inquirer_name, inquirer_email, inquirer_phone, inquiry_message, inquiry_date } = data;

    console.log(`[RealtorCa Webhook] Inquiry on listing ${listing_id} from ${inquirer_email}`);

    // Find the ORP unit
    const { data: platform, error } = await supabase
      .from('syndication_platforms')
      .select('unit_id')
      .eq('platform', 'realtor_ca')
      .eq('external_id', listing_id)
      .single();

    if (error || !platform) {
      console.warn('[RealtorCa Webhook] No ORP unit found for listing:', listing_id);
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', message: 'Listing not in ORP system' })
      };
    }

    // Record the inquiry as an applicant
    const { data: applicant, error: applicantError } = await supabase
      .from('applicants')
      .insert([{
        name: inquirer_name,
        email: inquirer_email,
        phone: inquirer_phone,
        message: inquiry_message,
        unit_id: platform.unit_id,
        source: 'realtor_ca',
        created_at: inquiry_date || new Date().toISOString(),
        status: 'new'
      }])
      .select('id')
      .single();

    if (applicantError) {
      console.error('[RealtorCa Webhook] Failed to create applicant:', applicantError);
    }

    // Record the inquiry event
    await supabase
      .from('syndication_history')
      .insert([{
        unit_id: platform.unit_id,
        platform: 'realtor_ca',
        action: 'inquiry',
        details: {
          external_id: listing_id,
          inquirer_name,
          inquirer_email,
          inquirer_phone,
          inquiry_date,
          applicant_id: applicant?.id
        }
      }]);

    // Send notification
    await sendNotification(
      'New Inquiry on Realtor.ca',
      `${inquirer_name} inquired about your listing: ${inquirer_email} | ${inquirer_phone}`,
      'realtor-inquiry'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', message: 'Inquiry recorded' })
    };
  } catch (error) {
    console.error('[RealtorCa Webhook] Inquiry handler error:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', error: error.message })
    };
  }
}

async function handleSaveEvent(data) {
  try {
    const { listing_id, saver_email, saved_at } = data;

    console.log(`[RealtorCa Webhook] Listing ${listing_id} saved by ${saver_email}`);

    // Find the ORP unit
    const { data: platform, error } = await supabase
      .from('syndication_platforms')
      .select('unit_id')
      .eq('platform', 'realtor_ca')
      .eq('external_id', listing_id)
      .single();

    if (error || !platform) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', message: 'Listing not in ORP system' })
      };
    }

    // Record the save event
    await supabase
      .from('syndication_history')
      .insert([{
        unit_id: platform.unit_id,
        platform: 'realtor_ca',
        action: 'saved',
        details: {
          external_id: listing_id,
          saver_email,
          saved_at
        }
      }]);

    await sendNotification(
      'Listing Saved on Realtor.ca',
      `Your listing was saved by ${saver_email}`,
      'realtor-save'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', message: 'Save recorded' })
    };
  } catch (error) {
    console.error('[RealtorCa Webhook] Save handler error:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', error: error.message })
    };
  }
}

async function handleRemovalEvent(data) {
  try {
    const { listing_id, reason, removed_at } = data;

    console.log(`[RealtorCa Webhook] Listing ${listing_id} removed: ${reason}`);

    // Find the ORP unit
    const { data: platform, error } = await supabase
      .from('syndication_platforms')
      .select('unit_id')
      .eq('platform', 'realtor_ca')
      .eq('external_id', listing_id)
      .single();

    if (error || !platform) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', message: 'Listing not in ORP system' })
      };
    }

    // Update syndication_platforms status
    await supabase
      .from('syndication_platforms')
      .update({ status: 'removed' })
      .eq('unit_id', platform.unit_id)
      .eq('platform', 'realtor_ca');

    // Record the removal
    await supabase
      .from('syndication_history')
      .insert([{
        unit_id: platform.unit_id,
        platform: 'realtor_ca',
        action: 'removed',
        details: {
          external_id: listing_id,
          reason,
          removed_at
        }
      }]);

    await sendNotification(
      'Listing Removed from Realtor.ca',
      `Your listing was removed: ${reason}`,
      'realtor-removal'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', message: 'Removal recorded' })
    };
  } catch (error) {
    console.error('[RealtorCa Webhook] Removal handler error:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', error: error.message })
    };
  }
}

async function handleUpdateEvent(data) {
  try {
    const { listing_id, updated_fields, updated_at } = data;

    console.log(`[RealtorCa Webhook] Listing ${listing_id} updated:`, updated_fields);

    // Find the ORP unit
    const { data: platform, error } = await supabase
      .from('syndication_platforms')
      .select('unit_id')
      .eq('platform', 'realtor_ca')
      .eq('external_id', listing_id)
      .single();

    if (error || !platform) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', message: 'Listing not in ORP system' })
      };
    }

    // Record the update
    await supabase
      .from('syndication_history')
      .insert([{
        unit_id: platform.unit_id,
        platform: 'realtor_ca',
        action: 'updated',
        details: {
          external_id: listing_id,
          updated_fields,
          updated_at
        }
      }]);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', message: 'Update recorded' })
    };
  } catch (error) {
    console.error('[RealtorCa Webhook] Update handler error:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', error: error.message })
    };
  }
}

async function sendNotification(title, message, tags = '') {
  try {
    if (!process.env.NTFY_TOPIC) return;

    const ntfyUrl = `${process.env.NTFY_BASE_URL || 'https://ntfy.sh'}/${process.env.NTFY_TOPIC}`;

    await fetch(ntfyUrl, {
      method: 'POST',
      headers: {
        'Title': title,
        'Message': message,
        'Tags': tags
      }
    });
  } catch (error) {
    console.error('[RealtorCa Webhook] Notification error:', error);
  }
}
