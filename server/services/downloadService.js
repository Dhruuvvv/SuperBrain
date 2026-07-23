const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const axios = require("axios");
const execYtDlp = require("yt-dlp-exec");

const execPromise = util.promisify(exec);
const isWindows = process.platform === "win32";

// Shell-safe argument escaper
function escapeShellArg(arg) {
    if (isWindows) {
        // Windows cmd.exe: wrap in quotes and escape internal quotes
        return `"${String(arg).replace(/"/g, '\\"')}"`;
    } else {
        // Unix bash: use single quotes and escape single quotes
        return `'${String(arg).replace(/'/g, "'\\''")}'`;
    }
}

// Locate or auto-download the most up-to-date yt-dlp binary available
async function getYtDlpBinary() {
    const exeName = isWindows ? "yt-dlp.exe" : "yt-dlp";
    // Check server directory first (server/yt-dlp.exe or server/yt-dlp)
    const serverExePath = path.resolve(__dirname, "../", exeName);
    if (fs.existsSync(serverExePath)) {
        return serverExePath;
    }
    // Check root project directory
    const rootExePath = path.resolve(__dirname, "../../", exeName);
    if (fs.existsSync(rootExePath)) {
        return rootExePath;
    }

    // On Linux/macOS, if local binary doesn't exist, download it automatically
    if (!isWindows) {
        console.log(`[downloadService] Linux yt-dlp binary not found. Downloading latest Linux release to ${serverExePath}...`);
        try {
            const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
            const response = await axios({
                method: "get",
                url: url,
                responseType: "arraybuffer",
                maxRedirects: 5,
                timeout: 45000
            });
            fs.writeFileSync(serverExePath, Buffer.from(response.data));
            fs.chmodSync(serverExePath, "755");
            console.log(`[downloadService] Linux yt-dlp binary ready at ${serverExePath}`);
            return serverExePath;
        } catch (err) {
            console.error(`[downloadService] Warning: Auto-download of Linux yt-dlp binary failed:`, err.message);
        }
    }

    // Fallback to system command name
    return exeName;
}

// Get configured yt-dlp-exec runner
async function getYtDlpRunner() {
    const binPath = await getYtDlpBinary();
    if (fs.existsSync(binPath)) {
        return execYtDlp.create(binPath);
    }
    return execYtDlp;
}

function validateCookiesPath(cookiesPath) {
    const exists = cookiesPath && fs.existsSync(cookiesPath);
    return cookiesPath && exists ? cookiesPath : null;
}

// Structured Pipeline Error Class
class PipelineError extends Error {
    constructor(message, stage, statusCode = 500, details = null) {
        super(message);
        this.name = "PipelineError";
        this.stage = stage;
        this.statusCode = statusCode;
        this.details = details;
    }
}

// Check if a CLI command exists on system PATH or as executable
async function isCommandAvailable(command) {
    try {
        const checkCmd = isWindows ? `where ${command}` : `which ${command}`;
        await execPromise(checkCmd);
        return true;
    } catch (_) {
        return false;
    }
}

// Helper to construct cookies flag options for yt-dlp-exec
function getCookiesFlags(cookiesPath) {
    const validPath = validateCookiesPath(cookiesPath);
    if (validPath) {
        return { cookies: validPath };
    }
    return {};
}

/**
 * Fetch Instagram metadata via yt-dlp-exec with fallback to resolved CLI
 */
