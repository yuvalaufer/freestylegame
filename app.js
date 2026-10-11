let currentPreviewUrl = "";

document.addEventListener("DOMContentLoaded", async () => {
    applyConfig();
    await initApp();
});

function applyConfig() {
    const cfg = window.GAME_CONFIG || {};
    const root = document.documentElement;

    if (cfg.fallbackBgColor) root.style.setProperty('--bg-color', cfg.fallbackBgColor);
    if (cfg.textColor) root.style.setProperty('--text-color', cfg.textColor);
    if (cfg.accentColor) root.style.setProperty('--accent-color', cfg.accentColor);
    if (cfg.playerBoxBg) root.style.setProperty('--player-box-bg', cfg.playerBoxBg);
    if (typeof cfg.overlayOpacity === 'number') root.style.setProperty('--overlay-opacity', cfg.overlayOpacity);
    if (cfg.logoWidth) root.style.setProperty('--logo-width', cfg.logoWidth);

    const titleEl = document.getElementById("game-title");
    const subEl = document.getElementById("game-subtitle");
    const promptEl = document.getElementById("prompt-text");

    if (titleEl && cfg.gameTitle) titleEl.textContent = cfg.gameTitle;
    if (subEl && cfg.subtitle) subEl.textContent = cfg.subtitle;
    if (promptEl && cfg.promptText) promptEl.textContent = cfg.promptText;

    const bgContainer = document.getElementById("background-container");
    if (bgContainer && cfg.bgPath) {
        bgContainer.style.backgroundImage = `url('${cfg.bgPath}')`;
    }

    const logoImg = document.getElementById("logo-img");
    if (logoImg) {
        if (cfg.logoPath) {
            logoImg.src = cfg.logoPath;
            logoImg.onerror = () => logoImg.classList.add("hidden");
        } else {
            logoImg.classList.add("hidden");
        }
    }
}

async function loadTracklist() {
    try {
        const response = await fetch("tracklist.txt", { cache: "no-store" });
        if (!response.ok) throw new Error("לא ניתן לטעון את קובץ הרשימה");
        const text = await response.text();
        return parseTracklist(text);
    } catch (err) {
        console.error(err);
        return { songs: [], errors: ["שגיאה בטעינת קובץ tracklist.txt"] };
    }
}

function parseTracklist(rawText) {
    const lines = rawText.split(/\r?\n/);
    const songs = [];
    const errors = [];

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        const match = trimmed.match(/^(.*?)\s+(https:\/\/drive\.google\.com\S+)$/i);
        if (!match) {
            errors.push(`שורה ${lineNum}: שורה פגומה או פורמט לא תקין`);
            return;
        }

        const title = match[1].trim();
        const urlStr = match[2].trim();

        const fileIdData = extractDriveFileInfo(urlStr);
        if (!fileIdData) {
            errors.push(`שורה ${lineNum}: קישור Google Drive אינו חוקי או חסר מזהה`);
            return;
        }

        const { fileId, resourceKey } = fileIdData;
        songs.push({ title, fileId, resourceKey });
    });

    return { songs, errors };
}

function extractDriveFileInfo(urlStr) {
    try {
        const url = new URL(urlStr);
        if (!url.hostname.endsWith("drive.google.com")) return null;

        let fileId = null;
        let resourceKey = url.searchParams.get("resourcekey");

        const pathMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (pathMatch) {
            fileId = pathMatch[1];
        } else {
            fileId = url.searchParams.get("id");
        }

        if (!fileId) return null;
        return { fileId, resourceKey };
    } catch (e) {
        return null;
    }
}

async function initApp() {
    const container = document.getElementById("player-content");
    const { songs, errors } = await loadTracklist();

    if (songs.length === 0) {
        let errorDetails = errors.length > 0 ? `<br><small style="opacity:0.7">${errors.join(", ")}</small>` : "";
        container.innerHTML = `<div class="message-box">לא נמצאו שירים תקינים ברשימה.${errorDetails}</div>`;
        return;
    }

    // הגרלת שיר אקראי
    const randomIndex = Math.floor(Math.random() * songs.length);
    const song = songs[randomIndex];

    currentPreviewUrl = `https://drive.google.com/file/d/${song.fileId}/preview`;
    if (song.resourceKey) {
        currentPreviewUrl += `?resourcekey=${song.resourceKey}`;
    }

    container.innerHTML = `
        <div class="iframe-container">
            <iframe id="drive-iframe" src="${currentPreviewUrl}" allow="autoplay" loading="lazy"></iframe>
        </div>
        <div class="controls-container">
            <button class="btn-control btn-stop" onclick="stopAudio()">עצור / השהה אודיו ⏹️</button>
            <button class="btn-control" onclick="initApp()">שיר אקראי נוסף 🎲</button>
        </div>
    `;
}

function stopAudio() {
    const iframe = document.getElementById("drive-iframe");
    if (iframe) {
        // רענון ה-iframe כדי לעצור מיידית את האודיו המתנגן
        iframe.src = "about:blank";
        setTimeout(() => {
            iframe.src = currentPreviewUrl;
        }, 100);
    }
}
