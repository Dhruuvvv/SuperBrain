GEMINI_VIDEO_PROMPT = """
Analyze ALL these video frames carefully in sequence. These are from an Instagram Reel.
Perform a production-grade visual product intelligence assessment.

TASK 1 — URL DETECTION (High Confidence):
- Pay extremely close attention to the bottom/top overlay text, watermarks, browser URL address bars, code file contents showing URLs, or any embedded QR codes/links.
- Extract EXACTLY and ONLY real website URLs or domains physically visible on the screen.
- Do NOT complete, infer, guess, or hallucinate URLs. If a URL/domain name is not physically visible on the screen, do NOT list it.
- Never guess a TLD (like .com, .io, .dev) if it's not visible.
- If you see a brand name or keyword but no actual URL, do NOT list it here (list it under VISIBLE_PRODUCTS_OR_WEBSITES instead).
- Format: one URL/domain per line. If none are physically visible, write "none".

TASK 2 — REPOSITORIES DETECTION:
- Extract any GitLab/GitHub repositories physically visible on screen (e.g., github.com/user/repo).
- Do NOT guess repository names. If none, write "none".

TASK 3 — VISIBLE PRODUCTS OR WEBSITES (Central Focus & Intent Analysis):
- Identify products, websites, apps, or SaaS tools that are actively demonstrated, shown, or used on screen, or are the central focus of the scene (e.g. browser showing a dashboard, screen recording, dashboard UI, tool workspace).
- For each product, assign a confidence score between 0.0 and 1.0 (where 0.9+ means the app UI/dashboard is clearly demonstrated or active on screen; 0.7-0.8 means the product logo or browser tab is visible; <=0.6 means the product is only passively shown as a passing reference).
- Provide a brief reason for the product presence and confidence score.
- STRICT RULE: Format each line EXACTLY as: Name | Confidence | Reason
- Example: Retool | 0.95 | Dashboard UI shown as creator designs an app canvas

TASK 4 — INCIDENTAL MENTIONS (No Search):
- Identify any incidental keywords, supporting technologies, frameworks, libraries (e.g. React, HTML, CSS, JavaScript, Python, Tailwind, etc.), subtitles, or educational overlay text.
- These are secondary details, framework badges, code snippets, or generic mentions that are NOT actively demonstrated as a product UI or a website.
- List each name on a separate line. If none, write "none".

TASK 5 — VISUAL DESCRIPTION:
- Provide a clear, detailed, frame-by-frame visual summary explaining the topic of the video and what actions/UIs are being demonstrated.

Format your response EXACTLY like this:
URLS_FOUND:
[one per line, or "none"]
REPOSITORIES_FOUND:
[one per line, or "none"]
VISIBLE_PRODUCTS_OR_WEBSITES:
[Format: Name | Confidence | Reason (or "none")]
INCIDENTAL_MENTIONS:
[one per line, or "none"]
VISUAL_DESCRIPTION:
[detailed description]
"""

GEMINI_SINGLE_IMAGE_PROMPT = """
Analyze this Instagram photo post carefully.
Perform a production-grade visual product intelligence assessment.

TASK 1 — URL DETECTION (High Confidence):
- Pay extremely close attention to the bottom/top overlay text, watermarks, browser URL address bars, code file contents showing URLs, or any embedded QR codes/links.
- Extract EXACTLY and ONLY real website URLs or domains physically visible on the screen.
- Do NOT complete, infer, guess, or hallucinate URLs. If a URL/domain name is not physically visible on the screen, do NOT list it.
- Never guess a TLD (like .com, .io, .dev) if it's not visible.
- If you see a brand name or keyword but no actual URL, do NOT list it here (list it under VISIBLE_PRODUCTS_OR_WEBSITES instead).
- Format: one URL/domain per line. If none are physically visible, write "none".

TASK 2 — REPOSITORIES DETECTION:
- Extract any GitLab/GitHub repositories physically visible on screen (e.g., github.com/user/repo).
- Do NOT guess repository names. If none, write "none".

TASK 3 — VISIBLE PRODUCTS OR WEBSITES (Central Focus & Intent Analysis):
- Identify products, websites, apps, or SaaS tools that are actively demonstrated, shown, or used on screen, or are the central focus of the scene (e.g. browser showing a dashboard, screen recording, dashboard UI, tool workspace).
- For each product, assign a confidence score between 0.0 and 1.0 (where 0.9+ means the app UI/dashboard is clearly demonstrated or active on screen; 0.7-0.8 means the product logo or browser tab is visible; <=0.6 means the product is only passively shown as a passing reference).
- Provide a brief reason for the product presence and confidence score.
- STRICT RULE: Format each line EXACTLY as: Name | Confidence | Reason
- Example: Retool | 0.95 | Dashboard UI shown as creator designs an app canvas

TASK 4 — INCIDENTAL MENTIONS (No Search):
- Identify any incidental keywords, supporting technologies, frameworks, libraries (e.g. React, HTML, CSS, JavaScript, Python, Tailwind, etc.), subtitles, or educational overlay text.
- These are secondary details, framework badges, code snippets, or generic mentions that are NOT actively demonstrated as a product UI or a website.
- List each name on a separate line. If none, write "none".

TASK 5 — READ ALL TEXT:
- Extract and read ALL readable text visible in the image.
- Headings, body text, labels, captions, overlays.

TASK 6 — DESCRIBE THE IMAGE:
- What is visually shown in this image and what is its overall topic or message?

Format EXACTLY like this (no deviation):
URLS_FOUND:
[one per line, or "none"]
REPOSITORIES_FOUND:
[one per line, or "none"]
VISIBLE_PRODUCTS_OR_WEBSITES:
[Format: Name | Confidence | Reason (or "none")]
INCIDENTAL_MENTIONS:
[one per line, or "none"]
TEXT_CONTENT:
[all readable text from the image]
VISUAL_DESCRIPTION:
[overall description of the image and its topic]
"""

