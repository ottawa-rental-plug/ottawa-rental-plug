#!/usr/bin/env python3
"""
Simple API wrapper for Form 410 PDF generation
Accepts JSON on stdin, outputs PDF to stdout
"""

import sys
import json
import os
from generate_form_410 import generate_form_410
import tempfile

def main():
    try:
        # Read JSON from stdin
        input_data = sys.stdin.read()
        form_data = json.loads(input_data)

        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            output_path = tmp.name

        # Generate Form 410
        result_path = generate_form_410(form_data, output_path)

        # Read PDF and output to stdout (binary)
        with open(result_path, 'rb') as f:
            sys.stdout.buffer.write(f.buffer.read() if hasattr(f, 'buffer') else f.read())

        # Clean up
        try:
            os.unlink(result_path)
        except:
            pass

        sys.exit(0)

    except Exception as e:
        # Write error to stderr
        sys.stderr.write(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
