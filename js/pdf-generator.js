// Professional PDF Generation for Leasing Agent Platform
// Generates Form 410 (Rental Application) and lease agreements

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

async function generateForm410(applicant, property, startDate) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  // OREA Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.navy);
  doc.text('OREA Ontario Real Estate Association', 15, y);
  doc.setFontSize(14);
  doc.text('Rental Application', 15, y + 8);
  doc.setFontSize(10);
  doc.text('Residential Form 410', 15, y + 15);
  doc.text('for use in the Province of Ontario', 15, y + 20);

  y = 40;

  // Header section
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);

  const rentAmount = property?.price ? `$${property.price.toLocaleString()}` : '$_______';
  const moveInDate = startDate ? new Date(startDate).toLocaleDateString('en-CA', {year: 'numeric', month: 'long', day: 'numeric'}) : 'TBD';
  const day = startDate ? new Date(startDate).getDate() : '___';

  doc.text(`I/We hereby make application to rent ${property?.address || '_'.repeat(50)}`, 15, y);
  y += 7;
  doc.text(`from the _______ day of _________________________ 20_______ at a monthly rental of ${rentAmount}`, 15, y);
  y += 7;
  doc.text(`to become due and payable in advance on the _______ day of each and every month during my tenancy.`, 15, y);
  y += 12;

  // APPLICANT 1
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. Name', 15, y);
  doc.setFont('Helvetica', 'normal');
  doc.text(applicant?.name || '_'.repeat(40), 35, y);
  doc.setFont('Helvetica', 'bold');
  doc.text('Date of birth', 110, y);
  doc.setFont('Helvetica', 'normal');
  doc.text('_____/_____/_____', 140, y);
  doc.setFont('Helvetica', 'bold');
  doc.text('SIN No.', 170, y);
  doc.setFont('Helvetica', 'normal');
  doc.text('(Optional)', 185, y);

  y += 6;
  doc.setFont('Helvetica', 'bold');
  doc.text('Drivers License No', 15, y);
  doc.setFont('Helvetica', 'normal');
  doc.text('_'.repeat(20), 50, y);
  doc.setFont('Helvetica', 'bold');
  doc.text('Occupation', 110, y);
  doc.setFont('Helvetica', 'normal');
  doc.text(applicant?.job_title || '_'.repeat(30), 140, y);

  y += 10;

  // LAST TWO PLACES OF RESIDENCE
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('LAST TWO PLACES OF RESIDENCE', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);

  const addr = applicant?.address_history?.current;
  const prevAddr = applicant?.address_history?.previous;

  // Current address
  doc.text('Address', 15, y);
  doc.text(addr?.address ? `${addr.address}, ${addr.city}, ${addr.postal}` : '_'.repeat(50), 35, y);

  y += 6;
  doc.text('From', 15, y);
  doc.text(addr?.time_there || '________', 35, y);
  doc.text('To', 80, y);
  doc.text('Present', 95, y);

  y += 6;
  doc.text('Name of Landlord', 15, y);
  doc.text(addr?.landlord_name || '_'.repeat(40), 50, y);

  y += 6;
  doc.text('Telephone', 15, y);
  doc.text(addr?.landlord_phone || '_'.repeat(20), 50, y);

  y += 10;

  // EMPLOYMENT
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PRESENT EMPLOYMENT', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Employer', 15, y);
  doc.text(applicant?.employer || '_'.repeat(40), 50, y);

  y += 5;
  doc.text('Business address', 15, y);
  doc.text('_'.repeat(50), 50, y);

  y += 5;
  doc.text('Position held', 15, y);
  doc.text(applicant?.job_title || '_'.repeat(40), 50, y);

  y += 5;
  doc.text('Length of employment', 15, y);
  doc.text(applicant?.employment_length || '_'.repeat(30), 50, y);

  y += 5;
  doc.text('Current salary range: Monthly $', 15, y);
  doc.text(applicant?.monthly_income ? `${applicant.monthly_income.toLocaleString()}` : '________', 80, y);

  // BANK INFORMATION
  y += 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FINANCIAL INFORMATION', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Name of Bank', 15, y);
  doc.text('_'.repeat(30), 50, y);
  doc.text('Branch', 110, y);
  doc.text('_'.repeat(20), 140, y);

  // PERSONAL REFERENCES
  y += 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PERSONAL REFERENCES', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);

  if (applicant?.personal_references && applicant.personal_references.length > 0) {
    const ref = applicant.personal_references[0];
    doc.text('Name', 15, y);
    doc.text(ref?.name || '_'.repeat(40), 50, y);
    y += 5;
    doc.text('Telephone', 15, y);
    doc.text(ref?.phone || '_'.repeat(20), 50, y);
    y += 5;
    doc.text('Occupation', 15, y);
    doc.text('_'.repeat(30), 50, y);
  } else {
    doc.text('Name', 15, y);
    doc.text('_'.repeat(40), 50, y);
    y += 5;
    doc.text('Telephone', 15, y);
    doc.text('_'.repeat(20), 50, y);
  }

  // AUTOMOBILES
  y += 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AUTOMOBILE(S)', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);

  if (applicant?.vehicle) {
    doc.text('Make/Model', 15, y);
    doc.text(applicant.vehicle.make_model || '_'.repeat(25), 50, y);
    doc.text('Year', 110, y);
    doc.text('_______', 140, y);
    doc.text('Licence No', 165, y);
    doc.text(applicant.vehicle.plate || '_'.repeat(15), 195, y);
  } else {
    doc.text('Make/Model', 15, y);
    doc.text('_'.repeat(25), 50, y);
    doc.text('Year', 110, y);
    doc.text('_______', 140, y);
  }

  // SIGNATURE & CONSENT
  y += 15;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);

  const consentText = 'The Applicant represents that all statements made above are true and correct. The Applicant is hereby notified that a consumer report containing credit and/or personal information may be referred to in connection with this rental.';
  const consentLines = doc.splitTextToSize(consentText, pageWidth - 30);
  doc.text(consentLines, 15, y);

  y += (consentLines.length * 3) + 8;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);
  doc.text('Signature of Applicant', 15, y);
  doc.line(15, y + 2, 60, y + 2);
  doc.text('Date', 75, y);
  doc.line(75, y + 2, 100, y + 2);

  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text('Form 410 — Revised 2019', pageWidth - 30, pageHeight - 5);

  doc.save(`Form_410_Application_${applicant?.name?.replace(/\s+/g, '_') || 'Applicant'}.pdf`);
}

