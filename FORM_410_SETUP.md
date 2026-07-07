# Form 410 Rental Application System

## Overview

This system automates Ontario Form 410 (Rental Application - Residential) generation. Applicants complete an intelligent questionnaire, and the system generates a professionally formatted PDF Form 410.

## Components

### 1. **rental-application.html**
- Multi-step intelligent questionnaire matching Form 410 structure
- 10 sequential sections with conditional logic
- Auto-collects data in structured JSON format
- Real-time progress tracking
- Mobile-responsive design
- Dark mode support

**Features:**
- Conditional co-applicant fields (show/hide based on selection)
- Dynamic occupant/reference/vehicle/obligation fields (add/remove)
- Optional field handling (skippable as needed)
- Real-time validation
- Professional UI with smooth animations

**Access:** `http://localhost:3000/rental-application`

### 2. **generate_form_410.py**
- Python backend that generates Form 410 PDFs
- Uses ReportLab for professional PDF generation
- Maps questionnaire data to Form 410 sections
- Supports multi-page generation
- Proper formatting and spacing
- Handles special characters and phone formatting

**Class:** `Form410Generator`
- Accepts questionnaire data dictionary
- Generates professionally formatted PDF
- Matches official Ontario Form 410 layout

### 3. **form410_api.py**
- JSON-to-PDF API wrapper
- Reads questionnaire data from stdin
- Outputs PDF to stdout
- Used by Node.js backend for integration

### 4. **server.js**
- Express.js backend server
- Serves static files (HTML, CSS, JS)
- Handles `/api/generate-form-410` POST endpoint
- Spawns Python process for PDF generation
- Returns PDF for browser download
- Error handling and validation

**Endpoints:**
- `GET /` → Serves index.html
- `GET /rental-application` → Rental application questionnaire
- `POST /api/generate-form-410` → Generate Form 410 PDF
- `GET /api/health` → Health check

## Installation & Setup

### 1. Install Node Dependencies
```bash
cd C:\Users\cyril\OneDrive\Desktop\Website
npm install
```

### 2. Install Python Dependencies
```bash
pip install reportlab pdfrw pypdf
```

### 3. Start the Server
```bash
node server.js
```

Server will run on `http://localhost:3000`

## Questionnaire Sections

### Section 1: Application Type
- Single applicant or co-applicant selection

### Section 2-3: Applicant Information
- Full name, date of birth, driver's license, SIN, occupation
- Section 3 (co-applicant) shown conditionally

### Section 4: Other Occupants
- Spouse, children, roommates
- Add/remove occupants dynamically

### Section 5: Rental Information
- Property address, monthly rent, move-in date

### Section 6: Rental History
- Current residence (address, duration, landlord)
- Previous residence (dates, landlord)

### Section 7: Employment
- Current employer details (name, address, phone, position, length, supervisor, income)
- Previous employment (if employed < 2 years)

### Section 8: Banking & Financial Obligations
- Bank name, branch, account numbers
- Loans, student debt, child support
- Add/remove obligations dynamically

### Section 9: Personal References
- 2-3 references with contact info
- Add/remove references dynamically

### Section 10: Vehicles & Authorization
- Vehicle information (make, model, year, license plate)
- Consent authorization
- Signature, email, phone

## Data Flow

```
User fills questionnaire
       |
       v
Client-side JavaScript collects form data into structured JSON
       |
       v
POST to /api/generate-form-410 with JSON body
       |
       v
Node.js server receives JSON
       |
       v
Spawns Python process (form410_api.py)
       |
       v
Python receives JSON via stdin
       |
       v
Imports generate_form_410.py module
       |
       v
Form410Generator class processes data
       |
       v
ReportLab generates professional PDF
       |
       v
PDF written to temporary file
       |
       v
PDF binary output to stdout
       |
       v
Node.js captures stdout buffer
       |
       v
Returns PDF as download to browser
       |
       v
Temporary files cleaned up
```

## JSON Data Structure

```json
{
  "applicationDate": "07/07/2026",
  "applicants": {
    "applicant1": {
      "fullName": "John Smith",
      "dateOfBirth": "15/05/1990",
      "driversLicense": "A1234567",
      "sin": "123-456-789",
      "occupation": "Software Engineer"
    },
    "applicant2": null
  },
  "otherOccupants": [
    {
      "name": "Jane Smith",
      "relationship": "Spouse",
      "age": "32"
    }
  ],
  "rentalHistory": {
    "current": {
      "address": "123 Main St, Toronto, ON",
      "moveInDate": "01/01/2024",
      "landlordName": "Bob Johnson",
      "landlordPhone": "(416) 555-1234"
    },
    "previous": {
      "address": "456 Oak Ave, Toronto, ON",
      "startDate": "01/06/2020",
      "endDate": "31/12/2023",
      "landlordName": "Alice Williams",
      "landlordPhone": "(416) 555-5678"
    }
  },
  "employment": {
    "applicant1": {
      "present": {
        "employer": "Tech Corp Ltd",
        "address": "789 Innovation Dr, Toronto, ON",
        "phone": "(416) 555-9999",
        "position": "Senior Engineer",
        "lengthOfEmployment": "3 years",
        "supervisor": "Mike Brown",
        "monthlyIncome": "6500"
      },
      "previous": {
        "employer": "Previous Corp",
        "address": "...",
        "phone": "...",
        "position": "...",
        "lengthOfEmployment": "...",
        "supervisor": "..."
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
      {
        "paymentTo": "Car Loan",
        "amount": "450"
      }
    ]
  },
  "personalReferences": [
    {
      "name": "David Lee",
      "address": "100 Test St, Toronto, ON",
      "phone": "(416) 555-2222",
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
```

