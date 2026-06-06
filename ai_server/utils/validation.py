import re
from urllib.parse import urlparse
from ai_server.config import INVALID_TLD_PATTERNS, SOCIAL_DOMAINS, GENERIC_TECH_TERMS

def is_valid_extracted_url(url: str) -> bool:
    url_lower = url.lower().strip()
    if not url_lower:
        return False
        
    try:
        parsed = urlparse(url_lower)
        # Extract host
        host = parsed.netloc or parsed.path.split("/")[0]
        
        # Strip scheme or paths just to get the clean host
        if "://" in host:
            host = host.split("://")[-1]
        if "/" in host:
            host = host.split("/")[0]
            
        host = host.strip()
        
        # Host name validation: Must only contain alphanumeric, dots, hyphens, underscores
        if not re.match(r"^[a-z0-9\.\-_]+$", host):
            return False
            
        # Ensure it has a valid structure with dots
        parts = host.split(".")
        if len(parts) < 2:
            return False
            
        tld = parts[-1]
        
        # Must have valid TLD (at least 2 chars)
        if len(tld) < 2:
            return False
            
        # Check for invalid TLDs
        if tld in INVALID_TLD_PATTERNS:
            return False
            
        # Skip social media domains for raw OCR URLs
        for domain in SOCIAL_DOMAINS:
            if domain in host:
                return False
                
    except Exception:
        return False
        
    return True


def is_valid_brand_for_search(name: str) -> bool:
    """
    Check if the brand name is high-confidence and not a generic tech term or direct domain.
    If it contains a dot, it's already a domain/URL so we bypass Serper search.
    """
    name_lower = name.lower().strip()
    if not name_lower or len(name_lower) < 2:
        return False
        
    # If it contains a dot, it's already a domain. We handle it directly without Serper.
    if "." in name_lower:
        return False
        
    if name_lower in GENERIC_TECH_TERMS:
        return False
        
    # Skip if name is just numbers or special characters
    if re.match(r"^\d+$", name_lower):
        return False
        
    return True
