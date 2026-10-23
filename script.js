
const video = document.getElementById("video");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const countdown = document.getElementById("countdown");
const statusText = document.getElementById("status");

const startCameraButton = document.getElementById("startCamera");
const startSessionButton = document.getElementById("startSession");
const stopCameraButton = document.getElementById("stopCamera");
const downloadButton = document.getElementById("download");
const retakeButton = document.getElementById("retake");

const stripCanvas = document.getElementById("stripCanvas");
const ctx = stripCanvas.getContext("2d");
const emptyStrip = document.getElementById("emptyStrip");
const shotCount = document.getElementById("shotCount");
const resultMessage = document.getElementById("resultMessage");
const captionInput = document.getElementById("caption");

let cameraStream = null;
let photos = [];
let selectedFilter = "original";
let selectedSticker = "♡";
let isTakingPhotos = false;
let sessionNumber = 0;

const FILTERS = {
    original: "none",
    rosy: "saturate(1.15) sepia(0.12) hue-rotate(315deg)",
    vintage: "sepia(0.55) contrast(0.9) saturate(0.8)",
    mono: "grayscale(1)"
};

function setStatus(message) {
    statusText.textContent = message;
}

function updateButtons() {
    startCameraButton.disabled = Boolean(cameraStream);
    stopCameraButton.disabled = !cameraStream;
    startSessionButton.disabled = !cameraStream || isTakingPhotos;
    downloadButton.disabled = photos.length !== 4;
    retakeButton.disabled = photos.length === 0 && !isTakingPhotos;
}

function updatePhotoCount() {
    shotCount.textContent = `${photos.length} / 4 photos`;
    emptyStrip.hidden = photos.length > 0;

    if (photos.length === 4) {
        resultMessage.textContent = "Your little memories are ready! ♡";
    } else if (photos.length > 0) {
        resultMessage.textContent = "Looking cute already. One more moment at a time ♡";
    } else {
        resultMessage.textContent = "Your little collection is waiting to be made.";
    }

    updateButtons();
}

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("Your browser cannot access the camera here. Open the site using HTTPS or localhost.");
        return;
    }

    try {
        setStatus("Asking for camera permission…");

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = cameraStream;
        video.style.transform = "scaleX(-1)";
        cameraPlaceholder.hidden = true;

        await video.play();

        setStatus("Camera ready! Let's make some memories. ♡");
        updateButtons();
    } catch (error) {
        cameraStream = null;

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            setStatus("Camera permission was denied. Allow camera access in your browser settings, then try again.");
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            setStatus("No camera was found. Connect a camera and try again.");
        } else {
            setStatus("We couldn't start the camera. Check that it isn't being used by another app, then try again.");
        }

        updateButtons();
    }
}

function stopCamera() {
    sessionNumber++;

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    cameraStream = null;
    video.srcObject = null;
    video.style.transform = "";
    cameraPlaceholder.hidden = false;

    isTakingPhotos = false;
    countdown.textContent = "";

    setStatus("Camera turned off. Your captured photos are still here until you start again.");
    updateButtons();
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function takePhotoSession() {
    if (!cameraStream || isTakingPhotos) return;

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        setStatus("Your camera is still starting. Please try again in a moment.");
        return;
    }

    isTakingPhotos = true;
    sessionNumber++;

    const thisSession = sessionNumber;
    photos = [];
    renderStrip();
    updatePhotoCount();
    updateButtons();

    setStatus("Get close, smile, and make it a memory! ♡");

    try {
        for (let i = 0; i < 4; i++) {
            for (let number = 3; number >= 1; number--) {
                if (thisSession !== sessionNumber || !cameraStream) return;

                countdown.textContent = number;
                await wait(1000);
            }

            if (thisSession !== sessionNumber || !cameraStream) return;

            countdown.textContent = "♡";

            const photoCanvas = document.createElement("canvas");
            photoCanvas.width = video.videoWidth || 1280;
            photoCanvas.height = video.videoHeight || 720;

            const photoContext = photoCanvas.getContext("2d");

            // Mirror the captured photo to match the live selfie preview.
            photoContext.translate(photoCanvas.width, 0);
            photoContext.scale(-1, 1);
            photoContext.drawImage(
                video,
                0,
                0,
                photoCanvas.width,
                photoCanvas.height
            );

            photos.push(photoCanvas);
            renderStrip();
            updatePhotoCount();

            await wait(500);
            countdown.textContent = "";

            if (i < 3) {
                await wait(400);
            }
        }

        setStatus("Four photos captured! Choose your favorite look and download your strip. ♡");
    } catch (error) {
        setStatus("Something went wrong while taking photos. Please try again.");
    } finally {
        if (thisSession === sessionNumber) {
            isTakingPhotos = false;
            countdown.textContent = "";
            updateButtons();
        }
    }
}

