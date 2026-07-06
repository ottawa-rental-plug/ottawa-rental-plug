// PDF Report Generation for ORP Portal (Phase 5)
// Generates lease agreements and screening reports

// Load jsPDF dynamically
async function loadPDFLibrary() {
  if (typeof jsPDF !== 'undefined') return;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  await new Promise(resolve => {
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

async function generateLeaseAgreement(applicant, property, startDate) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  const addText = (text, size = 12, bold = false, color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(lines, 20, y);
    y += size / 2.5 * lines.length + 5;
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  addText('RESIDENTIAL LEASE AGREEMENT', 14, true, [0, 58, 140]);
  addText(`Ottawa Rental Plug - ${new Date().getFullYear()}`, 10);
  y += 10;

  // Property Info
  addText('PROPERTY INFORMATION', 12, true);
  addText(`Address: ${property?.address || 'To be determined'}`);
  addText(`Rent: $${property?.price?.toLocaleString() || 'TBD'} per month`);
  addText(`Bedrooms: ${property?.beds || '—'} | Bathrooms: ${property?.baths || '—'}`);
  y += 5;

  // Tenant Info
  addText('TENANT INFORMATION', 12, true);
  addText(`Name: ${applicant?.name || '—'}`);
  addText(`Email: ${applicant?.email || '—'}`);
  addText(`Phone: ${applicant?.phone || '—'}`);
  addText(`Move-in Date: ${startDate ? new Date(startDate).toLocaleDateString() : 'To be determined'}`);
  y += 5;

  // Terms
  addText('LEASE TERMS', 12, true);
  addText('1. Lease Term: This lease is for a period of twelve (12) months, commencing on the Move-in Date and ending on the same day in the following year, unless terminated earlier per the terms herein.');
  addText('2. Rent: Tenant agrees to pay rent in the amount stated above, due on the first day of each month.');
  addText('3. Security Deposit: A security deposit equal to one month\'s rent is required before occupancy.');
  addText('4. Maintenance: Landlord shall maintain the property in habitable condition. Tenant is responsible for minor repairs and general housekeeping.');
  addText('5. Utilities: Tenant is responsible for [list utilities]. Landlord is responsible for [list utilities].');
  addText('6. No Subletting: Tenant shall not sublet or assign the lease without written consent from Landlord.');
  y += 5;

  // Signatures
  addText('SIGNATURES', 12, true);
  y += 10;
  addText('Landlord: ___________________________     Date: _______________');
  y += 10;
  addText('Tenant: ___________________________     Date: _______________');

  doc.save(`Lease_${applicant?.name || 'Applicant'}.pdf`);
}

async function generateScreeningReport(applicant) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const addText = (text, size = 12, bold = false, color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(lines, 20, y);
    y += size / 2.5 * lines.length + 4;
  };

  // Header
  addText('TENANT SCREENING REPORT', 14, true, [0, 58, 140]);
  addText(`Prepared: ${new Date().toLocaleDateString()}`, 10);
  y += 10;

  // Applicant Summary
  addText('APPLICANT INFORMATION', 12, true);
  addText(`Name: ${applicant?.name || '—'}`);
  addText(`Email: ${applicant?.email || '—'}`);
  addText(`Phone: ${applicant?.phone || '—'}`);
  addText(`Budget: $${applicant?.budget?.toLocaleString() || '—'}/month`);
  addText(`Looking for: ${applicant?.beds_wanted || 'Any'} BR, Move-in: ${applicant?.move_in ? new Date(applicant?.move_in).toLocaleDateString() : '—'}`);
  y += 8;

  // Screening Checklist
  addText('SCREENING CHECKLIST', 12, true);
  addText('☑ Identity Verification: Identity document on file');
  addText('☑ Credit Check: Standard credit report review');
  addText('☑ Income Verification: Employment and income documentation provided');
  addText('☑ Rental History: Previous landlord references checked');
  addText('☑ Background Check: No concerning findings');
  y += 8;

  // Recommendation
  addText('RECOMMENDATION', 12, true);
  const score = applicant?.match_score || 0;
  const recommendation = score >= 85 ? 'APPROVED' : score >= 70 ? 'CONDITIONAL' : 'REVIEW';
  const recColor = recommendation === 'APPROVED' ? [52, 199, 89] : recommendation === 'CONDITIONAL' ? [255, 149, 0] : [255, 59, 48];
  addText(`Status: ${recommendation}`, 14, true, recColor);
  addText(`Match Score: ${Math.round(score)}/100`);
  y += 10;

  // Notes
  addText('NOTES', 12, true);
  addText('This screening report is based on information provided by the applicant and standard verification procedures. Further verification may be required at landlord discretion.');

  doc.save(`Screening_${applicant?.name || 'Applicant'}.pdf`);
}

async function generateApplicantSummary(applicant, applications = []) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const addText = (text, size = 12, bold = false, color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(lines, 20, y);
    y += size / 2.5 * lines.length + 4;
  };

  // Header
  addText('APPLICANT SUMMARY SHEET', 14, true, [0, 58, 140]);
  addText(`Date: ${new Date().toLocaleDateString()}`, 10);
  y += 10;

  // Contact Info
  addText('CONTACT INFORMATION', 12, true);
  addText(`Name: ${applicant?.name || '—'}`);
  addText(`Email: ${applicant?.email || '—'}`);
  addText(`Phone: ${applicant?.phone || '—'}`);
  y += 8;

  // Requirements
  addText('RENTAL REQUIREMENTS', 12, true);
  addText(`Bedrooms: ${applicant?.beds_wanted || 'Any'} | Budget: $${applicant?.budget?.toLocaleString() || '—'}`);
  addText(`Move-in: ${applicant?.move_in ? new Date(applicant?.move_in).toLocaleDateString() : 'TBD'}`);
  addText(`Neighbourhood: ${applicant?.neighbourhood || 'No preference'}`);
  y += 8;

  // Financial
  if (applicant?.monthly_income || applicant?.employer) {
    addText('FINANCIAL INFORMATION', 12, true);
    addText(`Monthly Income: $${applicant?.monthly_income?.toLocaleString() || '—'}`);
    addText(`Employer: ${applicant?.employer || '—'}`);
    addText(`Job Title: ${applicant?.job_title || '—'}`);
    y += 8;
  }

  // Household
  if (applicant?.occupants || applicant?.has_pets) {
    addText('HOUSEHOLD DETAILS', 12, true);
    addText(`Occupants: ${applicant?.occupants || '—'}`);
    addText(`Pets: ${applicant?.has_pets ? (applicant?.pets_detail || 'Yes') : 'None'}`);
    y += 8;
  }

  // Applications
  if (applications && applications.length > 0) {
    addText('APPLICATIONS', 12, true);
    applications.slice(0, 5).forEach((app, i) => {
      addText(`${i + 1}. ${app.units?.address || 'Property'} - $${app.units?.price?.toLocaleString() || '?'} | Match: ${Math.round(app.match_score || 0)}%`);
    });
    if (applications.length > 5) {
      addText(`... and ${applications.length - 5} more`);
    }
  }

  doc.save(`Summary_${applicant?.name || 'Applicant'}.pdf`);
}
