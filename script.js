
const video = document.getElementById("video");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const countdown = document.getElementById("countdown");
const posePrompt = document.getElementById("posePrompt");
const statusText = document.getElementById("status");

const startCameraButton = document.getElementById("startCamera");
const startSessionButton = document.getElementById("startSession");
const stopCameraButton = document.getElementById("stopCamera");
const downloadButton = document.getElementById("download");
const retakeButton = document.getElementById("retake");
const startRecordingButton = document.getElementById("startRecording");
const stopRecordingButton = document.getElementById("stopRecording");
const recordingStatus = document.getElementById("recordingStatus");
const cameraCard = document.querySelector(".camera-card");
const recordingResult = document.getElementById("recordingResult");
const recordedVideo = document.getElementById("recordedVideo");
const downloadVideo = document.getElementById("downloadVideo");

const stripCanvas = document.getElementById("stripCanvas");
const ctx = stripCanvas.getContext("2d");
const emptyStrip = document.getElementById("emptyStrip");
const shotCount = document.getElementById("shotCount");
const resultMessage = document.getElementById("resultMessage");
const captionInput = document.getElementById("caption");
const letterInput = document.getElementById("letterInput");
const letterEnvelope = document.getElementById("letterEnvelope");
const envelopeButton = document.getElementById("envelopeButton");
const envelopeButtonLabel = document.getElementById("envelopeButtonLabel");
const letterReveal = document.getElementById("letterReveal");
const letterPreview = document.getElementById("letterPreview");
const letterStatus = document.getElementById("letterStatus");

let cameraStream = null;
let photos = [];
let selectedFilter = "original";
let selectedPhotoCount = 4;
let selectedPoseStyle = "sweet";
let isTakingPhotos = false;
let isLetterSealed = false;
let mediaRecorder = null;
let isRecording = false;
let recordingTimer = null;
let recordingStartedAt = 0;
let recordedVideoUrl = null;
let recordingCanvas = null;
let recordingContext = null;
let recordingStream = null;
let recordingFrameId = null;
let sessionNumber = 0;

const FILTERS = {
    original: "none",
    rosy: "saturate(1.15) sepia(0.12) hue-rotate(315deg)",
    vintage: "sepia(0.55) contrast(0.9) saturate(0.8)",
    mono: "grayscale(1)"
};

const POSE_STYLES = {
    sweet: ["Give a little wave ♡", "Make a tiny heart with your hands", "Lean in close", "Share your favorite smile"],
    playful: ["Make your silliest face", "Throw up a peace sign ✌", "Look surprised!", "Strike your superstar pose ✨"],
    cozy: ["Rest your cheek on your hand", "Give yourself a gentle hug", "Snuggle in close", "Close your eyes and smile ☁"]
};

function applyVideoFilter() {
    video.style.filter = FILTERS[selectedFilter] || "none";
}

function setStatus(message) {
    statusText.textContent = message;
}

function updateButtons() {
    startCameraButton.disabled = Boolean(cameraStream);
    stopCameraButton.disabled = !cameraStream;
    startSessionButton.disabled = !cameraStream || isTakingPhotos;
    startRecordingButton.disabled = !cameraStream || isTakingPhotos || isRecording;
    startRecordingButton.hidden = isRecording;
    stopRecordingButton.hidden = !isRecording;
    downloadButton.disabled = photos.length !== selectedPhotoCount;
    retakeButton.disabled = photos.length === 0 && !isTakingPhotos;
    document.querySelectorAll(".session-count-option, .pose-option").forEach(button => {
        button.disabled = isTakingPhotos;
    });
}

function updatePhotoCount() {
    shotCount.textContent = `${photos.length} / ${selectedPhotoCount} photos`;
    emptyStrip.hidden = photos.length > 0;
    stripCanvas.hidden = photos.length === 0;
    startSessionButton.textContent = `Take ${selectedPhotoCount} photos ✨`;

    if (photos.length === selectedPhotoCount) {
        resultMessage.textContent = "Your photo memories are ready! ♡";
    } else if (photos.length > 0) {
        resultMessage.textContent = "Looking great! Keep going to finish your set ♡";
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
        applyVideoFilter();
        cameraPlaceholder.hidden = true;

        await video.play();

        setStatus("Camera ready! Let's make some memories. ♡");
        startRecording();
        updateButtons();
    } catch (error) {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        cameraStream = null;
        video.srcObject = null;
        cameraPlaceholder.hidden = false;

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            setStatus("Camera permission was denied. Allow camera access in your browser settings, then try again.");
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            setStatus("No camera was found. Connect a camera and try again.");
        } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
            setStatus("The camera is busy in another app. Close it there and try again.");
        } else {
            setStatus("We couldn't start the camera. Allow access and open this page on HTTPS or localhost.");
        }

        updateButtons();
    }
}

