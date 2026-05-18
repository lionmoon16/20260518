import { HandLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");
const progressBar = document.getElementById("progress-bar");
const gestureBadge = document.getElementById("gesture-badge");
const successScreen = document.getElementById("success-screen");
const successText = document.getElementById("success-text");
const bgAnimationLayer = document.getElementById("bg-animation-layer");

const CONFIG = {
    videoWidth: 640,
    videoHeight: 480,
    holdDuration: 800, // 維持 0.8 秒即觸發
    modelPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    wasmPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
};

let handLandmarker;
let drawingUtils;
let lastVideoTime = -1;

const state = {
    holding: "",
    startTime: 0,
    triggered: false
};

// 綁定按鈕點擊事件，以便測試效果
document.getElementById("btn-thumbs-up").addEventListener("click", () => {
    triggerFeedback("btn-thumbs-up", "active-thumbs");
});

document.getElementById("btn-peace").addEventListener("click", () => {
    triggerFeedback("btn-peace", "active-peace");
});

function triggerFeedback(btnId, activeClass) {
    const btn = document.getElementById(btnId);
    btn.classList.add(activeClass);
    // 簡單的觸覺回饋（手機支援的話）
    if (navigator.vibrate) navigator.vibrate(50);
    
    setTimeout(() => {
        btn.classList.remove(activeClass);
    }, 500);
}

async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(CONFIG.wasmPath);
    
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: CONFIG.modelPath,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
    });
    drawingUtils = new DrawingUtils(canvasCtx);
    
    gestureOutput.innerText = "AI 已就緒，請伸出手掌";
    startCamera();
}

function startCamera() {
    navigator.mediaDevices.getUserMedia({
        video: { width: CONFIG.videoWidth, height: CONFIG.videoHeight }
    }).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    }).catch((err) => {
        console.error("啟動攝影機失敗: ", err);
        gestureOutput.innerText = "無法開啟攝影機，請檢查權限。";
    });
}

async function predictWebcam() {
    if (lastVideoTime !== video.currentTime) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        lastVideoTime = video.currentTime;
        const results = handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            for (const landmarks of results.landmarks) {
                drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
                drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
            }

            const primaryGesture = recognizeGesture(results.landmarks[0]);
            handleGestureAction(primaryGesture);
        } else {
            resetState("等待偵測...");
        }
    }
    window.requestAnimationFrame(predictWebcam);
}

function resetState(message) {
    gestureOutput.innerText = message;
    state.holding = "";
    state.triggered = false;
    progressBar.style.width = "0%";
    gestureBadge.innerText = "";
    gestureBadge.style.transform = "scale(0)";
}

function handleGestureAction(gesture) {
    if (gesture !== state.holding) {
        state.holding = gesture;
        state.startTime = Date.now();
        state.triggered = false;
        progressBar.style.width = "0%";
        
        // 更新懸浮圖示
        if (gesture.includes("👍")) { gestureBadge.innerText = "👍"; gestureBadge.style.transform = "scale(1)"; }
        else if (gesture.includes("✌️")) { gestureBadge.innerText = "✌️"; gestureBadge.style.transform = "scale(1)"; }
        else { gestureBadge.innerText = ""; gestureBadge.style.transform = "scale(0)"; }

        gestureOutput.innerText = gesture;
        return;
    }

    if (state.triggered) {
        progressBar.style.width = "100%";
        return;
    }

    const isAction = gesture.includes("👍") || gesture.includes("✌️");
    if (!isAction) {
        progressBar.style.width = "0%";
        return;
    }

    const elapsed = Date.now() - state.startTime;
    const progress = Math.min(100, (elapsed / CONFIG.holdDuration) * 100);
    progressBar.style.width = `${progress}%`;
    gestureOutput.innerText = `執行中... ${Math.round(progress)}%`;

    if (elapsed >= CONFIG.holdDuration) {
        let bgColor, textColor, icon, animClass;

        if (gesture.includes("👍")) {
            document.getElementById("btn-thumbs-up").click();
            bgColor = "rgba(232, 245, 233, 0.95)"; // 綠色系背景 (👍)
            textColor = "#2e7d32";                // 深綠色文字
            icon = "👍";
            animClass = "bg-anim-thumbs";
        } else if (gesture.includes("✌️")) {
            document.getElementById("btn-peace").click();
            bgColor = "rgba(255, 243, 224, 0.95)"; // 橘色系背景 (✌️)
            textColor = "#ef6c00";                // 深橘色文字
            icon = "✌️";
            animClass = "bg-anim-peace";
        }
        state.triggered = true;
        // 觸發成功的視覺特效
        gestureBadge.style.transform = "scale(1.5)";

        // 顯示成功畫面
        successScreen.querySelector(".success-icon").innerText = icon;
        successText.innerText = `${gesture} 辨識成功！`;
        successScreen.style.backgroundColor = bgColor;
        successText.style.color = textColor;
        successScreen.style.display = "flex";

        // 觸發全螢幕背景動畫
        bgAnimationLayer.className = animClass;
        
        // 1.5 秒後自動隱藏成功畫面
        setTimeout(() => {
            gestureBadge.style.transform = "scale(1)";
            successScreen.style.display = "none";
            bgAnimationLayer.className = ""; // 清除動畫類別以便下次使用
        }, 1500);
    }
}

function recognizeGesture(landmarks) {
    const wrist = landmarks[0];
    
    // 輔助函式：計算兩點間的歐幾里得距離
    const getDist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    // 判斷手指是否伸展：指尖到手腕的距離 > 第二指節到手腕的距離
    // 索引：食指(8,6), 中指(12,10), 無名指(16,14), 小指(20,18)
    const isIndexExtended = getDist(landmarks[8], wrist) > getDist(landmarks[6], wrist);
    const isMiddleExtended = getDist(landmarks[12], wrist) > getDist(landmarks[10], wrist);
    const isRingExtended = getDist(landmarks[16], wrist) > getDist(landmarks[14], wrist);
    const isPinkyExtended = getDist(landmarks[20], wrist) > getDist(landmarks[18], wrist);

    // 拇指判定：拇指尖 (4) 在 Y 軸上顯著高於其根部 (2) 且高於食指根部 (5)
    const isThumbUp = landmarks[4].y < landmarks[2].y && landmarks[4].y < landmarks[5].y;

    // 1. 勝利 ✌️：食指與中指伸展，無名指與小指收合
    // 增加一個額外的檢查：食指尖與中指尖要有一定的距離（避免手指併攏誤判）
    const fingersSpread = Math.abs(landmarks[8].x - landmarks[12].x) > 0.05;
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended && fingersSpread) {
        return "勝利 ✌️";
    }

    // 2. 讚 👍：僅拇指向上，其餘四指皆收合
    if (isThumbUp && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return "讚 👍";
    }

    const count = [isThumbUp, isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;
    return count > 0 ? `伸出 ${count} 根手指` : "已握拳";
}

createHandLandmarker();