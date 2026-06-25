// ════════════════════════════════════════════════════════════════
// Ottawa Rental Plug — Analytics (Google Analytics 4)
//
// SETUP (one time, ~5 minutes):
//   1. Go to https://analytics.google.com → Admin → Create Property
//      ("Ottawa Rental Plug", ottawarentalplug.com)
//   2. Create a Web data stream → copy the Measurement ID (G-XXXXXXXXXX)
//   3. Paste it below and redeploy. That's it — every page already
//      includes this file.
// ════════════════════════════════════════════════════════════════
const GA_MEASUREMENT_ID = 'G-L1RQLSZRJJ';

if (GA_MEASUREMENT_ID) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });

  // Conversion events — fire automatically on key actions
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form');
    if (form && form.id) gtag('event', 'generate_lead', { form_id: form.id });
  }, true);

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (!a) return;
    gtag('event', a.href.startsWith('tel:') ? 'phone_call_click' : 'email_click');
  }, true);
}
