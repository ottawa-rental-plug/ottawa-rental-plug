#!/usr/bin/env python3
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from datetime import date

# Create PDF
pdf_path = "ottawa-rental-market-report.pdf"
doc = SimpleDocTemplate(pdf_path, pagesize=letter,
                       leftMargin=0.75*inch, rightMargin=0.75*inch,
                       topMargin=0.75*inch, bottomMargin=0.75*inch)

# Color palette
PRIMARY_BLUE = HexColor('#0071e3')
DARK_BLUE = HexColor('#003a8c')
ACCENT_AMBER = HexColor('#b45309')
TEXT_SECONDARY = HexColor('#6e6e73')
TEXT_PRIMARY = HexColor('#1d1d1f')

story = []
styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=28,
    textColor=DARK_BLUE,
    spaceAfter=6,
    fontName='Helvetica-Bold'
)

subtitle_style = ParagraphStyle(
    'CustomSubtitle',
    parent=styles['Normal'],
    fontSize=11,
    textColor=TEXT_SECONDARY,
    spaceAfter=12
)

section_title_style = ParagraphStyle(
    'SectionTitle',
    parent=styles['Heading2'],
    fontSize=10,
    textColor=PRIMARY_BLUE,
    spaceAfter=10,
    spaceBefore=12,
    fontName='Helvetica-Bold'
)

body_style = ParagraphStyle(
    'CustomBody',
    parent=styles['Normal'],
    fontSize=10,
    textColor=TEXT_PRIMARY,
    leading=14,
    spaceAfter=10
)

# Header
header_data = [['Ottawa Rental Plug', f'{date.today().strftime("%B %Y")} Market Report']]
header_table = Table(header_data, colWidths=[3.5*inch, 2.25*inch])
header_table.setStyle(TableStyle([
    ('ALIGN', (0, 0), (0, 0), 'LEFT'),
    ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ('FONT', (0, 0), (0, 0), 'Helvetica-Bold', 14),
    ('TEXTCOLOR', (0, 0), (0, 0), DARK_BLUE),
    ('FONT', (1, 0), (1, 0), 'Helvetica', 9),
    ('TEXTCOLOR', (1, 0), (1, 0), TEXT_SECONDARY),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
]))
story.append(header_table)
story.append(Spacer(1, 0.1*inch))

# Title
story.append(Paragraph("Ottawa Rental Market Intelligence", title_style))
story.append(Paragraph(f"Prepared: {date.today().strftime('%B %d, %Y')}", subtitle_style))
story.append(Spacer(1, 0.15*inch))

# Key Metrics
story.append(Paragraph("KEY MARKET METRICS", section_title_style))
story.append(Spacer(1, 0.08*inch))

metrics_data = [
    ['Average Rent (1BR)', 'Market Trend', 'Available Listings', 'Avg Days Listed'],
    ['$1,450/mo', '+3.2% YoY', '847', '18 days'],
]

metrics_table = Table(metrics_data, colWidths=[1.375*inch]*4)
metrics_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#e8f0fd')),
    ('TEXTCOLOR', (0, 0), (-1, 0), PRIMARY_BLUE),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
    ('FONT', (0, 1), (-1, 1), 'Helvetica-Bold', 12),
    ('TEXTCOLOR', (0, 1), (-1, 1), DARK_BLUE),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#d2d2d7')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#f9f9fb')]),
    ('TOPPADDING', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
]))
story.append(metrics_table)
story.append(Spacer(1, 0.2*inch))

# Neighborhood Profiles
story.append(Paragraph("NEIGHBORHOOD PROFILES", section_title_style))
story.append(Spacer(1, 0.08*inch))

neighborhoods = [
    ('Downtown / Centretown', '$1,650', '↑ 4.1%', 'High', 'Premium walkable core. Strong young professional demand.'),
    ('Glebe / Westboro', '$1,520', '↑ 2.8%', 'High', 'Established communities. Steady family & professional interest.'),
    ('Kanata / Stittsville', '$1,380', '↑ 1.9%', 'Moderate', 'Suburban growth. Emerging tech corridor appeal.'),
    ('Nepean / Barrhaven', '$1,290', '↑ 2.2%', 'Moderate', 'Affordable suburban. Growing amenities & accessibility.'),
]

for name, rent, trend, demand, insight in neighborhoods:
    nh_data = [[name, rent, trend], [insight, '', demand]]
    nh_table = Table(nh_data, colWidths=[3.1*inch, 1.3*inch, 1.35*inch])
    nh_table.setStyle(TableStyle([
        ('FONT', (0, 0), (0, 0), 'Helvetica-Bold', 10),
        ('TEXTCOLOR', (0, 0), (0, 0), DARK_BLUE),
        ('FONT', (1, 0), (-1, 0), 'Helvetica-Bold', 9),
        ('TEXTCOLOR', (1, 0), (-1, 0), PRIMARY_BLUE),
        ('FONT', (0, 1), (0, 1), 'Helvetica', 9),
        ('TEXTCOLOR', (0, 1), (0, 1), TEXT_SECONDARY),
        ('FONT', (2, 1), (2, 1), 'Helvetica-Bold', 9),
        ('TEXTCOLOR', (2, 1), (2, 1), ACCENT_AMBER),
        ('ALIGN', (0, 1), (0, 1), 'LEFT'),
        ('ALIGN', (2, 1), (2, 1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e8e8ed')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [white, HexColor('#fafafa')]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(nh_table)
    story.append(Spacer(1, 0.08*inch))

story.append(Spacer(1, 0.1*inch))

# Market Dynamics
story.append(Paragraph("MARKET DYNAMICS", section_title_style))
story.append(Spacer(1, 0.08*inch))

dynamics = """<b>Supply Trends:</b> 847 active listings across platforms. Inventory stable Q-over-Q. Seasonal uptick expected June–August. Off-market opportunities represent 12–15% of total supply.<br/><br/><b>Demand Patterns:</b> Young professionals (25–35) lead Downtown/Glebe searches. Families exploring Kanata suburban. Remote work extending search radius 15–20% from core."""

story.append(Paragraph(dynamics, body_style))
story.append(Spacer(1, 0.15*inch))

# Next Steps
story.append(Paragraph("YOUR NEXT STEPS", section_title_style))
story.append(Spacer(1, 0.08*inch))

next_steps = """<b>1. Schedule Your Search</b> — Cyril contacts within 24 hours to align with your criteria and match you with listings across public platforms and exclusive off-market inventory.<br/><br/><b>2. Personalized Analysis</b> — Receive detailed neighborhood guides for target areas with rental trends and strategic timing.<br/><br/><b>3. Guided Viewings</b> — Once properties identified, Cyril coordinates site visits and provides expert insights on value and rental outlook."""

story.append(Paragraph(next_steps, body_style))
story.append(Spacer(1, 0.12*inch))

# Footer
footer = """<b>Ottawa Rental Plug</b> | (613) 601–3005 | ottawarentalplug.com<br/><font size="8">Market data accurate as of June 2026. Recommendations valid 60 days.</font>"""
footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=TEXT_SECONDARY)
story.append(Paragraph(footer, footer_style))

# Build PDF
doc.build(story)
print(f"✓ Report created: {pdf_path}")