async function fetchMetadata(cleanUrl, cookiesPath) {
    const runner = await getYtDlpRunner();
    const options = {
        dumpSingleJson: true,
        skipDownload: true,
        ignoreNoFormatsError: true,
        ...getCookiesFlags(cookiesPath)
    };

    try {
        const metadata = await runner(cleanUrl, options);
        if (typeof metadata === "string") {
            return JSON.parse(metadata);
        }
        return metadata;
    } catch (err) {
        console.error("[downloadService] fetchMetadata yt-dlp-exec error:", err.message || err);

        // Fallback: try direct CLI invocation with resolved binary
        try {
            const validCookies = validateCookiesPath(cookiesPath);
            const cookiesFlag = validCookies ? `--cookies "${validCookies}"` : "";
            const binPath = await getYtDlpBinary();
            const cmdBin = fs.existsSync(binPath) ? `"${binPath}"` : binPath;
            const metaCmd = `${cmdBin} --dump-single-json --skip-download --ignore-no-formats-error ${cookiesFlag} ${escapeShellArg(cleanUrl)}`;
            const { stdout } = await execPromise(metaCmd);
            return JSON.parse(stdout);
        } catch (cliErr) {
            console.error("[downloadService] fetchMetadata CLI fallback error:", cliErr.stderr || cliErr.message || cliErr);
            throw new PipelineError(
                "Failed to extract Instagram post metadata. The post might be private, deleted, or require updated login cookies.",
                "METADATA_FETCH",
                400,
                cliErr.stderr || cliErr.message || err.message
            );
        }
    }
}

/**
 * Download Video MP4
 */
async function downloadVideo(cleanUrl, videoOutputTemplate, tempDir, reelId, cookiesPath) {
    const runner = await getYtDlpRunner();
    const options = {
        format: "best[ext=mp4]/best/b",
        noPlaylist: true,
        mergeOutputFormat: "mp4",
        output: videoOutputTemplate,
        ...getCookiesFlags(cookiesPath)
    };

    try {
        await runner(cleanUrl, options);
    } catch (err) {
        console.error("[downloadService] downloadVideo runner error:", err.message || err);

        // Fallback to CLI execution if runner encounters issue
        try {
            const validCookies = validateCookiesPath(cookiesPath);
            const cookiesFlag = validCookies ? `--cookies "${validCookies}"` : "";
            const binPath = await getYtDlpBinary();
            const cmdBin = fs.existsSync(binPath) ? `"${binPath}"` : binPath;
            const downloadVideoCmd = `${cmdBin} -f "best[ext=mp4]/best/b" --no-playlist --merge-output-format mp4 -o "${videoOutputTemplate}" ${cookiesFlag} ${escapeShellArg(cleanUrl)}`;
            await execPromise(downloadVideoCmd);
        } catch (cliErr) {
            console.error("[downloadService] downloadVideo CLI fallback error:", cliErr.stderr || cliErr.message || cliErr);
            const rawErrStr = cliErr.stderr || cliErr.message || err.message || "Video download failed.";
            const cleanErrMsg = rawErrStr.includes("ERROR:") ? rawErrStr.split("ERROR:")[1].trim().split("\n")[0] : rawErrStr;
            throw new PipelineError(
                cleanErrMsg,
                "VIDEO_DOWNLOAD",
                400,
                rawErrStr
            );
        }
    }

    // Locate actual downloaded file in tempDir
    const tempFiles = fs.readdirSync(tempDir);
    const downloadedVideo = tempFiles.find(f => f.startsWith(`video_${reelId}.`));
    if (!downloadedVideo) {
        throw new PipelineError("Video downloaded but target file was not found in temporary directory.", "VIDEO_DOWNLOAD", 500);
    }

    return path.join(tempDir, downloadedVideo);
}

/**
 * Extract Audio mono WAV using ffmpeg
 */
async function extractAudio(videoPath, audioPath) {
    if (!videoPath || !fs.existsSync(videoPath)) return "";
    const extractAudioCmd = `ffmpeg -i "${videoPath}" -vn -ar 16000 -ac 1 -y "${audioPath}"`;
    try {
        await execPromise(extractAudioCmd);
        return audioPath;
    } catch (ffmpegErr) {
        console.warn("[downloadService] Audio extraction failed (video may be silent or ffmpeg missing):", ffmpegErr.message);
        return ""; // Safe fallback: treat as silent video
    }
}

/**
 * Extract thumbnail frame using ffmpeg
 */
