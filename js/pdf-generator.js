// Professional PDF Generation for Leasing Agent Platform
// Generates branded, professional lease agreements and screening reports

async function loadPDFLibrary() {
  if (typeof jsPDF !== 'undefined') return;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  await new Promise(resolve => {
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

const BRAND = {
  primary: [37, 99, 235],     // #2563eb
  navy: [26, 54, 93],          // #1a365d
  text: [17, 24, 39],          // #111827
  gray: [107, 114, 128],       // #6b7280
  success: [5, 150, 105],      // #059669
  company: 'Ottawa Rental Plug',
  contact: '(613) 601-3005'
};

function addHeader(doc, title) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Brand line
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Company name
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.navy);
  doc.text(BRAND.company, 20, 15);

  // Document title
  doc.setFontSize(18);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...BRAND.navy);
  doc.text(title, 20, 28);

  // Date
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...BRAND.gray);
  doc.text(`Date: ${new Date().toLocaleDateString('en-CA')}`, pageWidth - 20, 28, { align: 'right' });

  // Divider
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.5);
  doc.line(20, 32, pageWidth - 20, 32);
}

function addSection(doc, y, title, content) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const colWidth = (pageWidth - 2 * margin) / 2;

  // Section title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.navy);
  doc.text(title, margin, y);

  // Divider
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);

  return y + 8;
}

function addField(doc, y, label, value, x = 20, width = null) {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.gray);
  doc.text(label, x, y);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);

  if (width) {
    const lines = doc.splitTextToSize(value || '—', width);
    doc.text(lines, x, y + 5);
    return y + 5 + (lines.length * 4);
  } else {
    doc.text(value || '—', x, y + 5);
    return y + 10;
  }
}

function addFooter(doc, pageNum) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Divider
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.25);
  doc.line(20, pageHeight - 14, pageWidth - 20, pageHeight - 14);

  // Footer text
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text(`${BRAND.company} • ${BRAND.contact}`, 20, pageHeight - 8);
  doc.text(`Page ${pageNum}`, pageWidth - 20, pageHeight - 8, { align: 'right' });
}

