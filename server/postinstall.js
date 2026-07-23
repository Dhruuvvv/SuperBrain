const path = require("path");
const fs = require("fs");
const axios = require("axios");

const isWindows = process.platform === "win32";

async function setupYtDlp() {
    const exeName = isWindows ? "yt-dlp.exe" : "yt-dlp";
    const targetPath = path.resolve(__dirname, exeName);

    if (fs.existsSync(targetPath)) {
        console.log(`[postinstall] ${exeName} already exists at ${targetPath}.`);
        return;
    }

    if (!isWindows) {
        console.log(`[postinstall] Linux environment detected. Downloading latest Linux yt-dlp binary to ${targetPath}...`);
        try {
            const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
            const response = await axios({
                method: "get",
                url: url,
                responseType: "arraybuffer",
                maxRedirects: 5,
                timeout: 60000
            });
            fs.writeFileSync(targetPath, Buffer.from(response.data));
            fs.chmodSync(targetPath, "755");
            console.log(`[postinstall] Successfully downloaded Linux yt-dlp binary (chmod 755).`);
        } catch (err) {
            console.error(`[postinstall] Warning: Failed to download Linux yt-dlp binary during postinstall:`, err.message);
        }
    } else {
        console.log(`[postinstall] Windows environment detected. Using local ${exeName}.`);
    }
}

setupYtDlp();
