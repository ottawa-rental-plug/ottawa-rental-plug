/**
 * Netlify Serverless Function: Form 410 PDF Generator
 * Endpoint: /.netlify/functions/generate-form-410
 * Method: POST
 *
 * Accepts JSON body with questionnaire data
 * Returns PDF as binary attachment
 */

const PDFDocument = require('pdfkit');

handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    let formData;
    try {
      formData = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON' })
      };
    }

    // Validate required fields
    if (!formData.applicants?.applicant1?.fullName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required applicant information' })
      };
    }

    // Generate PDF
    const pdf = await generateForm410PDF(formData);

    // Return PDF as binary
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Form_410_Application.pdf"'
      },
      body: pdf.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * Generate Form 410 PDF using PDFKit
 */
async function generateForm410PDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'letter',
      margin: 36
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Styling
    const teal = '#06b6d4';
    const darkGray = '#334155';
    const lightGray = '#94a3b8';

    // Header
    doc.fontSize(18).font('Helvetica-Bold').fillColor(teal);
    doc.text('OREA', { align: 'center' });
    doc.fontSize(14).text('Ontario Real Estate Association', { align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold').text('Form 410', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text('Rental Application - Residential', { align: 'center' });

    doc.moveDown(0.5);
    doc.strokeColor(teal).lineWidth(1).moveTo(36, doc.y).lineTo(558, doc.y).stroke();
    doc.moveDown(0.5);

    // Application intent
    doc.fontSize(10).fillColor(darkGray);
    doc.text(`I/We hereby make application to rent from the __________ day of __________, 20__ at a monthly rental of $__________`);

    doc.moveDown(0.3);

    // Applicant 1 Section
    sectionTitle(doc, 'APPLICANT #1');
    const app1 = data.applicants.applicant1 || {};
    doc.fontSize(9);
    doc.text(`Full Legal Name: ${app1.fullName || ''}    Date of Birth: ${app1.dateOfBirth || ''}`);
    doc.text(`Driver's License No.: ${app1.driversLicense || ''}    SIN No.: ${app1.sin || ''}`);
    doc.text(`Occupation: ${app1.occupation || ''}`);

    doc.moveDown(0.3);

    // Applicant 2 Section (if applicable)
    if (data.applicants.applicant2) {
      const app2 = data.applicants.applicant2;
      sectionTitle(doc, 'APPLICANT #2');
      doc.fontSize(9);
      doc.text(`Full Legal Name: ${app2.fullName || ''}    Date of Birth: ${app2.dateOfBirth || ''}`);
      doc.text(`Driver's License No.: ${app2.driversLicense || ''}    SIN No.: ${app2.sin || ''}`);
      doc.text(`Occupation: ${app2.occupation || ''}`);
      doc.moveDown(0.3);
    }

    // Other Occupants
    if (data.otherOccupants && data.otherOccupants.length > 0) {
      sectionTitle(doc, 'OTHER OCCUPANTS');
      data.otherOccupants.forEach(occ => {
        doc.fontSize(9);
        doc.text(`Name: ${occ.name || ''}    Relationship: ${occ.relationship || ''}    Age: ${occ.age || ''}`);
      });
      doc.moveDown(0.3);
    }

    // Rental History
    sectionTitle(doc, 'LAST TWO PLACES OF RESIDENCE');

    const current = data.rentalHistory?.current || {};
    doc.fontSize(10).font('Helvetica-Bold').fillColor(darkGray).text('Current Residence');
    doc.fontSize(9).font('Helvetica');
    doc.text(`From: ${current.moveInDate || ''}    To: ___________`);
    doc.text(`Address: ${current.address || ''}`);
    doc.text(`Landlord: ${current.landlordName || ''}    Phone: ${current.landlordPhone || ''}`);

    doc.moveDown(0.2);

    const previous = data.rentalHistory?.previous || {};
    if (previous.address) {
      doc.fontSize(10).font('Helvetica-Bold').text('Previous Residence');
      doc.fontSize(9).font('Helvetica');
      doc.text(`From: ${previous.startDate || ''}    To: ${previous.endDate || ''}`);
      doc.text(`Address: ${previous.address || ''}`);
      doc.text(`Landlord: ${previous.landlordName || ''}    Phone: ${previous.landlordPhone || ''}`);
      doc.moveDown(0.3);
    }

    // Employment
    const emp = data.employment?.applicant1?.present || {};
    sectionTitle(doc, 'PRESENT EMPLOYMENT');
    doc.fontSize(9);
    doc.text(`Employer: ${emp.employer || ''}`);
    doc.text(`Address: ${emp.address || ''}`);
    doc.text(`Phone: ${emp.phone || ''}    Position: ${emp.position || ''}`);
    doc.text(`Length of employment: ${emp.lengthOfEmployment || ''}    Supervisor: ${emp.supervisor || ''}`);
    doc.text(`Gross Monthly Income: $${emp.monthlyIncome || ''}`);

    doc.moveDown(0.3);

    // Banking
    const bank = data.banking || {};
    sectionTitle(doc, 'BANKING INFORMATION');
    doc.fontSize(9);
    doc.text(`Name of Bank: ${bank.bankName || ''}    Branch: ${bank.branch || ''}`);
    doc.text(`Address: ${bank.address || ''}`);
    doc.text(`Chequing Account #: ${bank.chequingAccount || ''}    Savings Account #: ${bank.savingsAccount || ''}`);

    doc.moveDown(0.3);

    // Financial Obligations
    const obligations = data.financialObligations?.obligations || [];
    if (obligations.length > 0) {
      sectionTitle(doc, 'FINANCIAL OBLIGATIONS');
      doc.fontSize(9);
      obligations.forEach(obj => {
        doc.text(`Payments to: ${obj.paymentTo || ''}    Amount: $${obj.amount || ''}`);
      });
      doc.moveDown(0.3);
    }

    // References
    const refs = data.personalReferences || [];
    if (refs.length > 0) {
      sectionTitle(doc, 'PERSONAL REFERENCES');
      doc.fontSize(9);
      refs.forEach(ref => {
        doc.text(`Name: ${ref.name || ''}    Address: ${ref.address || ''}`);
        doc.text(`Phone: ${ref.phone || ''}    Occupation: ${ref.occupation || ''}`);
        doc.text(`Length of Acquaintance: ${ref.acquaintanceDuration || ''}`);
        doc.moveDown(0.1);
      });
    }

    // Vehicles
    const vehicles = data.vehicles || [];
    if (vehicles.length > 0) {
      doc.moveDown(0.2);
      sectionTitle(doc, 'AUTOMOBILES');
      doc.fontSize(9);
      vehicles.forEach(v => {
        doc.text(`Make: ${v.make || ''}    Model: ${v.model || ''}    Year: ${v.year || ''}    License Plate: ${v.licensePlate || ''}`);
      });
    }

    // Declaration
    doc.addPage();
    doc.fontSize(10).font('Helvetica-Bold').fillColor(teal).text('DECLARATION');
    doc.fontSize(9).font('Helvetica').fillColor(darkGray);
    const declarationText = `The Applicant warrants that all statements made above are true and correct. The Applicant is hereby notified that consumer report information containing credit and/or personal information may be referred to in connection with this rental. The Applicant authorizes the verification of the above-noted information to be contained in this application and information obtained from personal references. This application is not a binding agreement. In the event that this application is not accepted, any deposit submitted by the Applicant shall be returned.`;

    doc.text(declarationText, { width: 522, align: 'left' });

    doc.moveDown(0.5);
    doc.fontSize(9);
    doc.text(`Signature of Applicant #1: ___________________________     Date: __________`);
    doc.moveDown(0.2);
    doc.text(`Telephone: __________________________    Email: __________________________`);

    // Footer
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor(lightGray);
    doc.text('Generated by Ottawa Rental Plug - Form 410 Application System', { align: 'center' });
    doc.text(`${new Date().toLocaleDateString('en-CA')} at ${new Date().toLocaleTimeString('en-CA')}`, { align: 'center' });

    doc.end();
  });
}

function sectionTitle(doc, text) {
  doc.moveDown(0.2);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#06b6d4').text(text);
  doc.strokeColor('#06b6d4').lineWidth(0.5).moveTo(36, doc.y - 2).lineTo(558, doc.y - 2).stroke();
  doc.moveDown(0.2);
}

module.exports = { handler };
