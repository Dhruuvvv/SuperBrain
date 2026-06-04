const dns = require("dns");
const { URL } = require("url");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// Load Env variables
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Resolves a hostname via DNS to check if the domain exists.
 */
function checkDNS(hostname) {
    return new Promise((resolve) => {
        dns.lookup(hostname, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Verifies a URL by performing a lightweight HTTP request.
 */
async function verifyUrl(resourceUrl) {
    try {
        const parsed = new URL(resourceUrl);
        
        // Step 1: Check DNS first
        const dnsOk = await checkDNS(parsed.hostname);
        if (!dnsOk) {
            return { ok: false, reason: "dns_lookup_failed" };
        }

        // Step 2: Make request with timeout & generic user-agent to bypass basic bot blockers
        const response = await axios.get(resourceUrl, {
            timeout: 5000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            },
            validateStatus: (status) => status < 400 // Accept any 2xx or 3xx status code
        });
        
        return { ok: true, status: response.status };
    } catch (err) {
        // If it timed out or got a 4xx/5xx status
        return {
            ok: false,
            reason: err.response ? `http_status_${err.response.status}` : "network_error"
        };
    }
}

/**
 * Background worker task to verify resources for a specific reel.
 */
async function verifyReelResources(reelId) {
    console.log(`[Verification Worker] Starting verification for reel: ${reelId}`);
    
    try {
        // 1. Fetch pending resources for this reel
        const { data: resources, error } = await supabase
            .from("resources")
            .select("*")
            .eq("reel_id", reelId)
            .eq("verification_status", "pending_verification");
            
        if (error) {
            console.error(`[Verification Worker] Error fetching resources:`, error.message);
            return;
        }
        
        if (!resources || resources.length === 0) {
            console.log(`[Verification Worker] No pending resources found for reel ${reelId}`);
            return;
        }
        
        console.log(`[Verification Worker] Found ${resources.length} pending resources to verify`);
        
        for (const resource of resources) {
            const url = resource.resource_url;
            let status = "verified";
            let newConfidence = resource.confidence;
            
            if (url) {
                console.log(`[Verification Worker] Verifying URL: ${url}`);
                const result = await verifyUrl(url);
                
                if (result.ok) {
                    status = "verified";
                    // Boost confidence if verification succeeds
                    newConfidence = Math.min(100.0, resource.confidence + 5.0);
                    console.log(`[Verification Worker] URL Verified: ${url}. Confidence: ${resource.confidence} -> ${newConfidence}`);
                } else {
                    status = "failed_verification";
                    // Drop confidence significantly if URL fails/404s
                    newConfidence = Math.max(15.0, resource.confidence - 30.0);
                    console.log(`[Verification Worker] URL Verification Failed: ${url} (Reason: ${result.reason}). Confidence: ${resource.confidence} -> ${newConfidence}`);
                }
            } else {
                // If there's no URL, we mark it as verified if the confidence is already high/medium, else keep pending/no_url
                status = resource.confidence >= 60.0 ? "verified" : "failed_verification";
            }
            
            // 2. Update resource row in database
            const { error: updateErr } = await supabase
                .from("resources")
                .update({
                    verification_status: status,
                    confidence: newConfidence
                })
                .eq("id", resource.id);
                
            if (updateErr) {
                console.error(`[Verification Worker] Failed to update resource ${resource.id}:`, updateErr.message);
            }
        }
        
        console.log(`[Verification Worker] Resource verification completed for reel ${reelId}`);
    } catch (err) {
        console.error(`[Verification Worker] Unexpected error in verification task:`, err);
    }
}

module.exports = {
    verifyReelResources
};
