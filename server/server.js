require("dotenv").config();
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");
const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const util = require("util");
const { createClient } = require("@supabase/supabase-js");

const execPromise = util.promisify(exec);
const { verifyReelResources } = require("./verification_worker");

const app = express();
app.use(cors());
app.use(express.json());

// Ensure thumbnails directory exists and serve it statically
const thumbnailsDir = path.join(__dirname, "public", "thumbnails");
if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
}
app.use("/thumbnails", express.static(thumbnailsDir));

// Init Supabase Admin Client using Service Key (bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

// --- Middleware ---
 
// Auth Middleware: Extracts Bearer token and verifies using Supabase Auth
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];
    
    try {
        // Verify token using Supabase Auth (NOT jwt.verify)
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(401).json({ error: "Unauthorized", details: error?.message });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (err) {
        console.error("Auth middleware error:", err.message);
        return res.status(500).json({ error: "Internal server error during authentication" });
    }
};

// Helper to clean up all temporary files matching a reelId
const cleanupTempFiles = (tempDir, reelId) => {
    if (!fs.existsSync(tempDir) || !reelId) return;
    try {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
            if (file.includes(reelId)) {
                const filePath = path.join(tempDir, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        });
        console.log(`[${reelId}] Cleaned up all temp files.`);
    } catch (err) {
        console.warn(`[${reelId}] Failed to clean up temp files:`, err.message);
    }
};

// --- Routes ---