## PDF Output

The generated Form 410 PDF includes:

1. **Header**
   - OREA branding
   - Form 410 title
   - "Rental Application - Residential" subtitle

2. **Sections** (matching official Form 410)
   - Applicant 1 & 2 information
   - Other occupants
   - Last two places of residence
   - Present employment
   - Previous employment (if applicable)
   - Banking information
   - Financial obligations
   - Personal references
   - Automobiles

3. **Declaration Section**
   - Authority verification statement
   - Signature line
   - Contact information

## Integration with ORP

### Option 1: Standalone Page
Already accessible at `/rental-application`

### Option 2: Embed in Workflow
Add button/link to apply.html:
```html
<a href="/rental-application" class="btn btn-primary">
  Apply for Rental
</a>
```

### Option 3: Iframe Integration
```html
<iframe src="/rental-application" width="100%" height="800"></iframe>
```

## Error Handling

### Client-Side (JavaScript)
- Required field validation
- Phone number formatting
- Date validation (DD/MM/YYYY format)
- Network error handling
- User-friendly error messages

### Server-Side (Node.js)
- Validates JSON structure
- Checks required applicant fields
- Handles Python process errors
- Returns appropriate HTTP status codes

### Python-Side
- Exception handling
- Temporary file cleanup
- Error output to stderr
- Exit code indicators

## Testing

### Test with Sample Data
```bash
python3 << 'EOF'
from generate_form_410 import generate_form_410
sample_data = {...}  # See JSON structure above
output = generate_form_410(sample_data, "test_form_410.pdf")
print(f"Generated: {output}")
EOF
```

### Test via API
```bash
curl -X POST http://localhost:3000/api/generate-form-410 \
  -H "Content-Type: application/json" \
  -d @sample_data.json \
  --output form_410.pdf
```

### Test in Browser
1. Navigate to `http://localhost:3000/rental-application`
2. Fill in form (use sample data for testing)
3. Click "Generate Form 410"
4. PDF should download

## Customization

### Modify Questionnaire Layout
Edit `rental-application.html` - Sections are labeled with `data-section="N"`

### Change PDF Format
Edit `generate_form_410.py` - Modify `Form410Generator` class methods:
- `_build_*_section()` methods control content
- `styles` dictionary controls formatting
- `pagesize=letter` can change to A4

### Add Fields
1. Add form input to `rental-application.html`
2. Add data collection to `collectFormData()` function
3. Add field mapping in `generate_form_410.py`

## Deployment

### Local Development
```bash
node server.js
# Access at http://localhost:3000
```

### Netlify (Static File Hosting)
- Questionnaire HTML can be served statically
- Requires custom backend for PDF generation
- Set up serverless function for `/api/generate-form-410` endpoint

### Heroku / Node.js Hosting
```bash
git push heroku main
# Server automatically starts with `npm start`
```

Update `package.json` with start script:
```json
"scripts": {
  "start": "node server.js"
}
```

### Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
RUN apk add python3 py3-pip
RUN pip install reportlab pdfrw pypdf
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
```

## Browser Compatibility

✓ Chrome/Edge (latest)
✓ Firefox (latest)
✓ Safari (latest)
✓ Mobile browsers (iOS Safari, Chrome Mobile)

Responsive breakpoints:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Performance

- Questionnaire: ~50KB (single-page app)
- Generated PDF: ~4-8KB (efficient ReportLab output)
- Form submission: ~1-2 seconds (Python generation + PDF creation)

## Future Enhancements

1. **Multi-language Support** - Provide questionnaire in French
2. **Form Prefilling** - Auto-populate from user profile
3. **Bulk Processing** - Generate multiple Form 410s at once
4. **Email Integration** - Auto-send Form 410 to landlord
5. **Digital Signature** - Add electronic signature to PDF
6. **Document Storage** - Save submissions to database
7. **Analytics** - Track form completion rates
8. **Landlord Portal** - View received applications
9. **Mobile App** - Native iOS/Android app
10. **API Documentation** - OpenAPI/Swagger docs

## Support

For issues or questions:
1. Check console logs (F12 Developer Tools)
2. Check server logs (`node server.js` output)
3. Verify Python installation and dependencies
4. Ensure port 3000 is available

## License

Part of Ottawa Rental Plug platform.
