document.addEventListener("DOMContentLoaded", () => {
  const cake = document.querySelector(".cake");
  const candleCountDisplay = document.getElementById("candleCount");
  const micButton = document.getElementById("micButton");
  const micStatus = document.getElementById("micStatus");
  const birthdayMessage = document.getElementById("birthday-message");
  const closeBirthdayMessage = document.getElementById("closeBirthdayMessage");

  const candles = [];
  let audioContext = null;
  let analyser = null;
  let micStream = null;
  let monitorTimer = null;
  let timeData = null;
  let ambientRms = 0.005;
  let consecutiveLoudFrames = 0;
  let lastBlowTime = 0;
  let birthdayTimer = null;

  function updateCandleCount() {
    candleCountDisplay.textContent = String(
      candles.filter((candle) => !candle.classList.contains("out")).length
    );
  }

  function addCandle(left, top) {
    const candle = document.createElement("div");
    candle.className = "candle";
    candle.style.left = `${left}px`;
    candle.style.top = `${top}px`;

    const flame = document.createElement("div");
    flame.className = "flame";
    candle.appendChild(flame);
    cake.appendChild(candle);
    candles.push(candle);
    updateCandleCount();
  }

  cake.addEventListener("click", (event) => {
    const rect = cake.getBoundingClientRect();
    addCandle(event.clientX - rect.left, event.clientY - rect.top);
  });

  function extinguishCandles() {
    const activeCandles = candles.filter(
      (candle) => !candle.classList.contains("out")
    );

    if (activeCandles.length === 0) {
      micStatus.textContent = "Blow detected. Tap the cake to add candles first.";
      return;
    }

    // A detected blow extinguishes every currently lit candle.
    activeCandles.forEach((candle) => candle.classList.add("out"));
    updateCandleCount();
    micStatus.textContent = "Nice blow! All the candles are out. Tap the cake to add more.";

    if (candles.length > 0 && candles.every((candle) => candle.classList.contains("out"))) {
      window.clearTimeout(birthdayTimer);
      birthdayTimer = window.setTimeout(() => {
        birthdayMessage.style.display = "flex";
      }, 700);
    }
  }

  function detectBlow() {
    if (!analyser || !timeData) return;

    analyser.getByteTimeDomainData(timeData);

    // RMS estimates the loudness of the microphone signal. Unlike the old
    // average-frequency check, this works better for short, airy blow sounds.
    let squaredSum = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const sample = (timeData[i] - 128) / 128;
      squaredSum += sample * sample;
    }
    const rms = Math.sqrt(squaredSum / timeData.length);
    const now = performance.now();
    const inCooldown = now - lastBlowTime < 1100;
    const threshold = Math.max(0.018, ambientRms * 2.5);
    const loudEnough = rms > threshold && rms > ambientRms + 0.009;

    if (loudEnough && !inCooldown) {
      consecutiveLoudFrames += 1;
    } else {
      consecutiveLoudFrames = 0;
    }

    // Require two consecutive samples to reduce accidental triggers.
    if (consecutiveLoudFrames >= 2 && !inCooldown) {
      lastBlowTime = now;
      consecutiveLoudFrames = 0;
      extinguishCandles();
      return;
    }

    // Slowly adapt to room noise only when no loud burst is being detected.
    if (!loudEnough && !inCooldown) {
      ambientRms = ambientRms * 0.96 + rms * 0.04;
    }
  }

  async function startMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      micStatus.textContent = "This browser cannot access the microphone. Try a recent version of Chrome or Safari over HTTPS.";
      return;
    }

    micButton.disabled = true;
    micButton.textContent = "Requesting permission…";
    micStatus.textContent = "Please allow microphone access when your browser asks.";

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
      }

      audioContext = new AudioContextClass();
      await audioContext.resume();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      const microphone = audioContext.createMediaStreamSource(micStream);
      microphone.connect(analyser);
      timeData = new Uint8Array(analyser.fftSize);

      micButton.textContent = "Stop microphone";
      micButton.disabled = false;
      micStatus.textContent = "Microphone is now on. ကိတ်မုန့်ပေါ်မှာ candle လေးတင်လိုက် , ပြီးရင် ဆုတောင်း မွေးနေ့ဆိုတော့. ဆုတောင်းနော်. ပြီးရင်  phone screen ကို မုတ်လိုက်  ဒီတိုင်း အပြင်က candle တွေကို မုတ်သလိုဘဲ မီးမညိမ်းရင် နဲနဲ အားနဲံ့ထည့်မုတ်လိုက် ";
      monitorTimer = window.setInterval(detectBlow, 80);
    } catch (error) {
      stopMicrophone();
      micButton.disabled = false;
      micButton.textContent = "Enable microphone";
      micStatus.textContent = `Could not start microphone: ${error.message || "permission denied"}. Check browser permissions and use HTTPS or localhost.`;
    }
  }

  function stopMicrophone() {
    if (monitorTimer !== null) {
      window.clearInterval(monitorTimer);
      monitorTimer = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    timeData = null;
  }

  micButton.addEventListener("click", async () => {
    if (micStream) {
      stopMicrophone();
      micButton.textContent = "Enable microphone";
      micStatus.textContent = "Microphone is off.";
    } else {
      await startMicrophone();
    }
  });

  closeBirthdayMessage.addEventListener("click", () => {
    birthdayMessage.style.display = "none";
  });

  window.addEventListener("pagehide", stopMicrophone);
});