async function generateLeaseAgreement(applicant, property, startDate) {
  await loadPDFLibrary();
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 40;

  addHeader(doc, 'RESIDENTIAL TENANCY AGREEMENT');

  // PARTIES
  y = addSection(doc, y, '1. PARTIES AND PROPERTY');
  y = addField(doc, y, 'Landlord/Agent:', 'Ottawa Rental Plug');
  y = addField(doc, y, 'Tenant:', applicant?.name || 'To be determined');
  y = addField(doc, y, 'Rental Unit Address:', property?.address || 'To be determined');
  y = addField(doc, y, 'Unit Type:', `${property?.beds || '—'} BR / ${property?.baths || '—'} BA ${property?.type || 'Unit'}`);
  y += 5;

  // RENT & PAYMENT
  y = addSection(doc, y, '2. RENT AND PAYMENT TERMS');
  y = addField(doc, y, 'Monthly Rent:', `$${property?.price?.toLocaleString() || 'TBD'}`);
  y = addField(doc, y, 'Payment Due Date:', '1st day of each month');
  y = addField(doc, y, 'Payment Method:', 'As directed by Landlord');
  y = addField(doc, y, 'Security Deposit:', `$${property?.price?.toLocaleString() || 'TBD'}`);
  y = addField(doc, y, 'Last Month\'s Rent Deposit:', `$${property?.price?.toLocaleString() || 'TBD'}`);
  y += 5;

  // LEASE TERM
  y = addSection(doc, y, '3. LEASE TERM');
  const endDate = startDate ? new Date(new Date(startDate).getTime() + 365 * 24 * 60 * 60 * 1000) : null;
  y = addField(doc, y, 'Commencement Date:', startDate ? new Date(startDate).toLocaleDateString('en-CA') : 'To be determined');
  y = addField(doc, y, 'End Date:', endDate ? endDate.toLocaleDateString('en-CA') : 'One year from commencement');
  y = addField(doc, y, 'Lease Type:', 'Fixed term — 12 months');
  y += 5;

  if (y > pageHeight - 40) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

  // TENANT OBLIGATIONS
  y = addSection(doc, y, '4. TENANT OBLIGATIONS');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);

  const obligations = [
    'Pay rent in full and on time each month',
    'Keep the rental unit clean and in good repair',
    'Not damage the unit beyond normal wear and tear',
    'Comply with all applicable laws and regulations',
    'Do not engage in illegal activity on the premises',
    'Respect neighbors\' right to quiet enjoyment',
    'Permit landlord access for maintenance (24 hours notice)',
    'Do not sublet or assign without written consent',
  ];

  for (const obl of obligations) {
    const lines = doc.splitTextToSize(`• ${obl}`, pageWidth - 40);
    doc.text(lines, 20, y);
    y += (lines.length * 3.5) + 1;
  }

  y += 5;

  if (y > pageHeight - 40) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

  // LANDLORD OBLIGATIONS
  y = addSection(doc, y, '5. LANDLORD OBLIGATIONS');
  const landlordObl = [
    'Maintain the rental unit in safe, habitable condition',
    'Keep common areas clean and in good repair',
    'Provide and maintain heat, hot water, and utilities as agreed',
    'Respond to maintenance requests within 24 hours',
    'Respect tenant\'s right to privacy and quiet enjoyment',
    'Provide written notice before entering (except emergency)',
  ];

  for (const obl of landlordObl) {
    const lines = doc.splitTextToSize(`• ${obl}`, pageWidth - 40);
    doc.text(lines, 20, y);
    y += (lines.length * 3.5) + 1;
  }

  y += 5;

  // UTILITIES
  y = addSection(doc, y, '6. UTILITIES & SERVICES');
  y = addField(doc, y, 'Hydro/Electricity:', 'Tenant responsibility');
  y = addField(doc, y, 'Water & Sewer:', 'Included in rent');
  y = addField(doc, y, 'Heat:', 'Included in rent');
  y = addField(doc, y, 'Gas:', 'Tenant responsibility (if applicable)');
  y = addField(doc, y, 'Internet/Cable:', 'Tenant responsibility');
  y += 5;

  // HOUSE RULES
  y = addSection(doc, y, '7. HOUSE RULES & CONDITIONS');
  y = addField(doc, y, 'Pets:', 'No pets without written consent');
  y = addField(doc, y, 'Smoking:', 'Prohibited on premises');
  y = addField(doc, y, 'Guests:', 'Occasional overnight guests permitted');
  y = addField(doc, y, 'Noise:', 'Quiet hours 10 PM - 8 AM');
  y += 5;

  if (y > pageHeight - 40) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

  // TERMINATION
  y = addSection(doc, y, '8. TERMINATION & RENEWAL');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  const termText = 'Either party may terminate this agreement with 60 days\' written notice in accordance with the Residential Tenancies Act, 2006 (Ontario). Security deposit and last month\'s rent will be returned within 30 days of move-out, less any legitimate deductions for damages or unpaid rent.';
  const termLines = doc.splitTextToSize(termText, pageWidth - 40);
  doc.text(termLines, 20, y);
  y += (termLines.length * 3.5) + 8;

  // SIGNATURES
  y = addSection(doc, y, '9. SIGNATURES');
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text('By signing below, both parties agree to the terms of this Residential Tenancy Agreement and confirm they have read and understood all provisions.', 20, y);
  y += 8;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);
  doc.text('Landlord/Agent: ___________________________    Signature: ___________________________    Date: __________', 20, y);
  y += 10;
  doc.text('Tenant: ___________________________    Signature: ___________________________    Date: __________', 20, y);
  y += 10;
  doc.text('Tenant (if co-tenant): ___________________________    Signature: ___________________________    Date: __________', 20, y);

  y += 12;
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text('This agreement is prepared in compliance with the Residential Tenancies Act, 2006 (Ontario).', 20, y);
  doc.text('For more information, visit: www.ontario.ca/landlordandtenant', 20, y + 4);

  addFooter(doc, doc.internal.pages.length - 1);
  doc.save(`Residential_Tenancy_Agreement_${applicant?.name?.replace(/\s+/g, '_') || 'Applicant'}.pdf`);
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