// POST /api/reels: Download, transcribe, analyze, and save to database
app.post("/api/reels", authMiddleware, async (req, res) => {
    const { url } = req.body;
    const userId = req.user.id;

    // Validate Instagram URL (Supports Reels, Posts, IGTV, and Stories)
    const validPatterns = ["instagram.com/reel/", "instagram.com/p/", "instagram.com/tv/", "instagram.com/stories/"];
    const isValid = url && validPatterns.some(pattern => url.includes(pattern));

    if (!isValid) {
        return res.status(400).json({ error: "Valid Instagram URL (Reel, Post, TV, or Story) required" });
    }

    const cleanUrl = url.split("?")[0];

    // Check for duplicate URL
    const { data: existing } = await supabase
        .from("reels")
        .select("id, analysis_status")
        .eq("user_id", userId)
        .eq("instagram_url", cleanUrl)
        .maybeSingle();

    if (existing) {
        // Completed hoy to genuinely duplicate che
        if (existing.analysis_status === "completed") {
            return res.status(409).json({ 
                error: "This reel is already saved",
                reelId: existing.id,
                status: existing.analysis_status
            });
        }
        
        // Failed ya pending hoy to delete kari ne re-process karo
        if (existing.analysis_status === "failed" || existing.analysis_status === "pending") {
            // Cleanup old stuck record
            await supabase.from("reel_metadata").delete().eq("reel_id", existing.id);
            await supabase.from("transcripts").delete().eq("reel_id", existing.id);
            await supabase.from("reels").delete().eq("id", existing.id);
            // Continue to fresh insert below...
        }
    }
    
    let reelId = null;
    let audioPath = null;
    let videoPath = null;
    let imagePaths = [];

    try {
        // 1. Insert into reels table with status "pending"
        const { data: reelData, error: reelError } = await supabase
            .from("reels")
            .insert({
                user_id: userId,
                instagram_url: cleanUrl,
                analysis_status: "pending"
            })
            .select()
            .single();

        if (reelError) throw new Error("Failed to create reel record: " + reelError.message);

        reelId = reelData.id;
        const tempDir = path.join(__dirname, "temp");
        audioPath = path.join(tempDir, `audio_${reelId}.wav`);
        videoPath = path.join(tempDir, `video_${reelId}.mp4`);

        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const cookiesPath = path.resolve(__dirname, "../cookies.txt");
        const cookiesFlag = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : "";

        // Fetch metadata using yt-dlp (dump-single-json guarantees a single JSON object even for playlists)
        console.log(`[${reelId}] Fetching metadata...`);
        const metaCmd = `yt-dlp.exe --dump-single-json --skip-download --ignore-no-formats-error ${cookiesFlag} "${cleanUrl}"`;
        let instaMeta = {};
        
        try {
            const { stdout: metaStdout } = await execPromise(metaCmd);
            instaMeta = JSON.parse(metaStdout);
        } catch (metaErr) {
            console.warn(`[${reelId}] Metadata fetch failed (non-critical):`, metaErr.message);
        }

        const authorUsername = (instaMeta.channel || instaMeta.uploader || null)?.replace(/^@/, '') || null;
        const caption = instaMeta.description || null;
        
        const parsedDuration = parseInt(instaMeta.duration, 10);
        const durationSeconds = (!isNaN(parsedDuration) && parsedDuration > 0) 
            ? parsedDuration 
            : null;

        const thumbnailUrl = instaMeta.thumbnail 
            || (instaMeta.thumbnails && instaMeta.thumbnails.length > 0 
                ? instaMeta.thumbnails[instaMeta.thumbnails.length - 1]?.url 
                : null)
            || instaMeta.entries?.[0]?.thumbnail
            || (instaMeta.entries?.[0]?.thumbnails && instaMeta.entries[0].thumbnails.length > 0
                ? instaMeta.entries[0].thumbnails[instaMeta.entries[0].thumbnails.length - 1]?.url
                : null)
            || null;

        // Check if yt-dlp explicitly failed to find media (empty playlist)
        if (instaMeta._type === 'playlist' && (!instaMeta.entries || instaMeta.entries.length === 0)) {
             throw new Error("yt-dlp failed to extract media from this Instagram post. The post might be an unsupported carousel layout or require login cookies.");
        }

        // Extract URLs from caption using regex
        const urlRegex = /https?:\/\/[^\s\)\]\>\"\']+/g;
        const captionUrls = caption ? (caption.match(urlRegex) || []) : [];

        // Update reel record with real metadata
        await supabase.from("reels").update({
            author_username: authorUsername,
            caption: caption,
            duration_seconds: durationSeconds,
            thumbnail_url: thumbnailUrl
        }).eq("id", reelId);

        console.log(`[${reelId}] Detecting content type...`);

        // Use metadata to detect content type
        const mediaExt = instaMeta.ext || "";
        const mediaType = instaMeta._type || "single";
        const entries = instaMeta.entries || null; // present for playlists/carousels

        let contentMode = "video"; // "video" | "single_image" | "image_carousel"
        imagePaths = [];

        // Detect content type from metadata
        if (mediaExt === "mp4" || instaMeta.vcodec) {
            contentMode = "video";
            console.log(`[${reelId}] Detected: Video content`);
        } else if (entries && entries.length > 1) {
            contentMode = "image_carousel";
            console.log(`[${reelId}] Detected: Image carousel (${entries.length} slides)`);
        } else if (["jpg", "jpeg", "png", "webp"].includes(mediaExt)) {
            contentMode = "single_image";
            console.log(`[${reelId}] Detected: Single photo`);
        } else {
            // Fallback: try video download, if fails assume image
            contentMode = "video";
            console.log(`[${reelId}] Type unclear — defaulting to video attempt`);
        }

        // --- DOWNLOAD based on detected type ---

        if (contentMode === "video") {
            // Download video
            console.log(`[${reelId}] Downloading video...`);
            // yt-dlp might ignore the .mp4 extension in -o if it merges to .mkv or .webm,
            // so we force output format and look for the actual file
            const videoOutputTemplate = path.join(tempDir, `video_${reelId}.%(ext)s`);
            const downloadVideoCmd = `yt-dlp.exe -f "best[ext=mp4]/best" --no-playlist --merge-output-format mp4 -o "${videoOutputTemplate}" ${cookiesFlag} "${cleanUrl}"`;
            
            try {
                await execPromise(downloadVideoCmd);
                
                // Find actual downloaded video file
                const tempFiles = fs.readdirSync(tempDir);
                const downloadedVideo = tempFiles.find(f => f.startsWith(`video_${reelId}.`));
                if (downloadedVideo) {
                    videoPath = path.join(tempDir, downloadedVideo);
                    console.log(`[${reelId}] Video downloaded successfully: ${videoPath}`);
                } else {
                     throw new Error("Video downloaded but file not found in temp directory.");
                }
            } catch (dlErr) {
                // Video download failed — might actually be an image post
                // Try as image
                console.warn(`[${reelId}] Video download failed, trying as image...`, dlErr.message);
                contentMode = "single_image";
            }

            // If still video mode, extract audio & thumbnail frame
            if (contentMode === "video" && fs.existsSync(videoPath)) {
                // Extract audio
                console.log(`[${reelId}] Extracting audio using ffmpeg...`);
                const extractAudioCmd = `ffmpeg -i "${videoPath}" -vn -ar 16000 -ac 1 -y "${audioPath}"`;
                try {
                    await execPromise(extractAudioCmd);
                } catch (ffmpegErr) {
                    console.warn(`[${reelId}] Audio extraction failed (maybe silent video). Error ignored.`, ffmpegErr.message);
                    audioPath = ""; // Send empty to Python so it treats it as silent
                }

                // Extract thumbnail frame
                console.log(`[${reelId}] Extracting video thumbnail frame using ffmpeg...`);
                const localThumbnailPath = path.join(thumbnailsDir, `${reelId}.jpg`);
                const extractThumbCmd = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -y "${localThumbnailPath}"`;
                try {
                    await execPromise(extractThumbCmd);
                    const hostUrl = `${req.protocol}://${req.get("host")}`;
                    const localThumbnailUrl = `${hostUrl}/thumbnails/${reelId}.jpg`;
                    await supabase.from("reels").update({
                        thumbnail_url: localThumbnailUrl
                    }).eq("id", reelId);
                    console.log(`[${reelId}] Local video thumbnail saved: ${localThumbnailUrl}`);
                } catch (ffmpegThumbErr) {
                    console.warn(`[${reelId}] Video thumbnail extraction failed:`, ffmpegThumbErr.message);
                }
            }
        }

        if (contentMode === "single_image") {
            // Download single image
            console.log(`[${reelId}] Downloading single image...`);
            const dlCookiesFlag = fs.existsSync(cookiesPath) ? `-C "${cookiesPath}"` : "";
            const downloadImgCmd = `gallery-dl ${dlCookiesFlag} -d "${tempDir}" -o directory="" -f "img_${reelId}.{extension}" "${cleanUrl}"`;
            await execPromise(downloadImgCmd);

            // Find downloaded file
            const tempFiles = fs.readdirSync(tempDir);
            const imgFile = tempFiles.find(f => f.startsWith(`img_${reelId}.`));
            if (imgFile) {
                imagePaths = [path.join(tempDir, imgFile)];
                console.log(`[${reelId}] Single image downloaded: ${imgFile}`);

                // Copy to local thumbnails folder
                const imgExt = path.extname(imgFile);
                const localThumbnailPath = path.join(thumbnailsDir, `${reelId}${imgExt}`);
                fs.copyFileSync(path.join(tempDir, imgFile), localThumbnailPath);
                
                const hostUrl = `${req.protocol}://${req.get("host")}`;
                const localThumbnailUrl = `${hostUrl}/thumbnails/${reelId}${imgExt}`;
                await supabase.from("reels").update({
                    thumbnail_url: localThumbnailUrl
                }).eq("id", reelId);
                console.log(`[${reelId}] Local single image thumbnail saved: ${localThumbnailUrl}`);
            } else {
                throw new Error("Image download failed — file not found in temp directory");
            }
        }

        if (contentMode === "image_carousel") {
            // Download all carousel images
            console.log(`[${reelId}] Downloading image carousel...`);
            const dlCookiesFlag = fs.existsSync(cookiesPath) ? `-C "${cookiesPath}"` : "";
            const downloadImgCmd = `gallery-dl ${dlCookiesFlag} -d "${tempDir}" -o directory="" -f "img_${reelId}_{num}.{extension}" "${cleanUrl}"`;
            await execPromise(downloadImgCmd);

            // Find all downloaded files
            const tempFiles = fs.readdirSync(tempDir);
            imagePaths = tempFiles
                .filter(f => f.startsWith(`img_${reelId}_`))
                .sort((a, b) => {
                    const aMatch = a.match(/_(\d+)\.[^.]+$/);
                    const bMatch = b.match(/_(\d+)\.[^.]+$/);
                    if (aMatch && bMatch) {
                        return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10);
                    }
                    return a.localeCompare(b);
                })
                .map(f => path.join(tempDir, f));

            console.log(`[${reelId}] Downloaded ${imagePaths.length} carousel images`);

            if (imagePaths.length === 0) {
                throw new Error("Carousel download failed — no images found in temp directory");
            }

            // Copy first image from carousel as thumbnail
            if (imagePaths.length > 0) {
                const firstImgPath = imagePaths[0];
                const imgExt = path.extname(firstImgPath);
                const localThumbnailPath = path.join(thumbnailsDir, `${reelId}${imgExt}`);
                fs.copyFileSync(firstImgPath, localThumbnailPath);

                const hostUrl = `${req.protocol}://${req.get("host")}`;
                const localThumbnailUrl = `${hostUrl}/thumbnails/${reelId}${imgExt}`;
                await supabase.from("reels").update({
                    thumbnail_url: localThumbnailUrl
                }).eq("id", reelId);
                console.log(`[${reelId}] Local carousel thumbnail saved: ${localThumbnailUrl}`);
            }
        }

        console.log(`[${reelId}] Media ready. Content mode: ${contentMode}. Calling Python AI Server...`);

        // Build payload based on content mode
        const aiPayload = {
            reel_id: reelId,
            caption: caption || "",
            caption_urls: captionUrls,
            content_mode: contentMode,
            // Video fields (empty for image types)
            audio_path: contentMode === "video" ? audioPath : "",
            video_path: contentMode === "video" ? videoPath : "",
            // Image fields (empty for video type)
            image_paths: imagePaths,
        };

        let aiResponse;
        let aiErrorMsg = null;
        try {
            aiResponse = await axios.post(
                `${pythonServiceUrl}/analyze_reel`,
                aiPayload,
                { timeout: 600000 }
            );
        } catch (axiosErr) {
            console.error(`[${reelId}] Python AI server call failed:`, axiosErr.message);
            aiErrorMsg = `AI Service Error: Failed to get response from Python AI server (${axiosErr.message})`;
        }

        let transcript, metadata, embedding, visualDescription, extractedUrls, mentionedBrandNames, howToGuide, processingTime;
        let repositoriesFound = [], visibleProductsOrWebsites = [], incidentalMentions = [];
        let isSuccess = false;

        if (aiErrorMsg) {
            // Python service crashed or returned error status code
            transcript = { plain_text: "", srt: "" };
            metadata = {
                title: "Analysis Failed",
                summary: "AI was unable to complete the analysis due to a service error.",
                key_takeaways: [],
                tags: [],
                content_type: "Unknown",
                mentioned_tools_or_websites: [],
                language_detected: "Unknown"
            };
            embedding = new Array(384).fill(0);
            visualDescription = "Analysis failed due to AI service error.";
            extractedUrls = [];
            mentionedBrandNames = [];
            howToGuide = null;
            processingTime = null;
            isSuccess = false;
        } else {
            const resData = aiResponse.data;
            transcript = resData.transcript;
            metadata = resData.metadata;
            embedding = resData.embedding;
            visualDescription = resData.visual_description;
            extractedUrls = resData.extracted_urls || [];
            mentionedBrandNames = resData.mentioned_brand_names || [];
            repositoriesFound = resData.repositories_found || [];
            visibleProductsOrWebsites = resData.visible_products_or_websites || [];
            incidentalMentions = resData.incidental_mentions || [];
            howToGuide = resData.how_to_guide || null;
            processingTime = resData.processing_time_seconds || null;
            
            // Check if Python reported failure or metadata has fallback indicator
            const hasFallback = (metadata.title && (metadata.title.includes("Analysis Timeout") || metadata.title.includes("Short Video / No Content") || metadata.title.includes("Analysis Failed")));
            isSuccess = (resData.success === true) && !hasFallback;
            
            if (!isSuccess) {
                aiErrorMsg = resData.error || "Groq metadata generation failed or timed out.";
            }
        }

        console.log(`[${reelId}] AI analysis complete. Saving to database...`);

        // 4. Save transcript
        const { error: txErr } = await supabase.from("transcripts").insert({
            reel_id: reelId,
            plain_text: transcript.plain_text,
            srt: transcript.srt || null,
            word_count: transcript.plain_text ? transcript.plain_text.split(/\s+/).filter(Boolean).length : 0,
            language_detected: metadata.language_detected || null,
            processing_time_seconds: processingTime,
            transcription_status: "completed"
        });
        if (txErr) throw txErr;

        // 5. Save metadata including extracted URLs and how-to guide
        const { error: metaErr } = await supabase.from("reel_metadata").insert({
            reel_id: reelId,
            title: metadata.title,
            summary: metadata.summary,
            key_takeaways: metadata.key_takeaways,
            tags: metadata.tags,
            content_type: metadata.content_type,
            mentioned_tools: metadata.mentioned_tools_or_websites,
            mentioned_brand_names: mentionedBrandNames,
            repositories_found: repositoriesFound,
            visible_products_or_websites: visibleProductsOrWebsites,
            incidental_mentions: incidentalMentions,
            extracted_urls: extractedUrls,
            how_to_guide: howToGuide,
            language_detected: metadata.language_detected,
            visual_description: visualDescription,
            embedding: embedding
        });
        if (metaErr) throw metaErr;

        // 6. Save resources to resources table
        const resources = aiResponse && aiResponse.data ? aiResponse.data.resources || [] : [];
        if (resources.length > 0) {
            try {
                // Delete existing resources first to prevent duplicates upon re-analysis
                await supabase
                    .from("resources")
                    .delete()
                    .eq("reel_id", reelId);

                const resourcesToInsert = resources.map(r => ({
                    reel_id: reelId,
                    resource_name: r.resource_name,
                    resource_type: r.resource_type,
                    resource_url: r.resource_url,
                    confidence: r.confidence,
                    verification_status: r.verification_status || 'pending_verification',
                    hallucination_flag: r.hallucination_flag || false,
                    evidence_text: r.evidence_text || null,
                    timestamp_start: r.timestamp_start || null,
                    timestamp_end: r.timestamp_end || null
                }));

                const { error: resErr } = await supabase
                    .from("resources")
                    .insert(resourcesToInsert);

                if (resErr) {
                    console.error(`[${reelId}] Warning: Failed to insert resources (table might not exist yet):`, resErr.message);
                } else {
                    console.log(`[${reelId}] Successfully saved ${resources.length} resources to DB`);
                    
                    // Trigger background verification worker asynchronously
                    verifyReelResources(reelId).catch(err => {
                        console.error(`[${reelId}] Error running verification worker in background:`, err);
                    });
                }
            } catch (resCatchErr) {
                console.error(`[${reelId}] Error processing resources:`, resCatchErr.message);
            }
        }

        // 7. Update reel status
        const { data: finalReel } = await supabase
            .from("reels")
            .update({ 
                analysis_status: isSuccess ? "completed" : "failed",
                error_message: isSuccess ? null : aiErrorMsg,
                analyzed_at: new Date().toISOString()
            })
            .eq("id", reelId)
            .select()
            .single();

        // Cleanup all temp files
        cleanupTempFiles(tempDir, reelId);

        // Return full result to frontend
        return res.json({
            reel: finalReel,
            transcript,
            metadata
        });


    } catch (error) {
        console.error("Reel Processing Error:", error);
        
        // reelId available hoy to failed update karo
        if (reelId) {
            try {
                await supabase.from("reels")
                    .update({ 
                        analysis_status: "failed",
                        error_message: error.message ? error.message.substring(0, 500) : "Unknown error",
                        analyzed_at: new Date().toISOString()
                    })
                    .eq("id", reelId);
            } catch (updateErr) {
                console.error("Failed to update error status:", updateErr.message);
            }
            
            // Cleanup all temp files on failure
            cleanupTempFiles(tempDir, reelId);
        }
        
        return res.status(500).json({ 
            error: "Processing failed", 
            details: error.message 
        });
    }
});

