"""
Form 410 PDF Generator - Ontario Residential Tenancy Application
Generates filled Form 410 from questionnaire data
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime
import json
import os


class Form410Generator:
    def __init__(self, data):
        """
        Initialize with questionnaire data
        data: dict with structure matching the questionnaire output
        """
        self.data = data
        self.page_width = letter[0]
        self.page_height = letter[1]
        self.left_margin = 0.5 * inch
        self.right_margin = 0.5 * inch
        self.top_margin = 0.5 * inch
        self.styles = getSampleStyleSheet()

    def format_phone(self, phone):
        """Format phone number"""
        if not phone:
            return ""
        digits = ''.join(c for c in phone if c.isdigit())
        if len(digits) == 10:
            return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        return phone

    def format_date(self, date_str):
        """Format date to DD/MM/YYYY if not already formatted"""
        if not date_str:
            return ""
        if isinstance(date_str, str):
            if "/" in date_str or "-" in date_str:
                return date_str
        return date_str

    def generate(self, output_path):
        """Generate the Form 410 PDF"""
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=self.right_margin,
            leftMargin=self.left_margin,
            topMargin=self.top_margin,
            bottomMargin=0.5 * inch
        )

        story = []

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=14,
            textColor=colors.HexColor('#000000'),
            spaceAfter=6,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )

        section_style = ParagraphStyle(
            'SectionTitle',
            parent=self.styles['Heading2'],
            fontSize=11,
            textColor=colors.HexColor('#000000'),
            spaceAfter=4,
            spaceBefore=8,
            fontName='Helvetica-Bold'
        )

        label_style = ParagraphStyle(
            'Label',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#000000'),
            spaceAfter=2,
            fontName='Helvetica'
        )

        normal_style = ParagraphStyle(
            'Normal9',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#000000'),
            spaceAfter=2,
            fontName='Helvetica'
        )

        # Header
        story.append(Paragraph("OREA", title_style))
        story.append(Paragraph("Ontario Real Estate Association", title_style))
        story.append(Paragraph("Form 410", title_style))
        story.append(Paragraph("Rental Application - Residential", title_style))
        story.append(Spacer(1, 0.15 * inch))

        # Statement of intent
        intent_date = self.data.get('applicationDate', datetime.now().strftime('%d/%m/%Y'))
        intent_text = f"I/We hereby make application to rent from the __________ day of __________, 20__ at a monthly rental of $"
        story.append(Paragraph(intent_text, normal_style))
        story.append(Spacer(1, 0.1 * inch))

        # Applicant sections
        story.extend(self._build_applicant_section(1))
        if self.data.get('applicants', {}).get('applicant2'):
            story.extend(self._build_applicant_section(2))

        # Other occupants
        story.extend(self._build_other_occupants_section())

        # Last two places of residence
        story.extend(self._build_residence_history())

        # Present employment
        story.extend(self._build_employment_section('present'))

        # Previous employment (if applicable)
        if self.data.get('employment', {}).get('applicant1', {}).get('previousEmployer'):
            story.extend(self._build_employment_section('previous'))

        # Bank information
        story.extend(self._build_banking_section())

        # Financial obligations
        story.extend(self._build_financial_section())

        # Personal references
        story.extend(self._build_references_section())

        # Automobiles
        story.extend(self._build_automobiles_section())

        # Declaration
        story.append(PageBreak())
        story.extend(self._build_declaration_section())

        # Build PDF
        doc.build(story)
        return output_path

    def _build_applicant_section(self, applicant_num):
        """Build applicant information section"""
        elements = []
        app_key = f'applicant{applicant_num}'
        app_data = self.data.get('applicants', {}).get(app_key, {})

        elements.append(Paragraph(f"APPLICANT #{applicant_num}", self.styles['Heading2']))

        # Applicant info table
        table_data = [
            [f"Full Legal Name: {app_data.get('fullName', '')}", "Date of Birth: ", ""],
            [f"Driver's License No.: {app_data.get('driversLicense', '')}", f"SIN No. (if available): {app_data.get('sin', '')}", ""],
            [f"Occupation: {app_data.get('occupation', '')}", "", ""]
        ]

        elements.append(Table(table_data, colWidths=[3*inch, 2*inch, 1.5*inch]))
        elements.append(Spacer(1, 0.1*inch))

        return elements

    def _build_other_occupants_section(self):
        """Build other occupants section"""
        elements = []
        occupants = self.data.get('otherOccupants', [])

        if occupants:
            elements.append(Paragraph("OTHER OCCUPANTS", self.styles['Heading2']))

            for occ in occupants:
                table_data = [
                    [f"Name: {occ.get('name', '')}", f"Relationship: {occ.get('relationship', '')}", f"Age: {occ.get('age', '')}"]
                ]
                elements.append(Table(table_data))
                elements.append(Spacer(1, 0.05*inch))

        return elements

    def _build_residence_history(self):
        """Build last two places of residence"""
        elements = []
        residences = self.data.get('rentalHistory', {})

        elements.append(Paragraph("LAST TWO PLACES OF RESIDENCE", self.styles['Heading2']))

        # Current residence
        current = residences.get('current', {})
        elements.append(Paragraph("<b>Current Residence</b>", self.styles['Normal']))
        elements.append(Paragraph(f"From: {current.get('moveInDate', '')} To: ", self.styles['Normal']))
        elements.append(Paragraph(f"Address: {current.get('address', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Landlord: {current.get('landlordName', '')} Phone: {self.format_phone(current.get('landlordPhone', ''))}", self.styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))

        # Previous residence
        previous = residences.get('previous', {})
        elements.append(Paragraph("<b>Previous Residence</b>", self.styles['Normal']))
        elements.append(Paragraph(f"From: {previous.get('startDate', '')} To: {previous.get('endDate', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Address: {previous.get('address', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Landlord: {previous.get('landlordName', '')} Phone: {self.format_phone(previous.get('landlordPhone', ''))}", self.styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))

        return elements

    def _build_employment_section(self, employment_type):
        """Build employment section (present or previous)"""
        elements = []
        employment = self.data.get('employment', {}).get('applicant1', {})

        emp_label = "PRESENT EMPLOYMENT" if employment_type == 'present' else "PREVIOUS EMPLOYMENT"
        elements.append(Paragraph(emp_label, self.styles['Heading2']))

        if employment_type == 'present':
            emp_data = employment.get('present', {})
        else:
            emp_data = employment.get('previous', {})

        elements.append(Paragraph(f"Employer: {emp_data.get('employer', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Address: {emp_data.get('address', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Phone: {self.format_phone(emp_data.get('phone', ''))} Position: {emp_data.get('position', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Length of employment: {emp_data.get('lengthOfEmployment', '')} Supervisor: {emp_data.get('supervisor', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Gross Monthly Income: ${emp_data.get('monthlyIncome', '')}", self.styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))

        return elements

    def _build_banking_section(self):
        """Build banking information section"""
        elements = []
        banking = self.data.get('banking', {})

        elements.append(Paragraph("BANKING INFORMATION", self.styles['Heading2']))
        elements.append(Paragraph(f"Name of Bank: {banking.get('bankName', '')} Branch: {banking.get('branch', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Address: {banking.get('address', '')}", self.styles['Normal']))
        elements.append(Paragraph(f"Chequing Account #: {banking.get('chequingAccount', '')} Savings Account #: {banking.get('savingsAccount', '')}", self.styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))

        return elements

    def _build_financial_section(self):
        """Build financial obligations section"""
        elements = []
        financial = self.data.get('financialObligations', {})

        elements.append(Paragraph("FINANCIAL OBLIGATIONS", self.styles['Heading2']))

        obligations = financial.get('obligations', [])
        for obligation in obligations:
            elements.append(Paragraph(f"Payments to: {obligation.get('paymentTo', '')} Amount: ${obligation.get('amount', '')}", self.styles['Normal']))

        elements.append(Spacer(1, 0.1*inch))

        return elements

    def _build_references_section(self):
        """Build personal references section"""
        elements = []
        references = self.data.get('personalReferences', [])

        elements.append(Paragraph("PERSONAL REFERENCES", self.styles['Heading2']))

        for ref in references:
            elements.append(Paragraph(f"Name: {ref.get('name', '')} Address: {ref.get('address', '')}", self.styles['Normal']))
            elements.append(Paragraph(f"Phone: {self.format_phone(ref.get('phone', ''))} Length of Acquaintance: {ref.get('acquaintanceDuration', '')} Occupation: {ref.get('occupation', '')}", self.styles['Normal']))
            elements.append(Spacer(1, 0.05*inch))

        return elements

    def _build_automobiles_section(self):
        """Build automobiles section"""
        elements = []
        vehicles = self.data.get('vehicles', [])

        if vehicles:
            elements.append(Paragraph("AUTOMOBILES", self.styles['Heading2']))

            for vehicle in vehicles:
                elements.append(Paragraph(f"Make: {vehicle.get('make', '')} Model: {vehicle.get('model', '')} Year: {vehicle.get('year', '')} License Plate: {vehicle.get('licensePlate', '')}", self.styles['Normal']))
                elements.append(Spacer(1, 0.05*inch))

        return elements

    def _build_declaration_section(self):
        """Build declaration section"""
        elements = []

        elements.append(Paragraph("DECLARATION", self.styles['Heading2']))

        declaration_text = """
        The Applicant warrants that all statements made above are true and correct. The Applicant is hereby notified that consumer
        report information containing credit and/or personal information may be referred to in connection with this rental.
        The Applicant authorizes the verification of the above-noted information to be contained in this application and information obtained
        from personal references. This application is not a binding agreement. In the event that this application is not accepted, any deposit
        submitted by the Applicant shall be returned.
        """

        elements.append(Paragraph(declaration_text, self.styles['Normal']))
        elements.append(Spacer(1, 0.2*inch))

        # Signature lines
        elements.append(Paragraph(f"Signature of Applicant #1: _____________________________ Date: _______", self.styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))
        elements.append(Paragraph(f"Telephone: _____________________________ Email: _______", self.styles['Normal']))

        return elements


def generate_form_410(questionnaire_data, output_path="form_410_filled.pdf"):
    """
    Main function to generate Form 410 PDF from questionnaire data

    Args:
        questionnaire_data: dict with applicant information
        output_path: where to save the PDF

    Returns:
        path to generated PDF
    """
    generator = Form410Generator(questionnaire_data)
    return generator.generate(output_path)


if __name__ == "__main__":
    # Example usage
    sample_data = {
        "applicationDate": "01/07/2026",
        "applicants": {
            "applicant1": {
                "fullName": "John Smith",
                "dateOfBirth": "15/05/1990",
                "driversLicense": "A1234567",
                "sin": "123-456-789",
                "occupation": "Software Engineer"
            },
            "applicant2": None
        },
        "otherOccupants": [
            {"name": "Jane Smith", "relationship": "Spouse", "age": 32}
        ],
        "rentalHistory": {
            "current": {
                "address": "123 Main St, Toronto, ON M1A 1A1",
                "moveInDate": "01/01/2024",
                "landlordName": "Bob Johnson",
                "landlordPhone": "4165551234"
            },
            "previous": {
                "address": "456 Oak Ave, Toronto, ON M2B 2B2",
                "startDate": "01/06/2020",
                "endDate": "31/12/2023",
                "landlordName": "Alice Williams",
                "landlordPhone": "4165555678"
            }
        },
        "employment": {
            "applicant1": {
                "present": {
                    "employer": "Tech Corp Ltd",
                    "address": "789 Innovation Dr, Toronto, ON",
                    "phone": "4165559999",
                    "position": "Senior Engineer",
                    "lengthOfEmployment": "3 years",
                    "supervisor": "Mike Brown",
                    "monthlyIncome": "6500"
                }
            }
        },
        "banking": {
            "bankName": "Royal Bank",
            "branch": "Downtown Toronto",
            "address": "100 King St W, Toronto, ON",
            "chequingAccount": "123456789",
            "savingsAccount": "987654321"
        },
        "financialObligations": {
            "obligations": [
                {"paymentTo": "Car Loan", "amount": "450"}
            ]
        },
        "personalReferences": [
            {
                "name": "David Lee",
                "address": "100 Test St, Toronto, ON",
                "phone": "4165552222",
                "acquaintanceDuration": "5 years",
                "occupation": "Manager"
            }
        ],
        "vehicles": [
            {
                "make": "Toyota",
                "model": "Camry",
                "year": "2020",
                "licensePlate": "ABC1234"
            }
        ]
    }

    output = generate_form_410(sample_data)
    print(f"Form 410 generated: {output}")
