# Form 410 Rental Application - Deployment Guide

## Quick Start

### Local Development
```bash
cd C:\Users\cyril\OneDrive\Desktop\Website
npm install
node server.js
```

Access at: `http://localhost:3000/rental-application`

### Netlify Production Deployment
```bash
npm run build:css
git add .
git commit -m "Add Form 410 rental application system"
git push origin main
```

Netlify automatically deploys on push to main.

---

## System Architecture

### Local Development
```
User → rental-application.html (Client)
           ↓
    Browser JavaScript
           ↓
    POST /api/generate-form-410
           ↓
    server.js (Express)
           ↓
    Python subprocess
           ↓
    generate_form_410.py (ReportLab)
           ↓
    PDF binary
           ↓
    Browser download
```

### Netlify Production
```
User → rental-application.html (Client)
           ↓
    Browser JavaScript
           ↓
    POST /.netlify/functions/generate-form-410
           ↓
    Netlify Serverless Function
           ↓
    generate-form-410.js (PDFKit)
           ↓
    PDF binary (base64)
           ↓
    Browser download
```

---

## Deployment Checklist

### Pre-Deployment (Local Testing)
- [x] Questionnaire UI tested
- [x] Form validation working
- [x] PDF generation tested locally
- [x] Co-applicant logic fixed
- [x] Integration button added to apply.html
- [x] Node.js serverless function created

### Deployment Steps

#### 1. Verify Files Are in Repository
```bash
git status
# Should show:
# - netlify.toml
# - netlify/functions/generate-form-410.js
# - rental-application.html
# - generate_form_410.py (for reference/local)
# - server.js (for local dev)
# - apply.html (updated with Form 410 link)
```

#### 2. Update package.json
```bash
npm install
# Ensures pdfkit is available for serverless functions
```

#### 3. Build CSS (if needed)
```bash
npm run build:css
```

#### 4. Commit and Push
```bash
git add -A
git commit -m "Deploy Form 410 rental application system with Netlify serverless backend"
git push origin main
```

#### 5. Verify Netlify Deployment
1. Go to https://app.netlify.com
2. Navigate to your ORP site
3. Check Deploy tab for successful build
4. Test at: https://ottawarentalplug.com/rental-application

---

## Configuration

### Netlify Environment Variables
Set in Netlify dashboard (Site Settings → Build & Deploy → Environment):

```
PYTHON_PATH=python3  # (Optional, for build-time operations)
```

### Netlify Timeout
Default: 30 seconds
Current setting in `netlify.toml`: 30 seconds

For large PDFs or slow networks, increase if needed:
```toml
[functions]
  timeout = 60
```

### Memory Allocation
Current setting: 1024 MB
For typical Form 410 generation, this is more than sufficient.

---

## API Endpoints

### Local Development
```
POST http://localhost:3000/api/generate-form-410
GET  http://localhost:3000/api/health
```

### Netlify Production
```
POST https://ottawarentalplug.com/.netlify/functions/generate-form-410
GET  https://ottawarentalplug.com/.netlify/functions/generate-form-410?check=1
```

---

## Request/Response Format

### Request (POST)
```json
{
  "applicationDate": "07/07/2026",
  "applicants": {
    "applicant1": {
      "fullName": "Sarah Mitchell",
      "dateOfBirth": "15/05/1990",
      "driversLicense": "L1234567",
      "sin": "123-45-6789",
      "occupation": "Software Engineer"
    },
    "applicant2": null
  },
  "otherOccupants": [],
  "rentalHistory": { ... },
  "employment": { ... },
  "banking": { ... },
  "financialObligations": { ... },
  "personalReferences": [],
  "vehicles": []
}
```

### Response (Success)
```
200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="Form_410_Application.pdf"
[Binary PDF Data]
```

### Response (Error)
```json
400 Bad Request
{
  "error": "Missing required applicant information"
}

500 Internal Server Error
{
  "error": "Error message"
}
```

---

## Troubleshooting

### Issue: PDF Generation Fails on Netlify
**Solution:** Check function logs in Netlify dashboard
- Site Settings → Functions → Logs
- Look for pdfkit module errors
- Ensure netlify.toml is in repository root

### Issue: Button Shows "Use Form 410" But Link Doesn't Work
**Solution:** Verify files are deployed
```bash
# Local check
ls netlify/functions/generate-form-410.js
ls rental-application.html
ls netlify.toml

# Netlify check
# Go to Netlify dashboard → Deploys → See deployment logs
```

### Issue: Questionnaire Works But PDF Download Doesn't Start
**Solution:** Check browser console for errors
1. Open DevTools (F12)
2. Go to Console tab
3. Look for API error messages
4. Check Network tab for POST response status