// GET /api/reels: Get all reels for logged-in user with metadata joined
app.get("/api/reels", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search } = req.query;

    try {
        if (search && search.trim()) {
            console.log(`[Search] Semantic search query: "${search}"`);
            
            // 1. Get embedding from Python AI Server
            const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
            const embedRes = await axios.post(`${pythonUrl}/embed`, { text: search.trim() });
            const queryEmbedding = embedRes.data.embedding;

            // 2. Perform Vector Similarity Search in Supabase via RPC
            const { data: matchedReels, error: rpcErr } = await supabase.rpc("match_reels", {
                query_embedding: queryEmbedding,
                match_threshold: 0.50, // Stricter threshold for higher precision
                match_count: limit,
                filter_user_id: userId
            });

            if (rpcErr) throw rpcErr;

            // Format to match standard reels return structure
            const formattedData = (matchedReels || []).map((reel) => ({
                id: reel.id,
                user_id: userId,
                instagram_url: reel.instagram_url,
                author_username: reel.author_username,
                created_at: reel.created_at,
                analysis_status: reel.analysis_status || "completed",
                thumbnail_url: reel.thumbnail_url,
                reel_metadata: {
                    title: reel.title,
                    summary: reel.summary,
                    tags: reel.tags || [],
                    content_type: reel.content_type
                }
            }));

            return res.json({
                data: formattedData,
                meta: {
                    total: formattedData.length,
                    page: 1,
                    limit,
                    totalPages: 1
                }
            });
        }

        const { data, error, count } = await supabase
            .from("reels")
            .select(`
                *,
                reel_metadata (title, tags, content_type, summary)
            `, { count: 'exact' })
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return res.json({
            data,
            meta: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch reels", details: error.message });
    }
});

