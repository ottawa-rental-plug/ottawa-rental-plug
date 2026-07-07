/**
 * Express Server for ORP Platform with Form 410 Generation
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// API endpoint for Form 410 generation
app.post('/api/generate-form-410', (req, res) => {
    try {
        const formData = req.body;

        // Validate required fields
        if (!formData.applicants?.applicant1?.fullName) {
            return res.status(400).json({ error: 'Missing required applicant information' });
        }

        // Call Python script via form410_api.py
        const pythonProcess = spawn('python3', [path.join(__dirname, 'form410_api.py')], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let pdfBuffer = Buffer.alloc(0);
        let errorOutput = '';
        let hasError = false;

        // Capture stdout (PDF data)
        pythonProcess.stdout.on('data', (data) => {
            pdfBuffer = Buffer.concat([pdfBuffer, data]);
        });

        // Capture stderr (errors)
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            hasError = true;
        });

        // Send form data to Python process
        pythonProcess.stdin.write(JSON.stringify(formData));
        pythonProcess.stdin.end();

        // Handle process completion
        pythonProcess.on('close', (code) => {
            if (code === 0 && !hasError && pdfBuffer.length > 0) {
                // Successfully generated PDF
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename="Form_410_Application.pdf"');
                res.send(pdfBuffer);
            } else {
                // Error generating PDF
                let errorMsg = errorOutput || 'Unknown error generating Form 410';
                try {
                    const errorJson = JSON.parse(errorOutput);
                    errorMsg = errorJson.error;
                } catch (e) {
                    // Keep original error message
                }

                console.error('Form 410 generation error:', errorMsg);
                res.status(500).json({ error: 'Failed to generate Form 410: ' + errorMsg });
            }
        });

        pythonProcess.on('error', (err) => {
            console.error('Process error:', err);
            res.status(500).json({ error: 'Process error: ' + err.message });
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve rental application page
app.get('/rental-application', (req, res) => {
    res.sendFile(path.join(__dirname, 'rental-application.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`ORP Server running on http://localhost:${PORT}`);
    console.log(`Rental Application: http://localhost:${PORT}/rental-application`);
    console.log(`Form 410 API: POST http://localhost:${PORT}/api/generate-form-410`);
});
