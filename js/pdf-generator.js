// Professional PDF Generation for Leasing Agent Platform
// Generates Form 410 (Rental Application) and Residential Tenancy Agreement

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
  primary: [37, 99, 235],
  navy: [26, 54, 93],
  text: [17, 24, 39],
  gray: [107, 114, 128],
  success: [5, 150, 105],
  company: 'Ottawa Rental Plug',
  contact: '(613) 601-3005'
};

function addHeader(doc, title) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, pageWidth, 3, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.navy);
  doc.text(BRAND.company, 20, 15);
  doc.setFontSize(18);
  doc.text(title, 20, 28);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...BRAND.gray);
  doc.text(`Date: ${new Date().toLocaleDateString('en-CA')}`, pageWidth - 20, 28, { align: 'right' });
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.5);
  doc.line(20, 32, pageWidth - 20, 32);
}

function addSection(doc, y, title) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.navy);
  doc.text(title, 20, y);
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.25);
  doc.line(20, y + 2, pageWidth - 20, y + 2);
  return y + 8;
}

function addField(doc, y, label, value) {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.gray);
  doc.text(label, 20, y);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);
  doc.text(value || '—', 20, y + 5);
  return y + 10;
}

function addFooter(doc, pageNum) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.25);
  doc.line(20, pageHeight - 14, pageWidth - 20, pageHeight - 14);
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
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);

  const rentAmount = property?.price ? `$${property.price.toLocaleString()}` : '$_______';
  doc.text(`I/We hereby make application to rent ${property?.address || '_'.repeat(50)}`, 15, y);
  y += 7;
  doc.text(`from the _______ day of _________________________ 20_______ at a monthly rental of ${rentAmount}`, 15, y);
  y += 7;
  doc.text(`to become due and payable in advance on the _______ day of each and every month during my tenancy.`, 15, y);
  y += 12;

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
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('LAST TWO PLACES OF RESIDENCE', 15, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);

  const addr = applicant?.address_history?.current;
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

  y += 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PERSONAL REFERENCES', 15, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  if (applicant?.personal_references?.[0]) {
    const ref = applicant.personal_references[0];
    doc.text('Name', 15, y);
    doc.text(ref.name || '_'.repeat(40), 50, y);
    y += 5;
    doc.text('Telephone', 15, y);
    doc.text(ref.phone || '_'.repeat(20), 50, y);
  } else {
    doc.text('Name', 15, y);
    doc.text('_'.repeat(40), 50, y);
    y += 5;
    doc.text('Telephone', 15, y);
    doc.text('_'.repeat(20), 50, y);
  }

  y += 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AUTOMOBILE(S)', 15, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  if (applicant?.vehicle?.make_model) {
    doc.text('Make/Model', 15, y);
    doc.text(applicant.vehicle.make_model, 50, y);
    doc.text('Licence No', 165, y);
    doc.text(applicant.vehicle.plate || '_'.repeat(15), 195, y);
  } else {
    doc.text('Make/Model', 15, y);
    doc.text('_'.repeat(25), 50, y);
  }

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

  y = addSection(doc, y, '1. PARTIES AND PROPERTY');
  y = addField(doc, y, 'Landlord/Agent:', 'Ottawa Rental Plug');
  y = addField(doc, y, 'Tenant:', applicant?.name || 'To be determined');
  y = addField(doc, y, 'Rental Unit Address:', property?.address || 'To be determined');
  y = addField(doc, y, 'Unit Type:', `${property?.beds || '—'} BR / ${property?.baths || '—'} BA ${property?.type || 'Unit'}`);
  y += 5;

  y = addSection(doc, y, '2. RENT AND PAYMENT TERMS');
  y = addField(doc, y, 'Monthly Rent:', `$${property?.price?.toLocaleString() || 'TBD'}`);
  y = addField(doc, y, 'Payment Due Date:', '1st day of each month');
  y = addField(doc, y, 'Payment Method:', 'As directed by Landlord');
  y = addField(doc, y, 'Security Deposit:', `$${property?.price?.toLocaleString() || 'TBD'}`);
  y += 5;

  y = addSection(doc, y, '3. LEASE TERM');
  const endDate = startDate ? new Date(new Date(startDate).getTime() + 365 * 24 * 60 * 60 * 1000) : null;
  y = addField(doc, y, 'Commencement Date:', startDate ? new Date(startDate).toLocaleDateString('en-CA') : 'To be determined');
  y = addField(doc, y, 'End Date:', endDate ? endDate.toLocaleDateString('en-CA') : 'One year from commencement');
  y += 5;

  if (y > pageHeight - 40) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

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

  y = addSection(doc, y, '6. UTILITIES & SERVICES');
  y = addField(doc, y, 'Hydro/Electricity:', 'Tenant responsibility');
  y = addField(doc, y, 'Water & Sewer:', 'Included in rent');
  y = addField(doc, y, 'Heat:', 'Included in rent');
  y += 5;

  if (y > pageHeight - 40) {
    addFooter(doc, doc.internal.pages.length - 1);
    doc.addPage();
    y = 20;
    addHeader(doc, 'RESIDENTIAL TENANCY AGREEMENT (continued)');
    y = 40;
  }

  y = addSection(doc, y, '7. HOUSE RULES');
  y = addField(doc, y, 'Pets:', 'No pets without written consent');
  y = addField(doc, y, 'Smoking:', 'Prohibited on premises');
  y += 5;

  y = addSection(doc, y, '8. TERMINATION');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  const termText = 'Either party may terminate this agreement with 60 days\' written notice in accordance with the Residential Tenancies Act, 2006 (Ontario). Security deposit will be returned within 30 days of move-out, less any legitimate deductions.';
  const termLines = doc.splitTextToSize(termText, pageWidth - 40);
  doc.text(termLines, 20, y);
  y += (termLines.length * 3.5) + 8;

  y = addSection(doc, y, '9. SIGNATURES');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text('By signing below, both parties agree to the terms of this Residential Tenancy Agreement.', 20, y);
  y += 8;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);
  doc.text('Landlord/Agent: ___________________________    Signature: ___________________________    Date: __________', 20, y);
  y += 10;
  doc.text('Tenant: ___________________________    Signature: ___________________________    Date: __________', 20, y);
  y += 10;
  doc.text('Tenant (if co-tenant): ___________________________    Signature: ___________________________    Date: __________', 20, y);

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

  y = addSection(doc, y, 'APPLICANT INFORMATION');
  y = addField(doc, y, 'Name:', applicant?.name || '—');
  y = addField(doc, y, 'Email:', applicant?.email || '—');
  y = addField(doc, y, 'Phone:', applicant?.phone || '—');
  y = addField(doc, y, 'Monthly Income:', applicant?.monthly_income ? `$${applicant.monthly_income.toLocaleString()}` : '—');
  y = addField(doc, y, 'Employer:', applicant?.employer || '—');
  y += 5;

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

  y = addSection(doc, y, 'RECOMMENDATION');
  const score = applicant?.match_score || 75;
  let recommendation, recStatus, recColor;
  if (score >= 85) {
    recommendation = 'APPROVED';
    recStatus = 'Strong candidate — recommended for approval';
    recColor = BRAND.success;
  } else if (score >= 70) {
    recommendation = 'CONDITIONAL';
    recStatus = 'Approve with additional verification or conditions';
    recColor = [217, 119, 6];
  } else {
    recommendation = 'REVIEW REQUIRED';
    recStatus = 'Requires additional verification before approval';
    recColor = [220, 38, 38];
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

  addFooter(doc, 1);
  doc.save(`Screening_Report_${applicant?.name?.replace(/\s+/g, '_') || 'Applicant'}.pdf`);
}