async function extractThumbnailFrame(videoPath, localThumbnailPath) {
    if (!videoPath || !fs.existsSync(videoPath)) return false;
    const extractThumbCmd = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -y "${localThumbnailPath}"`;
    try {
        await execPromise(extractThumbCmd);
        return fs.existsSync(localThumbnailPath);
    } catch (err) {
        console.warn("[downloadService] Video thumbnail frame extraction warning:", err.message);
        return false;
    }
}

/**
 * Direct HTTP image downloader fallback using axios
 */
async function downloadImagesDirectly(instaMeta, tempDir, reelId, isCarousel) {
    console.log(`[downloadService] Image fallback triggered. Diagnosing instaMeta structure...`);
    console.log(`[downloadService] instaMeta type: ${typeof instaMeta}, keys: ${Object.keys(instaMeta || {}).slice(0, 10).join(', ')}${Object.keys(instaMeta || {}).length > 10 ? '...' : ''}`);

    const imageUrls = [];

    // Helper to safely extract candidate URL from an entry/metadata object
    const extractUrlFromObj = (obj) => {
        if (!obj || typeof obj !== "object") return null;
        if (obj.url && typeof obj.url === "string" && (obj.url.startsWith("http") || obj.url.startsWith("//"))) return obj.url;
        if (obj.display_url && typeof obj.display_url === "string") return obj.display_url;
        if (obj.thumbnail && typeof obj.thumbnail === "string") return obj.thumbnail;
        if (Array.isArray(obj.thumbnails) && obj.thumbnails.length > 0) {
            const lastThumb = obj.thumbnails[obj.thumbnails.length - 1];
            if (lastThumb && lastThumb.url) return lastThumb.url;
        }
        if (Array.isArray(obj.formats) && obj.formats.length > 0) {
            const lastFmt = obj.formats[obj.formats.length - 1];
            if (lastFmt && lastFmt.url) return lastFmt.url;
        }
        return null;
    };

    if (isCarousel && instaMeta.entries && Array.isArray(instaMeta.entries)) {
        console.log(`[downloadService] Carousel detected: ${instaMeta.entries.length} entries found`);
        instaMeta.entries.forEach((entry, idx) => {
            console.log(`[downloadService] Entry ${idx} keys:`, Object.keys(entry || {}).slice(0, 8).join(', '));
            const url = extractUrlFromObj(entry);
            if (url) {
                imageUrls.push(url);
                console.log(`[downloadService] Entry ${idx}: URL extracted: ${url.substring(0, 60)}...`);
            } else {
                console.warn(`[downloadService] Entry ${idx}: No URL found in entry object`);
            }
        });
    }

    if (imageUrls.length === 0) {
        console.log(`[downloadService] No carousel URLs found. Attempting single image extraction...`);
        const singleUrl = extractUrlFromObj(instaMeta);
        if (singleUrl) {
            imageUrls.push(singleUrl);
            console.log(`[downloadService] Single image URL extracted: ${singleUrl.substring(0, 60)}...`);
        } else {
            console.warn(`[downloadService] Single image fallback: No URL found in instaMeta object`);
        }
    }

    if (imageUrls.length === 0) {
        console.error(`[downloadService] CRITICAL: No image URLs extracted. Full instaMeta keys:`, Object.keys(instaMeta || {}));
        throw new PipelineError("No valid image download URLs found in post metadata.", "IMAGE_DOWNLOAD", 400);
    }

    for (let i = 0; i < imageUrls.length; i++) {
        const imgUrl = imageUrls[i];
        const extMatch = imgUrl.match(/\.(jpg|jpeg|png|webp)/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
        const fileName = isCarousel ? `img_${reelId}_${i + 1}.${ext}` : `img_${reelId}.${ext}`;
        const filePath = path.join(tempDir, fileName);

        try {
            const response = await axios({
                method: "get",
                url: imgUrl,
                responseType: "arraybuffer",
                timeout: 15000
            });
            fs.writeFileSync(filePath, Buffer.from(response.data));
            console.log(`[downloadService] Direct image download saved: ${fileName}`);
        } catch (dlErr) {
            console.warn(`[downloadService] Failed to fetch image ${i + 1} from ${imgUrl}:`, dlErr.message);
        }
    }
}

/**
 * Download images using gallery-dl if available, or direct HTTP download using axios fallback
 */
async function downloadImages(cleanUrl, tempDir, reelId, cookiesPath, instaMeta, isCarousel = false) {
    const validCookies = validateCookiesPath(cookiesPath);
    const dlCookiesFlag = validCookies ? `-C "${validCookies}"` : "";
    const filenamePattern = isCarousel ? `img_${reelId}_{num}.{extension}` : `img_${reelId}.{extension}`;
    const downloadImgCmd = `gallery-dl ${dlCookiesFlag} -d "${tempDir}" -o directory="" -f "${filenamePattern}" ${escapeShellArg(cleanUrl)}`;

    const hasGalleryDl = await isCommandAvailable("gallery-dl");

    if (hasGalleryDl) {
        try {
            await execPromise(downloadImgCmd);
        } catch (err) {
            console.warn("[downloadService] gallery-dl execution failed, falling back to direct HTTP download:", err.message);
        }
    } else {
        console.log("[downloadService] gallery-dl not found in system environment; using direct HTTP image downloader.");
    }

    // Direct HTTP download fallback if gallery-dl did not download files
    const tempFiles = fs.readdirSync(tempDir);
    const existingImgs = tempFiles.filter(f => f.startsWith(`img_${reelId}`));

    if (existingImgs.length === 0) {
        console.log("[downloadService] Direct HTTP image download fallback initiating...");
        await downloadImagesDirectly(instaMeta, tempDir, reelId, isCarousel);
    }

    // Find all downloaded images
    const updatedTempFiles = fs.readdirSync(tempDir);
    let imagePaths = [];
    if (isCarousel) {
        imagePaths = updatedTempFiles
            .filter(f => f.startsWith(`img_${reelId}_`))
            .sort((a, b) => {
                const aMatch = a.match(/_(\d+)\.[^.]+$/);
                const bMatch = b.match(/_(\d+)\.[^.]+$/);
                if (aMatch && bMatch) return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10);
                return a.localeCompare(b);
            })
            .map(f => path.join(tempDir, f));
    } else {
        const imgFile = updatedTempFiles.find(f => f.startsWith(`img_${reelId}.`));
        if (imgFile) {
            imagePaths = [path.join(tempDir, imgFile)];
        }
    }

    if (imagePaths.length === 0) {
        throw new PipelineError(
            `Failed to download image ${isCarousel ? "carousel" : "content"}. Media URLs could not be fetched.`,
            "IMAGE_DOWNLOAD",
            400
        );
    }

    return imagePaths;
}

/**
 * Download audio for legacy endpoint using yt-dlp-exec
 */
async function downloadAudioLegacy(cleanUrl, audioPath, cookiesPath) {
    const runner = await getYtDlpRunner();
    const options = {
        extractAudio: true,
        audioFormat: "wav",
        output: audioPath,
        ...getCookiesFlags(cookiesPath)
    };

    try {
        await runner(cleanUrl, options);
    } catch (err) {
        console.error("[downloadService] downloadAudioLegacy runner error:", err.message || err);

        // Fallback to CLI
        try {
            const validCookies = validateCookiesPath(cookiesPath);
            const cookiesFlag = validCookies ? `--cookies "${validCookies}"` : "";
            const binPath = await getYtDlpBinary();
            const cmdBin = fs.existsSync(binPath) ? `"${binPath}"` : binPath;
            const downloadCmd = `${cmdBin} -x --audio-format wav -o "${audioPath}" ${cookiesFlag} ${escapeShellArg(cleanUrl)}`;
            await execPromise(downloadCmd);
        } catch (cliErr) {
            console.error("[downloadService] downloadAudioLegacy CLI fallback error:", cliErr.stderr || cliErr.message || cliErr);
            throw new PipelineError("Audio download failed for legacy transcription endpoint.", "AUDIO_DOWNLOAD", 500, cliErr.stderr || cliErr.message);
        }
    }

    if (!fs.existsSync(audioPath)) {
        throw new PipelineError("Audio download failed for legacy transcription endpoint.", "AUDIO_DOWNLOAD", 500);
    }
    return audioPath;
}

module.exports = {
    PipelineError,
    isCommandAvailable,
    getYtDlpBinary,
    fetchMetadata,
    downloadVideo,
    extractAudio,
    extractThumbnailFrame,
    downloadImages,
    downloadAudioLegacy
};