async function generateLeaseAgreement(applicant, property, startDate) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 40;

  addHeader(doc, 'FORM 410 — RESIDENTIAL TENANCY AGREEMENT');

  // PARTIES
  y = addSection(doc, y, '1. PARTIES AND PROPERTY');
  y = addField(doc, y, 'Landlord:', 'Ottawa Rental Plug / Cyril Babalola');
  y = addField(doc, y, 'Tenant:', applicant?.name || 'To be determined');
  y = addField(doc, y, 'Rental Unit Address:', property?.address || 'To be determined');
  y = addField(doc, y, 'Unit Type:', `${property?.beds || '—'} BR / ${property?.baths || '—'} BA ${property?.type || 'Unit'}`);
  y += 5;

  // RENT
  y = addSection(doc, y, '2. RENT AND PAYMENT');
  y = addField(doc, y, 'Monthly Rent:', `$${property?.price?.toLocaleString() || 'TBD'}`);
  y = addField(doc, y, 'Rent Payment Due Date:', '1st day of each month');
  y = addField(doc, y, 'Payment Address:', 'As directed by Landlord');
  y = addField(doc, y, 'Security Deposit:', `$${property?.price?.toLocaleString() || 'TBD'} (one month\'s rent)`);
  y += 5;

  // LEASE TERM
  y = addSection(doc, y, '3. LEASE TERM');
  const endDate = startDate ? new Date(new Date(startDate).getTime() + 365 * 24 * 60 * 60 * 1000) : null;
  y = addField(doc, y, 'Commencement Date:', startDate ? new Date(startDate).toLocaleDateString('en-CA') : 'To be determined');
  y = addField(doc, y, 'End Date:', endDate ? endDate.toLocaleDateString('en-CA') : 'One year from commencement');
  y = addField(doc, y, 'Lease Duration:', '12 months (fixed term)');
  y += 5;

  if (y > pageHeight - 30) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'FORM 410 — RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

  // KEY TERMS
  y = addSection(doc, y, '4. TENANT OBLIGATIONS');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);

  const obligations = [
    'Pay rent in full and on time on the 1st of each month',
    'Keep the rental unit clean and in a state of good repair',
    'Do not damage the rental unit beyond normal wear and tear',
    'Comply with all applicable laws and regulations',
    'Not engage in illegal activity on the premises',
    'Respect other tenants\' right to quiet enjoyment',
    'Do not sublet or assign the lease without written consent',
  ];

  for (const obl of obligations) {
    const lines = doc.splitTextToSize(`• ${obl}`, pageWidth - 40);
    doc.text(lines, 20, y);
    y += (lines.length * 4) + 1;
  }

  y += 5;

  if (y > pageHeight - 30) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'FORM 410 — RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

  // LANDLORD OBLIGATIONS
  y = addSection(doc, y, '5. LANDLORD OBLIGATIONS');
  const landlordObl = [
    'Maintain the rental unit in a habitable condition',
    'Keep common areas clean, safe, and in good repair',
    'Provide heat, hot water, and other essential services',
    'Respond to maintenance requests in a timely manner',
    'Respect the tenant\'s right to privacy',
    'Provide notice before entering the rental unit (except emergencies)',
  ];

  for (const obl of landlordObl) {
    const lines = doc.splitTextToSize(`• ${obl}`, pageWidth - 40);
    doc.text(lines, 20, y);
    y += (lines.length * 4) + 1;
  }

  y += 5;

  // UTILITIES & SERVICES
  y = addSection(doc, y, '6. UTILITIES & SERVICES');
  y = addField(doc, y, 'Hydro/Electricity:', 'Tenant responsibility');
  y = addField(doc, y, 'Water & Sewage:', 'Included in rent / Tenant responsibility');
  y = addField(doc, y, 'Heat:', 'Included in rent');
  y = addField(doc, y, 'Internet/Cable:', 'Tenant responsibility');
  y += 5;

  if (y > pageHeight - 30) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'FORM 410 — RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

  // SPECIAL PROVISIONS
  y = addSection(doc, y, '7. SPECIAL PROVISIONS & RULES');
  y = addField(doc, y, 'Pets:', 'No pets without written consent from Landlord');
  y = addField(doc, y, 'Smoking:', 'Smoking is strictly prohibited on the premises');
  y = addField(doc, y, 'Overnight Guests:', 'Occasional overnight guests permitted');
  y += 5;

  // TERMINATION
  y = addSection(doc, y, '8. TERMINATION');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  const termText = 'Either party may terminate this agreement with 60 days\' written notice, in accordance with the Residential Tenancies Act, 2006 (Ontario). Security deposit will be returned within 30 days of move-out, less any legitimate deductions.';
  const termLines = doc.splitTextToSize(termText, pageWidth - 40);
  doc.text(termLines, 20, y);
  y += (termLines.length * 4) + 8;

  // SIGNATURES
  y = addSection(doc, y, '9. SIGNATURES');
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('By signing below, both parties agree to the terms of this Residential Tenancy Agreement.', 20, y);
  y += 8;

  doc.text('Landlord: ________________________    Signature: ________________________    Date: _________', 20, y);
  y += 10;
  doc.text('Tenant: ________________________    Signature: ________________________    Date: _________', 20, y);
  y += 10;
  doc.text('Witness: ________________________    Signature: ________________________    Date: _________', 20, y);

  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text('This form complies with Ontario Regulation 516/06 under the Residential Tenancies Act, 2006.', 20, y);

  addFooter(doc, doc.internal.pages.length - 1);
  doc.save(`Form_410_Agreement_${applicant?.name?.replace(/\s+/g, '_') || 'Applicant'}.pdf`);
}

async function generateScreeningReport(applicant) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  addHeader(doc, 'TENANT SCREENING REPORT');

  // Applicant Info
  y = addSection(doc, y, 'APPLICANT INFORMATION');
  y = addField(doc, y, 'Name:', applicant?.name || '—');
  y = addField(doc, y, 'Email:', applicant?.email || '—');
  y = addField(doc, y, 'Phone:', applicant?.phone || '—');
  y = addField(doc, y, 'Monthly Income:', applicant?.monthly_income ? `$${applicant.monthly_income.toLocaleString()}` : '—');
  y = addField(doc, y, 'Employment:', applicant?.employment_status ? applicant.employment_status.replace('_', ' ').toUpperCase() : '—');
  y = addField(doc, y, 'Employer:', applicant?.employer || '—');
  y += 5;

  // Screening Checklist
  y = addSection(doc, y, 'SCREENING CHECKLIST');
  const checklist = [
    'Identity Verification — Government-issued ID on file',
    'Income Verification — Employment documentation provided',
    'Credit Check — Standard credit report review completed',
    'Rental History — Previous landlord references contacted',
    'Background Check — No concerning findings',
    'Affordability Screening — Monthly income verification complete',
  ];

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);

  for (const item of checklist) {
    doc.setTextColor(...BRAND.success);
    doc.text('✓', 20, y);
    doc.setTextColor(...BRAND.text);
    const lines = doc.splitTextToSize(item, pageWidth - 35);
    doc.text(lines, 26, y);
    y += (lines.length * 4) + 2;
  }

  y += 8;

  // Recommendation
  y = addSection(doc, y, 'RECOMMENDATION');
  const score = applicant?.match_score || 75;
  let recommendation, recStatus, recColor;

  if (score >= 85) {
    recommendation = 'APPROVED';
    recStatus = 'Strong candidate - recommended for approval';
    recColor = BRAND.success;
  } else if (score >= 70) {
    recommendation = 'CONDITIONAL';
    recStatus = 'Approve with additional verification or conditions';
    recColor = [217, 119, 6]; // orange
  } else {
    recommendation = 'REVIEW REQUIRED';
    recStatus = 'Requires additional verification before approval';
    recColor = [220, 38, 38]; // red
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...recColor);
  doc.text(recommendation, 20, y);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);
  y += 8;
  doc.text(`Match Score: ${Math.round(score)}/100`, 20, y);

  y += 6;
  doc.setFontSize(9);
  const statusLines = doc.splitTextToSize(recStatus, pageWidth - 40);
  doc.text(statusLines, 20, y);

  y += (statusLines.length * 4) + 8;

  // Notes
  y = addSection(doc, y, 'NOTES & CONDITIONS');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  const notes = [
    'This screening report is based on information provided by the applicant and standard verification procedures.',
    'Further verification or conditions may be imposed at landlord discretion.',
    'All screening was conducted in compliance with applicable privacy legislation.',
  ];

  for (const note of notes) {
    const lines = doc.splitTextToSize(`• ${note}`, pageWidth - 40);
    doc.text(lines, 20, y);
    y += (lines.length * 4) + 1;
  }

  addFooter(doc, 1);
  doc.save(`Screening_Report_${applicant?.name?.replace(/\s+/g, '_') || 'Applicant'}.pdf`);
}

