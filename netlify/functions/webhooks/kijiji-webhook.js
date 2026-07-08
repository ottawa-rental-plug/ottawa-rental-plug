const { supabase } = require('../utils/supabase');

exports.handler = async (event) => {
  try {
    console.log('[Kijiji Webhook] Received request');

    const data = JSON.parse(event.body || '{}');
    console.log('[Kijiji Webhook] Event:', data.event_type || 'unknown');

    // Note: Kijiji does not currently offer official webhook support for individual listings.
    // This endpoint is a placeholder for future integration if/when Kijiji adds webhook support.

    // Current recommendation: Monitor Kijiji listings manually via:
    // 1. Check Kijiji dashboard for inquiries periodically
    // 2. Use email forwarding if Kijiji sends notification emails
    // 3. Implement periodic polling via Apify if needed

    if (data.event_type === 'inquiry') {
      return await handleInquiryEvent(data);
    }

    if (data.event_type === 'listing_removed') {
      return await handleRemovalEvent(data);
    }

    console.log('[Kijiji Webhook] Kijiji webhooks not yet supported. Use manual tracking or polling.');

    return {
      statusCode: 501,
      body: JSON.stringify({
        status: 'not_implemented',
        message: 'Kijiji webhooks not currently supported. Manual tracking recommended.'
      })
    };
  } catch (error) {
    console.error('[Kijiji Webhook] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function handleInquiryEvent(data) {
  try {
    const { listing_id, inquirer_name, inquirer_email, inquirer_phone, message } = data;

    console.log(`[Kijiji Webhook] Inquiry on listing ${listing_id} from ${inquirer_email}`);

    // Find the ORP unit
    const { data: platform, error } = await supabase
      .from('syndication_platforms')
      .select('unit_id')
      .eq('platform', 'kijiji')
      .eq('external_id', listing_id)
      .single();

    if (error || !platform) {
      console.warn('[Kijiji Webhook] No ORP unit found for listing:', listing_id);
      return {
        statusCode: 404,
        body: JSON.stringify({ status: 'not_found' })
      };
    }

    // Record the inquiry
    const { data: applicant } = await supabase
      .from('applicants')
      .insert([{
        name: inquirer_name,
        email: inquirer_email,
        phone: inquirer_phone,
        message: message || 'Inquiry from Kijiji',
        unit_id: platform.unit_id,
        source: 'kijiji',
        status: 'new'
      }])
      .select('id')
      .single();

    // Log the event
    await supabase
      .from('syndication_history')
      .insert([{
        unit_id: platform.unit_id,
        platform: 'kijiji',
        action: 'inquiry',
        details: {
          external_id: listing_id,
          inquirer_name,
          inquirer_email,
          inquirer_phone,
          applicant_id: applicant?.id
        }
      }]);

    // Send notification
    await sendNotification(
      'New Inquiry on Kijiji',
      `${inquirer_name} inquired about your listing: ${inquirer_email} | ${inquirer_phone}`,
      'kijiji-inquiry'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' })
    };
  } catch (error) {
    console.error('[Kijiji Webhook] Inquiry handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function handleRemovalEvent(data) {
  try {
    const { listing_id, reason } = data;

    console.log(`[Kijiji Webhook] Listing ${listing_id} removed: ${reason}`);

    // Find the ORP unit
    const { data: platform, error } = await supabase
      .from('syndication_platforms')
      .select('unit_id')
      .eq('platform', 'kijiji')
      .eq('external_id', listing_id)
      .single();

    if (error || !platform) {
      return {
        statusCode: 404,
        body: JSON.stringify({ status: 'not_found' })
      };
    }

    // Update status
    await supabase
      .from('syndication_platforms')
      .update({ status: 'removed' })
      .eq('unit_id', platform.unit_id)
      .eq('platform', 'kijiji');

    // Log the event
    await supabase
      .from('syndication_history')
      .insert([{
        unit_id: platform.unit_id,
        platform: 'kijiji',
        action: 'removed',
        details: {
          external_id: listing_id,
          reason
        }
      }]);

    await sendNotification(
      'Listing Removed from Kijiji',
      `Your listing was removed: ${reason}`,
      'kijiji-removal'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' })
    };
  } catch (error) {
    console.error('[Kijiji Webhook] Removal handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
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
    console.error('[Kijiji Webhook] Notification error:', error);
  }
}

/**
 * MANUAL KIJIJI TRACKING GUIDE
 *
 * Since Kijiji doesn't offer webhooks, here are the recommended approaches:
 *
 * 1. EMAIL FORWARDING (Simplest)
 *    - Kijiji sends email notifications for inquiries
 *    - Forward to a parser email address
 *    - Parser extracts inquiry data and stores in applicants table
 *
 * 2. POLLING VIA APIFY (Automated)
 *    - Create Netlify function to periodically poll Kijiji account
 *    - Use Apify actor to check for new inquiries/messages
 *    - Run on schedule (e.g., every 30 minutes)
 *
 * 3. MANUAL DASHBOARD (Low-Tech)
 *    - Landlords check Kijiji dashboard manually
 *    - Log inquiries in ORP dashboard
 *    - Less automated but reliable
 *
 * To implement option 2 (recommended):
 * - Create netlify/functions/kijiji-polling.js
 * - Call Apify actor to fetch messages
 * - Parse and create applicants
 * - Schedule via scheduled function or CronJob
 */
