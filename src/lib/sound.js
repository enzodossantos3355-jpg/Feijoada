// Gerenciador de notificações sonoras com Web Audio API nativo
// Não depende de arquivos externos, toca instantaneamente no navegador

let audioCtx = null;
let soundEnabled = localStorage.getItem("marmita_sound_notifications") !== "false";

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Toca um tom harmônico com decaimento suave
 */
function playTone(freq, type = "sine", duration = 0.3, startTime = 0, gainLevel = 0.25) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

    gain.gain.setValueAtTime(gainLevel, ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration);
  } catch (e) {
    console.warn("[Sound] Erro ao reproduzir tom:", e);
  }
}

/**
 * Som de Novo Pedido (Chime agradável de 3 notas: D5 -> F#5 -> A5)
 */
export function playNewOrderSound() {
  if (!soundEnabled) return;
  try {
    // Acorde alegre de sino
    playTone(587.33, "triangle", 0.35, 0.0, 0.3); // D5
    playTone(739.99, "sine", 0.45, 0.12, 0.35); // F#5
    playTone(880.0, "sine", 0.65, 0.24, 0.4); // A5
  } catch (err) {
    console.warn("[Sound] Falha no som de novo pedido:", err);
  }
}

/**
 * Som de Atendimento Humano / Transbordo (Alerta de atenção urgente em 3 pulsos)
 */
export function playNeedsHumanSound() {
  if (!soundEnabled) return;
  try {
    // Tom de atenção: Bip duplo agudo e característico
    playTone(880.0, "square", 0.15, 0.0, 0.25);
    playTone(880.0, "square", 0.15, 0.18, 0.25);
    playTone(1046.5, "sine", 0.35, 0.36, 0.35);
  } catch (err) {
    console.warn("[Sound] Falha no som de atendimento humano:", err);
  }
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("marmita_sound_notifications", soundEnabled ? "true" : "false");
  if (soundEnabled) {
    playNewOrderSound();
  }
  return soundEnabled;
}

export function setSoundEnabled(val) {
  soundEnabled = Boolean(val);
  localStorage.setItem("marmita_sound_notifications", soundEnabled ? "true" : "false");
}