function stopCamera() {
    sessionNumber++;

    if (isRecording) {
        stopRecording();
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    cameraStream = null;
    video.srcObject = null;
    video.style.transform = "";
    video.style.filter = "";
    cameraPlaceholder.hidden = false;

    isTakingPhotos = false;
    countdown.textContent = "";
    posePrompt.textContent = "";

    setStatus("Camera turned off. Your captured photos are still here until you start again.");
    updateButtons();
}

function formatRecordingTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function startRecording() {
    if (!cameraStream || isRecording) return;

    if (!window.MediaRecorder) {
        recordingStatus.textContent = "Video recording isn't supported by this browser.";
        return;
    }

    const supportedTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4"
    ];
    const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type));
    const options = mimeType ? { mimeType } : undefined;
    const chunks = [];

    try {
        recordingCanvas = document.createElement("canvas");
        recordingCanvas.width = video.videoWidth || 1280;
        recordingCanvas.height = video.videoHeight || 720;
        recordingContext = recordingCanvas.getContext("2d");

        if (!recordingContext || !recordingCanvas.captureStream) {
            throw new Error("Filtered video recording isn't supported by this browser.");
        }

        const recordingWidth = recordingCanvas.width;
        const recordingHeight = recordingCanvas.height;
        const drawFilteredFrame = () => {
            if (!recordingContext || !isRecording) return;

            recordingContext.clearRect(0, 0, recordingWidth, recordingHeight);
            recordingContext.save();
            recordingContext.translate(recordingWidth, 0);
            recordingContext.scale(-1, 1);
            recordingContext.filter = FILTERS[selectedFilter] || "none";
            recordingContext.drawImage(video, 0, 0, recordingWidth, recordingHeight);
            recordingContext.restore();
            recordingFrameId = requestAnimationFrame(drawFilteredFrame);
        };

        isRecording = true;
        drawFilteredFrame();
        recordingStream = recordingCanvas.captureStream(30);
        cameraStream.getAudioTracks().forEach(track => recordingStream.addTrack(track));

        const recorder = new MediaRecorder(recordingStream, options);
        mediaRecorder = recorder;

        recorder.addEventListener("dataavailable", event => {
            if (event.data && event.data.size > 0) chunks.push(event.data);
        });

        recorder.addEventListener("stop", () => {
            if (recordingFrameId !== null) cancelAnimationFrame(recordingFrameId);
            recordingFrameId = null;
            recordingStream?.getTracks().forEach(track => track.stop());
            recordingStream = null;
            recordingCanvas = null;
            recordingContext = null;
            clearInterval(recordingTimer);
            recordingTimer = null;
            isRecording = false;
            cameraCard.classList.remove("is-recording");
            updateButtons();

            if (chunks.length === 0) {
                recordingStatus.textContent = "No video was captured. Please try recording again.";
                return;
            }

            const type = recorder.mimeType || chunks[0].type || "video/webm";
            const clip = new Blob(chunks, { type });
            if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);

            recordedVideoUrl = URL.createObjectURL(clip);
            recordedVideo.src = recordedVideoUrl;
            recordingResult.hidden = false;
            downloadVideo.href = recordedVideoUrl;
            downloadVideo.download = `our-little-universe-video-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`;
            recordingStatus.textContent = "Your video memory is ready to preview or download ♡";
        });

        recorder.addEventListener("error", () => {
            if (recordingFrameId !== null) cancelAnimationFrame(recordingFrameId);
            recordingFrameId = null;
            recordingStream?.getTracks().forEach(track => track.stop());
            recordingStream = null;
            recordingCanvas = null;
            recordingContext = null;
            clearInterval(recordingTimer);
            recordingTimer = null;
            isRecording = false;
            cameraCard.classList.remove("is-recording");
            recordingStatus.textContent = "Recording stopped unexpectedly. Please try again.";
            updateButtons();
        });

        recorder.start(250);
        recordingStartedAt = Date.now();
        cameraCard.classList.add("is-recording");
        recordingStatus.textContent = "Recording 00:00 · click Stop recording when you're done.";
        recordingTimer = setInterval(() => {
            recordingStatus.textContent = `Recording ${formatRecordingTime(Date.now() - recordingStartedAt)} · click Stop recording when you're done.`;
        }, 500);
        updateButtons();
    } catch (error) {
        isRecording = false;
        if (recordingFrameId !== null) cancelAnimationFrame(recordingFrameId);
        recordingFrameId = null;
        recordingStream?.getTracks().forEach(track => track.stop());
        recordingStream = null;
        recordingCanvas = null;
        recordingContext = null;
        recordingStatus.textContent = "Couldn't start filtered recording. You can still take photos; check browser video-recording support.";
        cameraCard.classList.remove("is-recording");
        updateButtons();
    }
}