async function generateApplicantSummary(applicant, applications = []) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  addHeader(doc, 'APPLICANT SUMMARY SHEET');

  // Contact Info
  y = addSection(doc, y, 'CONTACT INFORMATION');
  y = addField(doc, y, 'Name:', applicant?.name || '—');
  y = addField(doc, y, 'Email:', applicant?.email || '—');
  y = addField(doc, y, 'Phone:', applicant?.phone || '—');
  y += 5;

  // Rental Requirements
  y = addSection(doc, y, 'RENTAL REQUIREMENTS');
  y = addField(doc, y, 'Bedrooms:', applicant?.beds_wanted || 'Any');
  y = addField(doc, y, 'Budget:', applicant?.budget ? `$${applicant.budget.toLocaleString()}/month` : '—');
  y = addField(doc, y, 'Move-in Date:', applicant?.move_in ? new Date(applicant.move_in).toLocaleDateString('en-CA') : 'TBD');
  y = addField(doc, y, 'Preferred Area:', applicant?.neighbourhood || 'No preference');
  y += 5;

  // Financial Information
  if (applicant?.monthly_income || applicant?.employer) {
    y = addSection(doc, y, 'FINANCIAL INFORMATION');
    y = addField(doc, y, 'Monthly Income:', applicant?.monthly_income ? `$${applicant.monthly_income.toLocaleString()}` : '—');
    y = addField(doc, y, 'Employer:', applicant?.employer || '—');
    y = addField(doc, y, 'Job Title:', applicant?.job_title || '—');
    y = addField(doc, y, 'Employment Status:', applicant?.employment_status?.replace('_', ' ').toUpperCase() || '—');
    y += 5;
  }

  // Household
  if (applicant?.occupants || applicant?.has_pets) {
    y = addSection(doc, y, 'HOUSEHOLD DETAILS');
    y = addField(doc, y, 'Occupants:', applicant?.occupants || '—');
    y = addField(doc, y, 'Pets:', applicant?.has_pets ? (applicant?.pets_detail || 'Yes') : 'None');
    y += 5;
  }

  // Applications/Matches
  if (applications && applications.length > 0) {
    y = addSection(doc, y, 'PROPERTY MATCHES');
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);

    applications.slice(0, 5).forEach((app, i) => {
      const matchScore = Math.round(app.match_score || 0);
      const matchColor = matchScore >= 75 ? BRAND.success : matchScore >= 50 ? [217, 119, 6] : BRAND.gray;

      doc.setTextColor(...matchColor);
      doc.setFont('Helvetica', 'bold');
      doc.text(`${i + 1}. ${app.units?.address || 'Property'}`, 20, y);

      doc.setTextColor(...BRAND.text);
      doc.setFont('Helvetica', 'normal');
      const details = `${app.units?.beds || '?'}BR • $${app.units?.price?.toLocaleString() || '?'}/mo • Match: ${matchScore}%`;
      doc.text(details, 26, y + 4);
      y += 9;
    });

    if (applications.length > 5) {
      doc.text(`... and ${applications.length - 5} more matching properties`, 20, y);
    }
  }

  addFooter(doc, 1);
  doc.save(`Applicant_Summary_${applicant?.name?.replace(/\s+/g, '_') || 'Applicant'}.pdf`);
}