// GET /api/reels/:id: Single reel with full data joined
app.get("/api/reels/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const { data, error } = await supabase
            .from("reels")
            .select(`
                *,
                reel_metadata (*),
                transcripts (*),
                resources (*)
            `)
            .eq("id", id)
            .eq("user_id", userId) // Ensure the user owns this reel
            .single();

        if (error || !data) {
            return res.status(404).json({ error: "Reel not found" });
        }

        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch reel", details: error.message });
    }
});

// POST /api/reels/:id/mindmap: Generate and save mind map for a reel
app.post("/api/reels/:id/mindmap", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { detail_level } = req.body || {};

    try {
        // 1. Fetch reel metadata and transcripts
        const { data: reel, error: reelErr } = await supabase
            .from("reels")
            .select(`
                *,
                reel_metadata (*),
                transcripts (*)
            `)
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (reelErr || !reel) {
            return res.status(404).json({ error: "Reel not found or unauthorized" });
        }

        const metadata = reel.reel_metadata;
        if (!metadata) {
            return res.status(400).json({ error: "Reel metadata is missing. Cannot generate mind map." });
        }

        // Check if mind map is already generated (and not requested to regenerate/change detail level)
        if (metadata.mind_map && !detail_level) {
            return res.json(metadata.mind_map);
        }

        // 2. Call Python AI Server /mindmap
        const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
        const keyTakeaways = metadata.key_takeaways || [];
        const plainText = reel.transcripts ? (reel.transcripts.plain_text || "") : "";

        console.log(`[MindMap] Generating mind map for reel ${id} (detail_level: ${detail_level || "moderate"})...`);
        const aiResponse = await axios.post(`${pythonUrl}/mindmap`, {
            title: metadata.title || "Untitled Video",
            summary: metadata.summary || "",
            key_takeaways: keyTakeaways,
            plain_text: plainText,
            detail_level: detail_level || "moderate"
        });

        const mindMapData = aiResponse.data;

        // 3. Save to Supabase
        const { error: updateErr } = await supabase
            .from("reel_metadata")
            .update({ mind_map: mindMapData })
            .eq("reel_id", id);

        if (updateErr) throw updateErr;

        return res.json(mindMapData);

    } catch (error) {
        console.error("[MindMap] Error generating mind map:", error.message);
        return res.status(500).json({ 
            error: "Failed to generate mind map", 
            details: error.message 
        });
    }
});