function drawCoverImage(image, x, y, width, height) {
    const imageRatio = image.width / image.height;
    const targetRatio = width / height;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.width;
    let sourceHeight = image.height;

    if (imageRatio > targetRatio) {
        sourceWidth = image.height * targetRatio;
        sourceX = (image.width - sourceWidth) / 2;
    } else {
        sourceHeight = image.width / targetRatio;
        sourceY = (image.height - sourceHeight) / 2;
    }

    ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        width,
        height
    );
}

function renderStrip() {
    const width = stripCanvas.width;
    const height = stripCanvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff8f5";
    ctx.fillRect(0, 0, width, height);

    // Decorative photo-strip heading.
    ctx.fillStyle = "#8e5364";
    ctx.textAlign = "center";
    ctx.font = "bold 30px Georgia, serif";
    ctx.fillText("our little universe ♡", width / 2, 55);

    ctx.fillStyle = "#b47c89";
    ctx.font = "18px Georgia, serif";
    ctx.fillText("YOU + ME, ALWAYS", width / 2, 88);

    const margin = 30;
    const photoWidth = width - margin * 2;
    const photoHeight = 300;
    const gap = 28;
    const firstY = 120;

    photos.forEach((photo, index) => {
        const x = margin;
        const y = firstY + index * (photoHeight + gap);

        ctx.save();

        ctx.shadowColor = "rgba(100, 50, 65, 0.15)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);

        ctx.shadowColor = "transparent";
        ctx.filter = FILTERS[selectedFilter] || "none";

        drawCoverImage(photo, x, y, photoWidth, photoHeight);

        ctx.filter = "none";

        if (selectedSticker) {
            ctx.font = "38px Georgia, serif";
            ctx.textAlign = "right";
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "rgba(80, 30, 40, 0.45)";
            ctx.shadowBlur = 5;
            ctx.fillText(selectedSticker, x + photoWidth - 15, y + 45);
        }

        ctx.restore();

        ctx.fillStyle = "#9b6877";
        ctx.font = "17px Georgia, serif";
        ctx.textAlign = "left";
        ctx.fillText(`moment ${index + 1} ♡`, margin + 3, y + photoHeight + 22);
    });

    // Personal love note at the bottom of the strip.
    ctx.fillStyle = "#78495a";
    ctx.textAlign = "center";
    ctx.font = "italic 26px Georgia, serif";

    const caption = captionInput.value.trim() || "my favorite person ♡";
    ctx.fillText(caption, width / 2, 1515, width - 40);

    ctx.fillStyle = "#b47c89";
    ctx.font = "17px Georgia, serif";
    ctx.fillText("made with love ♡", width / 2, 1555);

    updatePhotoCount();
}

function resetSession() {
    sessionNumber++;
    isTakingPhotos = false;
    photos = [];
    countdown.textContent = "";

    renderStrip();
    updatePhotoCount();

    setStatus(
        cameraStream
            ? "Ready for another set of four photos! ♡"
            : "Turn on your camera whenever you're ready."
    );
}

function downloadStrip() {
    if (photos.length !== 4) {
        setStatus("Take all four photos before downloading your strip.");
        return;
    }

    renderStrip();

    stripCanvas.toBlob(blob => {
        if (!blob) {
            setStatus("We couldn't create your download. Please try again.");
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "our-little-universe-photo-strip.png";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus("Your photo strip has been downloaded. Keep this little memory safe! ♡");
    }, "image/png");
}

// Camera controls
startCameraButton.addEventListener("click", startCamera);
stopCameraButton.addEventListener("click", stopCamera);
startSessionButton.addEventListener("click", takePhotoSession);
retakeButton.addEventListener("click", resetSession);
downloadButton.addEventListener("click", downloadStrip);

// Filter selection
document.querySelectorAll(".filter-option").forEach(button => {
    button.addEventListener("click", () => {
        selectedFilter = button.dataset.filter || "original";

        document.querySelectorAll(".filter-option").forEach(option => {
            option.classList.toggle("active", option === button);
            option.setAttribute("aria-pressed", option === button ? "true" : "false");
        });

        renderStrip();
    });
});

// Sticker selection
document.querySelectorAll(".sticker-option").forEach(button => {
    button.addEventListener("click", () => {
        selectedSticker = button.dataset.sticker || "";

        document.querySelectorAll(".sticker-option").forEach(option => {
            option.classList.toggle("active", option === button);
            option.setAttribute("aria-pressed", option === button ? "true" : "false");
        });

        renderStrip();
    });
});

// Update the strip when the love note changes.
captionInput.addEventListener("input", renderStrip);

// Keep the camera off if the page is closed or refreshed.
window.addEventListener("pagehide", () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});

// Initial state
document.querySelectorAll(".filter-option, .sticker-option").forEach(button => {
    button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
});

renderStrip();
updatePhotoCount();