### Issue: Form Submission Hangs/Times Out
**Solution:** Increase function timeout in netlify.toml
```toml
[functions]
  timeout = 60  # Increase from 30 to 60 seconds
```

---

## Testing in Production

### Test Form 410 Generation
1. Go to https://ottawarentalplug.com/rental-application
2. Fill form with test data:
   - Name: Test User
   - DOB: 01/01/1990
   - Occupation: Tester
   - (Etc.)
3. Click "Generate Form 410"
4. Should download `Form_410_Application.pdf`

### Test Integration Button
1. Go to https://ottawarentalplug.com/apply
2. Look for "Use Form 410" banner at top
3. Click the button
4. Should navigate to /rental-application

### Test on Mobile
1. Use mobile device or DevTools device emulation
2. Form should be fully responsive
3. Button and links should work
4. PDF download should work

---

## Performance Metrics

### Expected Response Times
- Local (Python): 1-2 seconds
- Netlify (PDFKit): 2-3 seconds

### PDF File Size
- Typical: 3.6-4.4 KB
- With many references/vehicles: 5-7 KB

### Netlify Function Execution
- CPU: ~50-100ms
- Memory: ~100-200 MB
- Duration: ~2-3 seconds

---

## Monitoring & Analytics

### What to Monitor
1. **Form Completion Rate**: Track how many users complete the questionnaire
2. **PDF Generation Failures**: Monitor 5xx errors from serverless function
3. **API Response Time**: Track /.netlify/functions/generate-form-410 performance
4. **User Engagement**: Track clicks on "Use Form 410" button in apply.html

### Netlify Analytics
- Site Settings → Analytics
- Monitor Functions tab for invocations and errors
- Check Build logs for deployment issues

---

## Future Enhancements

### 1. Email Integration
Send generated Form 410 PDF to applicant's email automatically
```javascript
// In generate-form-410.js
await fetch('/.netlify/functions/send-email', {
  method: 'POST',
  body: JSON.stringify({
    email: formData.email,
    pdf: pdfBuffer,
    applicantName: formData.applicants.applicant1.fullName
  })
});
```

### 2. Database Storage
Store submissions in database for agent review
```javascript
// Save to Supabase/Firebase
await db.collection('applications').add({
  timestamp: new Date(),
  formData: formData,
  pdfUrl: storedPdfUrl,
  status: 'pending_review'
});
```

### 3. Digital Signature
Add signature capture and encryption
```javascript
// Use DocuSign or similar
const signedPdf = await docuSign.sign(formData);
```

### 4. Multi-Language Support
Provide questionnaire in French
```javascript
// Load French strings
const translations = {
  en: { ... },
  fr: { ... }
};
```

### 5. Pre-filling from Profile
Auto-populate known user data
```javascript
// Get from auth/profile
const userData = await auth.getCurrentUser();
formData.applicants.applicant1.fullName = userData.name;
```

---

## Maintenance

### Monthly Tasks
- [ ] Check Netlify function logs for errors
- [ ] Review Form 410 PDF generation times
- [ ] Verify no breaking changes in dependencies
- [ ] Test complete flow end-to-end

### Quarterly Tasks
- [ ] Update dependencies
- [ ] Review analytics
- [ ] Check user feedback
- [ ] Test on new devices/browsers

### Annual Tasks
- [ ] Full security audit
- [ ] Update Form 410 template if Ontario changes it
- [ ] Review and optimize CSS
- [ ] Plan feature enhancements

---

## Support

### For Issues
1. Check browser console (F12 → Console)
2. Check Netlify function logs
3. Review this guide's Troubleshooting section
4. File GitHub issue with:
   - Browser version
   - Error message from console
   - Steps to reproduce

### For Questions
Contact: ottawa-rental-plug.com/contact

---

## Rollback Plan

If deployment causes issues:

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or rollback specific Netlify deployment
# Go to Netlify dashboard → Deploys → Select previous deploy → Publish
```

---

## Success Indicators

✅ Form 410 questionnaire loads without errors
✅ Form data validates correctly
✅ PDF generates within 3 seconds
✅ PDF downloads with correct filename
✅ PDF opens correctly and displays all data
✅ Integration button visible on apply.html
✅ Mobile responsive on all devices
✅ No console errors in browser DevTools
✅ No 5xx errors in Netlify function logs

---

## Deployment Complete!

Your Form 410 Rental Application system is now live on Netlify.

**Production URL:** https://ottawarentalplug.com/rental-application

**Current Status:** ✅ Active and Monitored