// DELETE /api/reels/:id: Delete reel and cascade metadata/transcript
app.delete("/api/reels/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // First verify ownership
        const { data: reel, error: checkError } = await supabase
            .from("reels")
            .select("id")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (checkError || !reel) {
            return res.status(404).json({ error: "Reel not found or unauthorized" });
        }

        // Manually delete dependent records to ensure clean deletion
        // (If foreign keys have ON DELETE CASCADE, this is optional but safe)
        await supabase.from("reel_metadata").delete().eq("reel_id", id);
        await supabase.from("transcripts").delete().eq("reel_id", id);

        // Finally delete the reel
        const { error: deleteError } = await supabase
            .from("reels")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        return res.json({ success: true, message: "Reel deleted successfully" });
    } catch (error) {
        return res.status(500).json({ error: "Failed to delete reel", details: error.message });
    }
});


// POST /api/chat: Semantic Search and LLM Chat via RAG
app.post("/api/chat", authMiddleware, async (req, res) => {
    const { query, history = [] } = req.body;
    const userId = req.user.id;

    if (!query || !query.trim()) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        console.log(`[Chat] User ${userId} queried: "${query}"`);
        
        // 1. Build enriched search query using conversation context
        // This ensures follow-up queries like "how can i use it?" find the right reels
        let searchQuery = query;
        if (history && history.length > 0) {
            // Find the most recent assistant message to use as context
            const lastAiTurn = [...history].reverse().find(m => m.role === "assistant");
            if (lastAiTurn) {
                // Prepend first 150 chars of last AI response as topical context
                const aiContext = lastAiTurn.content.replace(/[#*`]/g, "").slice(0, 150);
                searchQuery = `${aiContext} ${query}`;
            }
        }

        // 1. Get embedding from Python AI Server
        const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
        const embedRes = await axios.post(`${pythonUrl}/embed`, { text: searchQuery });
        const queryEmbedding = embedRes.data.embedding;

        // 2. Perform Vector Cosine Similarity Search in Supabase via RPC
        const { data: matchedReels, error: rpcErr } = await supabase.rpc("match_reels", {
            query_embedding: queryEmbedding,
            match_threshold: 0.50, // Stricter threshold to get highly relevant context and avoid hallucinated citations
            match_count: 4,
            filter_user_id: userId
        });

        if (rpcErr) {
            console.error("[Chat] Supabase RPC error:", rpcErr);
            throw rpcErr;
        }

        const matchCount = matchedReels ? matchedReels.length : 0;
        console.log(`[Chat] Found ${matchCount} matching reels.`);

        // Log the search to search_history
        try {
            await supabase.from("search_history").insert({
                user_id: userId,
                search_query: query,
                results_count: matchCount
            });
        } catch (historyErr) {
            console.error("[Chat] Failed to log search history:", historyErr.message);
        }

        if (!matchedReels || matchedReels.length === 0) {
            const chatRes = await axios.post(`${pythonUrl}/chat`, {
                query,
                context: [],
                history
            });
            return res.json({
                answer: chatRes.data.answer,
                references: []
            });
        }

        // 3. Format context items for the Python LLM prompt
        const formattedContext = matchedReels.map((reel) => ({
            title: reel.title || "Untitled Save",
            summary: reel.summary || "",
            instagram_url: reel.instagram_url || "",
            author_username: reel.author_username || "unknown",
            plain_text: reel.plain_text || "",
            how_to_guide: reel.how_to_guide || null
        }));

        // 4. Send request to Python Chat endpoint
        const chatRes = await axios.post(`${pythonUrl}/chat`, {
            query,
            context: formattedContext,
            history
        });

        // 5. Build references list for frontend citation cards
        const references = matchedReels.map((reel) => ({
            id: reel.id,
            title: reel.title || "Untitled Save",
            author_username: reel.author_username || "unknown",
            instagram_url: reel.instagram_url,
            similarity: reel.similarity
        }));

        return res.json({
            answer: chatRes.data.answer,
            references
        });

    } catch (error) {
        console.error("[Chat] Error in semantic search / chat pipeline:", error.message);
        return res.status(500).json({ error: "Chat service encountered an error", details: error.message });
    }
});


// GET /api/collections: Get all collections for current user
app.get("/api/collections", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    try {
        const { data, error } = await supabase
            .from("collections")
            .select(`
                *,
                reel_collections (reel_id)
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch collections", details: error.message });
    }
});


// POST /api/collections: Create a new collection
app.post("/api/collections", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Collection name is required" });
    }

    try {
        const { data, error } = await supabase
            .from("collections")
            .insert({ user_id: userId, name: name.trim() })
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Failed to create collection", details: error.message });
    }
});


// POST /api/collections/:id/reels: Add a reel to a collection
app.post("/api/collections/:id/reels", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const collectionId = req.params.id;
    const { reelId } = req.body;

    if (!reelId) {
        return res.status(400).json({ error: "Reel ID is required" });
    }

    try {
        // Verify user owns this collection
        const { data: col, error: colErr } = await supabase
            .from("collections")
            .select("id")
            .eq("id", collectionId)
            .eq("user_id", userId)
            .single();

        if (colErr || !col) {
            return res.status(404).json({ error: "Collection not found or unauthorized" });
        }

        // Add join record
        const { error: insertErr } = await supabase
            .from("reel_collections")
            .insert({ reel_id: reelId, collection_id: collectionId });

        if (insertErr) {
            if (insertErr.code === "23505") { // Unique key constraint (already added)
                return res.json({ success: true, message: "Reel already exists in collection" });
            }
            throw insertErr;
        }

        return res.json({ success: true, message: "Reel added to collection successfully" });
    } catch (error) {
        return res.status(500).json({ error: "Failed to add reel to collection", details: error.message });
    }
});


// DELETE /api/collections/:id/reels/:reelId: Remove a reel from a collection
app.delete("/api/collections/:id/reels/:reelId", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const collectionId = req.params.id;
    const { reelId } = req.params;

    try {
        // Verify user owns this collection
        const { data: col, error: colErr } = await supabase
            .from("collections")
            .select("id")
            .eq("id", collectionId)
            .eq("user_id", userId)
            .single();

        if (colErr || !col) {
            return res.status(404).json({ error: "Collection not found or unauthorized" });
        }

        // Delete join record
        const { error: deleteErr } = await supabase
            .from("reel_collections")
            .delete()
            .eq("reel_id", reelId)
            .eq("collection_id", collectionId);

        if (deleteErr) throw deleteErr;

        return res.json({ success: true, message: "Reel removed from collection successfully" });
    } catch (error) {
        return res.status(500).json({ error: "Failed to remove reel from collection", details: error.message });
    }
});


// DELETE /api/collections/:id: Delete an entire collection
app.delete("/api/collections/:id", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const collectionId = req.params.id;

    try {
        const { error } = await supabase
            .from("collections")
            .delete()
            .eq("id", collectionId)
            .eq("user_id", userId);

        if (error) throw error;
        return res.json({ success: true, message: "Collection deleted successfully" });
    } catch (error) {
        return res.status(500).json({ error: "Failed to delete collection", details: error.message });
    }
});


// PATCH /api/reels/:id/metadata: Update curation notes, tags, and key takeaways
app.patch("/api/reels/:id/metadata", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { tags, keyTakeaways, notes } = req.body;

    try {
        // Verify ownership first
        const { data: reel, error: checkError } = await supabase
            .from("reels")
            .select("id")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (checkError || !reel) {
            return res.status(404).json({ error: "Reel not found or unauthorized" });
        }

        // Prepare updates
        const updates = {};
        if (tags !== undefined) updates.tags = tags;
        if (keyTakeaways !== undefined) updates.key_takeaways = keyTakeaways;
        if (notes !== undefined) updates.notes = notes;

        const { data, error } = await supabase
            .from("reel_metadata")
            .update(updates)
            .eq("reel_id", id)
            .select()
            .single();

        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: "Failed to update metadata", details: error.message });
    }
});


// KEEP EXISTING FOR BACKWARD COMPATIBILITY (if needed by frontend until updated)
app.post("/transcribe-reel", async (req, res) => {
    // ... existing implementation ...
    const url = req.body.url;
    if (!url) return res.status(400).json({ error: "URL required" });
    const audioPath = path.join(__dirname, "temp/audio_legacy.wav");
    try {
        const cleanUrl = url.split("?")[0];
        console.log(`[Legacy Endpoint] Downloading audio for ${cleanUrl}...`);
        const downloadCmd = `yt-dlp.exe -x --audio-format wav -o "${audioPath}" "${cleanUrl}"`;
        await execPromise(downloadCmd);
        console.log(`[Legacy Endpoint] Audio downloaded. Calling Python AI Server...`);
        const ai = await axios.post("http://localhost:8000/transcribe", { audio_path: audioPath });
        console.log(`[Legacy Endpoint] Transcription successful!`);
        res.json(ai.data);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    } catch (error) {
        console.error(`[Legacy Endpoint] Processing failed:`, error.message);
        res.status(500).json({ error: "Processing failed" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});