function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    isRecording = false;
    clearInterval(recordingTimer);
    recordingTimer = null;
    cameraCard.classList.remove("is-recording");
    recordingStatus.textContent = "Saving your video memory…";
    if (recordingFrameId !== null) cancelAnimationFrame(recordingFrameId);
    recordingFrameId = null;
    updateButtons();
    mediaRecorder.stop();
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

    setStatus("Get ready, strike a pose, and make a memory! ♡");
    const poses = POSE_STYLES[selectedPoseStyle];

    try {
        for (let i = 0; i < selectedPhotoCount; i++) {
            posePrompt.textContent = poses[i];
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

            if (i < selectedPhotoCount - 1) {
                await wait(400);
            }
        }

        setStatus(`${selectedPhotoCount} photos captured! Choose your favorite look and download your strip. ♡`);
    } catch (error) {
        setStatus("Something went wrong while taking photos. Please try again.");
    } finally {
        if (thisSession === sessionNumber) {
            isTakingPhotos = false;
            countdown.textContent = "";
            posePrompt.textContent = "";
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

function drawBow(x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 48, size / 48);
    ctx.fillStyle = "#f39ab5";
    ctx.strokeStyle = "#fff4f7";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(23, 24);
    ctx.bezierCurveTo(12, 8, 2, 10, 5, 21);
    ctx.bezierCurveTo(7, 28, 16, 29, 23, 25);
    ctx.bezierCurveTo(15, 33, 12, 43, 19, 42);
    ctx.bezierCurveTo(24, 41, 25, 32, 24, 25);
    ctx.bezierCurveTo(35, 9, 47, 10, 44, 21);
    ctx.bezierCurveTo(42, 28, 32, 29, 25, 25);
    ctx.bezierCurveTo(33, 33, 36, 43, 29, 42);
    ctx.bezierCurveTo(24, 41, 23, 32, 24, 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e982a2";
    ctx.beginPath();
    ctx.arc(24, 24, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function renderStrip() {
    const width = 640;
    const height = 265 + selectedPhotoCount * 295;
    const photoX = 88;
    const photoWidth = 464;
    const photoHeight = 250;
    const firstPhotoY = 132;

    if (stripCanvas.width !== width || stripCanvas.height !== height) {
        stripCanvas.width = width;
        stripCanvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f4afc2";
    ctx.fillRect(0, 0, width, height);

    // Double-mat background gives the download a printed photo-booth frame.
    ctx.fillStyle = "#fff7f6";
    ctx.fillRect(18, 18, width - 36, height - 36);
    ctx.strokeStyle = "#ef9eb6";
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, width - 56, height - 56);
    ctx.strokeStyle = "#f7ced8";
    ctx.lineWidth = 1;
    ctx.strokeRect(35, 35, width - 70, height - 70);
    stripCanvas.setAttribute("aria-label", `Preview of your ${selectedPhotoCount}-photo decorated photo strip`);

    ctx.fillStyle = "#a7516e";
    ctx.textAlign = "center";
    ctx.font = "bold 27px Georgia, serif";
    ctx.fillText("♡  OUR LITTLE UNIVERSE  ♡", width / 2, 75);

    ctx.fillStyle = "#bd7189";
    ctx.font = "15px Georgia, serif";
    ctx.fillText("a little moment to keep", width / 2, 101);

    photos.forEach((photo, index) => {
        const x = photoX;
        const y = firstPhotoY + index * 295;

        ctx.save();
        ctx.shadowColor = "rgba(111, 51, 72, 0.2)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#f4b0c2";
        ctx.fillRect(x - 9, y - 9, photoWidth + 18, photoHeight + 18);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff8f7";
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);

        ctx.beginPath();
        ctx.rect(x, y, photoWidth, photoHeight);
        ctx.clip();
        ctx.filter = FILTERS[selectedFilter] || "none";
        drawCoverImage(photo, x, y, photoWidth, photoHeight);
        ctx.filter = "none";
        ctx.restore();

        const bowX = index % 2 === 0 ? x - 19 : x + photoWidth - 28;
        const bowY = index % 2 === 0 ? y - 23 : y + photoHeight - 22;
        drawBow(bowX, bowY, 42);

        ctx.fillStyle = "#e98faa";
        ctx.font = "20px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText("♡", index % 2 === 0 ? 58 : width - 58, y + photoHeight / 2 + 7);
    });

    const footerY = height - 83;
    ctx.fillStyle = "#a7516e";
    ctx.textAlign = "center";
    ctx.font = "italic 24px Georgia, serif";
    const caption = captionInput.value.trim() || "a little moment ♡";
    ctx.fillText(caption, width / 2, footerY, width - 70);

    ctx.fillStyle = "#bd7189";
    ctx.font = "bold 12px Georgia, serif";
    ctx.fillText("MADE FOR EVERY LITTLE MOMENT  ♡", width / 2, height - 52);

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
            ? `Ready for another set of ${selectedPhotoCount} photos! ♡`
            : "Turn on your camera whenever you're ready."
    );
}

function downloadStrip() {
    if (photos.length !== selectedPhotoCount) {
        setStatus(`Take all ${selectedPhotoCount} photos before downloading your strip.`);
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
        setStatus("Your photo strip has been downloaded. Keep the memory close! ♡");
    }, "image/png");
}

// Camera controls
startCameraButton.addEventListener("click", startCamera);
stopCameraButton.addEventListener("click", stopCamera);
startSessionButton.addEventListener("click", takePhotoSession);
startRecordingButton.addEventListener("click", startRecording);
stopRecordingButton.addEventListener("click", stopRecording);
retakeButton.addEventListener("click", resetSession);
downloadButton.addEventListener("click", downloadStrip);

// Select how many poses to capture in this session.
document.querySelectorAll(".session-count-option").forEach(button => {
    button.addEventListener("click", () => {
        selectedPhotoCount = Number(button.dataset.photoCount) || 4;
        photos = [];

        document.querySelectorAll(".session-count-option").forEach(option => {
            const isSelected = option === button;
            option.classList.toggle("active", isSelected);
            option.setAttribute("aria-pressed", isSelected ? "true" : "false");
        });

        renderStrip();
        updatePhotoCount();
        setStatus(`Your session is set for ${selectedPhotoCount} photos. Pick a pose and smile! ♡`);
    });
});

// Filter selection
document.querySelectorAll(".filter-option").forEach(button => {
    button.addEventListener("click", () => {
        selectedFilter = button.dataset.filter || "original";

        document.querySelectorAll(".filter-option").forEach(option => {
            option.classList.toggle("active", option === button);
            option.setAttribute("aria-pressed", option === button ? "true" : "false");
        });

        applyVideoFilter();
        renderStrip();
    });
});

// Update the strip when the love note changes.
captionInput.addEventListener("input", renderStrip);

letterInput.addEventListener("input", () => {
    if (!letterReveal.hidden) {
        letterPreview.textContent = letterInput.value.trim();
    }
});

envelopeButton.addEventListener("click", () => {
    const message = letterInput.value.trim();
    if (!message) {
        letterStatus.textContent = "Write your letter first, then tuck it into the envelope.";
        letterInput.focus();
        return;
    }

    letterPreview.textContent = message;

    if (isLetterSealed) {
        isLetterSealed = false;
        letterEnvelope.classList.remove("is-sealed");
        letterEnvelope.classList.add("is-open");
        letterReveal.hidden = false;
        envelopeButton.setAttribute("aria-expanded", "true");
        envelopeButtonLabel.textContent = "Seal letter in envelope";
        letterStatus.textContent = "Your letter is open. Click to seal it again.";
        return;
    }

    isLetterSealed = true;
    letterEnvelope.classList.remove("is-open");
    letterEnvelope.classList.add("is-sealed");
    letterReveal.hidden = true;
    envelopeButton.setAttribute("aria-expanded", "false");
    envelopeButtonLabel.textContent = "Open your letter";
    letterStatus.textContent = "Your letter is tucked safely inside. Click to open it.";
});

// Keep the camera off if the page is closed or refreshed.
window.addEventListener("pagehide", () => {
    if (isRecording) stopRecording();
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
});

// Initial state
document.querySelectorAll(".filter-option, .session-count-option").forEach(button => {
    button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
});

renderStrip();
updatePhotoCount();