GEMINI_CAROUSEL_PROMPT = """
These are slides from an Instagram carousel post, in order.
Analyze ALL slides carefully.
Perform a production-grade visual product intelligence assessment.

TASK 1 — URL DETECTION (High Confidence):
- Pay extremely close attention to the bottom/top overlay text, watermarks, browser URL address bars, code file contents showing URLs, or any embedded QR codes/links.
- Extract EXACTLY and ONLY real website URLs or domains physically visible on the screen.
- Do NOT complete, infer, guess, or hallucinate URLs. If a URL/domain name is not physically visible on the screen, do NOT list it.
- Never guess a TLD (like .com, .io, .dev) if it's not visible.
- If you see a brand name or keyword but no actual URL, do NOT list it here (list it under VISIBLE_PRODUCTS_OR_WEBSITES instead).
- Format: one URL/domain per line. If none are physically visible, write "none".

TASK 2 — REPOSITORIES DETECTION:
- Extract any GitLab/GitHub repositories physically visible on screen (e.g., github.com/user/repo).
- Do NOT guess repository names. If none, write "none".

TASK 3 — VISIBLE PRODUCTS OR WEBSITES (Central Focus & Intent Analysis):
- Identify products, websites, apps, or SaaS tools that are actively demonstrated, shown, or used on screen, or are the central focus of the scene (e.g. browser showing a dashboard, screen recording, dashboard UI, tool workspace).
- For each product, assign a confidence score between 0.0 and 1.0 (where 0.9+ means the app UI/dashboard is clearly demonstrated or active on screen; 0.7-0.8 means the product logo or browser tab is visible; <=0.6 means the product is only passively shown as a passing reference).
- Provide a brief reason for the product presence and confidence score.
- STRICT RULE: Format each line EXACTLY as: Name | Confidence | Reason
- Example: Retool | 0.95 | Dashboard UI shown as creator designs an app canvas

TASK 4 — INCIDENTAL MENTIONS (No Search):
- Identify any incidental keywords, supporting technologies, frameworks, libraries (e.g. React, HTML, CSS, JavaScript, Python, Tailwind, etc.), subtitles, or educational overlay text.
- These are secondary details, framework badges, code snippets, or generic mentions that are NOT actively demonstrated as a product UI or a website.
- List each name on a separate line. If none, write "none".

TASK 5 — READ ALL TEXT FROM ALL SLIDES:
- Extract ALL text from every slide in order.
- Headings, descriptions, bullet points, labels.
- Labeled by slide number: [Slide 1], [Slide 2], etc.

TASK 6 — DESCRIBE THE CAROUSEL:
- What is the overall topic of this carousel post?
- What is each slide about (brief per-slide summary)?

Format EXACTLY like this (no deviation):
URLS_FOUND:
[one per line, or "none"]
REPOSITORIES_FOUND:
[one per line, or "none"]
VISIBLE_PRODUCTS_OR_WEBSITES:
[Format: Name | Confidence | Reason (or "none")]
INCIDENTAL_MENTIONS:
[one per line, or "none"]
TEXT_CONTENT:
[all text from all slides, labeled by slide number]
VISUAL_DESCRIPTION:
[overall topic and per-slide summary]
"""
