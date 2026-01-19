/**
 * Syntecxhub AI Expert System - Frontend Core
 * Developed by: Hamid Kamal (Syntecxhub AI Intern)
 * 
 * This module manages the interactive lifecycle of the Expert System,
 * handling real-time inference updates, voice processing (TTS/STT),
 * and high-fidelity visualisations like the Logic Graph and Particle Systems.
 */

const API_ROOT = 'http://localhost:5000/api';
let activeFact = null;
let isVoiceActive = true;
const speechEngine = window.speechSynthesis;
let networkGraph = null; // Global reference for the vis-network instance

/** DOM Accessors */
const chatBox = document.getElementById('chat-box');
const optionsContainer = document.getElementById('options-container');
const logList = document.getElementById('log-list');
const micBtn = document.getElementById('mic-btn');
const statusText = document.getElementById('status-text');
const voiceToggle = document.getElementById('voice-toggle');
const infoBtn = document.getElementById('info-btn');
const mainModal = document.getElementById('initial-input-modal');
const learnModal = document.getElementById('learning-modal');
const infoModal = document.getElementById('info-modal');
const dashModal = document.getElementById('dashboard-modal');
const visualizerCanvas = document.getElementById('audio-visualizer');
const canvasCtx = visualizerCanvas.getContext('2d');

let sessionLogs = [];
let audioCtx, analyser, dataArray;
let isVisualizing = false;

// Audio Visualizer Setup
function initVisualizer() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
    visualizerCanvas.classList.add('active');
    drawVisualizer();
}

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!isVisualizing) {
        // Flat line when quiet - with gradient
        canvasCtx.fillStyle = 'rgba(3, 3, 8, 0.9)';
        canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, 20);
        canvasCtx.lineTo(100, 20);
        const gradient = canvasCtx.createLinearGradient(0, 0, 100, 0);
        gradient.addColorStop(0, '#00f3ff');
        gradient.addColorStop(1, '#bc13fe');
        canvasCtx.strokeStyle = gradient;
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
        return;
    }

    analyser.getByteFrequencyData(dataArray);
    canvasCtx.fillStyle = 'rgba(3, 3, 8, 0.9)';
    canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barWidth = (visualizerCanvas.width / dataArray.length) * 2.5;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = dataArray[i] / 2;
        // Gradient from cyan to magenta based on frequency
        const hue = 180 + (i / dataArray.length) * 120;
        canvasCtx.fillStyle = `hsl(${hue}, 100%, 60%)`;
        canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}

/** Toggles visualization state to sync with Chrome's speech engine triggers. */
function simulateVisualizer() {
    isVisualizing = true;
    setTimeout(() => {
        if (!speechEngine.speaking) isVisualizing = false;
        else simulateVisualizer();
    }, 100);
}

/** 
 * Synchronises and renders the logical knowledge graph.
 * Features a dynamic physics-based layout for intuitive exploration of AI rules.
 */
async function syncKnowledgeGraph() {
    try {
        const response = await fetch(`${API_ROOT}/graph`);
        const data = await response.json();

        const container = document.getElementById('mynetwork');
        const nodes = new vis.DataSet(data.nodes);
        const edges = new vis.DataSet(data.links.map(l => ({ from: l.source, to: l.target })));

        const options = {
            nodes: {
                shape: 'dot',
                size: 16,
                font: { size: 14, color: '#e0faff', face: 'Orbitron' },
                borderWidth: 2,
                shadow: { enabled: true, color: 'rgba(0, 243, 255, 0.3)', size: 10 },
                color: {
                    background: '#030308',
                    border: '#00f3ff',
                    highlight: { background: '#00f3ff', border: '#ffffff' }
                }
            },
            edges: {
                width: 1,
                color: { color: 'rgba(0, 243, 255, 0.2)', highlight: '#bc13fe' },
                smooth: { type: 'dynamic' }
            },
            physics: {
                enabled: true,
                barnesHut: { gravitationalConstant: -3000, centralGravity: 0.3, springLength: 100 },
                stabilization: { iterations: 100 }
            }
        };

        networkGraph = new vis.Network(container, { nodes, edges }, options);
    } catch (err) {
        console.warn("Telemetry Warning: Could not initialise logic graph. Check API connectivity.");
    }
}

/** Triggers a visual pulse on the graph nodes to simulate inference 'firing'. */
function triggerGraphPulse(nodeId = null) {
    if (!networkGraph) return;
    const nodes = networkGraph.body.data.nodes.getIds();
    const target = nodeId || nodes[Math.floor(Math.random() * nodes.length)];
    if (target) {
        networkGraph.selectNodes([target]);
        setTimeout(() => networkGraph.unselectNodes(), 1000);
    }
}

/** Professional Speech Synthesis Wrapper */
function speak(text) {
    if (!isVoiceActive) return;
    speechEngine.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.1;
    utterance.rate = 1.0;
    utterance.onstart = () => { isVisualizing = true; simulateVisualizer(); };
    utterance.onend = () => isVisualizing = false;
    speechEngine.speak(utterance);
}

// Voice Recognition (STT)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        micBtn.classList.add('listening');
        statusText.textContent = "Listening...";
    };

    recognition.onend = () => {
        micBtn.classList.remove('listening');
        statusText.textContent = "Tap mic to speak";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log("Heard:", transcript);
        handleVoiceInput(transcript);
    };
} else {
    micBtn.style.display = 'none';
    statusText.textContent = "Voice input not supported in this browser";
}

/** Appends a message to the holographic terminal with professional iconography. */
function addMessage(text, type = 'bot') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = type === 'bot' ? '<i class="fa-solid fa-microchip"></i>' : '<i class="fa-solid fa-user-tag"></i>';

    const content = document.createElement('div');
    content.className = 'content';

    if (type === 'bot') {
        // Multi-part message parsing for optional asset rendering
        const parts = text.split("::");
        const messageText = parts[0];
        const imageUrl = parts.length > 1 ? parts[1] : null;

        content.innerHTML = messageText;

        if (imageUrl && imageUrl.trim().length > 5 && imageUrl !== 'null') {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'bot-asset';
            img.style.cssText = "max-width: 100%; border-radius: 12px; margin-top: 15px; border: 1px solid var(--primary);";
            content.appendChild(img);
        }

        speak(messageText);
    } else {
        content.textContent = text;
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/** Updates interactive command options and displays special dashboards for outcomes. */
function showOptions(type, data = null) {
    optionsContainer.innerHTML = '';

    if (type === 'QUESTION') {
        ['Yes', 'No'].forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => submitAnswer(opt);
            optionsContainer.appendChild(btn);
        });
    } else if (type === 'SOLUTION' || type === 'NO_CONCLUSION') {
        // Trigger the Diagnostic Dashboard for high-impact results
        if (type === 'SOLUTION') launchDashboard(data);

        const resetBtn = document.createElement('button');
        resetBtn.className = 'option-btn';
        resetBtn.textContent = 'New Diagnostic';
        resetBtn.onclick = () => mainModal.style.display = 'flex';
        optionsContainer.appendChild(resetBtn);

        const teachBtn = document.createElement('button');
        teachBtn.className = 'option-btn';
        teachBtn.textContent = '💡 Manual Override';
        teachBtn.style.background = 'var(--secondary)';
        teachBtn.onclick = () => learnModal.style.display = 'flex';
        optionsContainer.appendChild(teachBtn);
    }
}

/** Handles autonomous machine learning submission. */
async function submitLearning() {
    const solution = document.getElementById('learn-solution').value;
    if (!solution) return;
    const symptoms = sessionLogs
        .filter(l => l.includes('Fact defined:'))
        .map(l => l.replace('Fact defined: ', '').trim());

    await fetch(`${API_ROOT}/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms, solution })
    });
    learnModal.style.display = 'none';
    addMessage("Data ingested. Neural pathways updated with new troubleshooting logic.", 'bot');
    showToast("AI Memory Synchronised", "success");
}

/** Generates and downloads the comprehensive diagnostic PDF. */
async function downloadReport(conclusion) {
    const res = await fetch(`${API_ROOT}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: sessionLogs, conclusion })
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Hamid_AI_Expert_Report.pdf';
    a.click();
}

/** Cycles the session and resets the logical trace. */
async function startSession(userInput = '') {
    chatBox.innerHTML = '';
    optionsContainer.innerHTML = '';
    sessionLogs = [];
    logList.innerHTML = '';
    mainModal.style.display = 'none';
    dashModal.style.display = 'none';

    try {
        const res = await fetch(`${API_ROOT}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: userInput })
        });
        const responseData = await res.json();
        processResponse(responseData);
    } catch (e) {
        addMessage("Interface error: Remote brain unreachable.", "bot");
    }
}

/** Core inference driver for user interactions. */
async function submitAnswer(answer) {
    addMessage(answer, 'user');
    optionsContainer.innerHTML = '';
    triggerGraphPulse(); // Visual logic feedback

    try {
        const res = await fetch(`${API_ROOT}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fact: activeFact, answer })
        });
        const data = await res.json();
        setTimeout(() => processResponse(data), 600);
    } catch (e) {
        showToast("Backend link failure", "warning");
    }
}

/** Processes and directs the flow based on engine response metadata. */
function processResponse(data) {
    addMessage(data.text);
    activeFact = data.fact;
    showOptions(data.type, data);

    if (data.logs) {
        data.logs.forEach(log => {
            if (!sessionLogs.includes(log)) {
                sessionLogs.push(log);
                const li = document.createElement('li');
                li.innerHTML = `<i class="fa-solid fa-check-double" style="margin-right: 8px; color: var(--primary)"></i> ${log}`;
                logList.insertBefore(li, logList.firstChild);
            }
        });
    }
}

/** Intelligent voice input parsing for seamless interaction. */
function handleVoiceInput(text) {
    if (text.match(/yes|yeah|correct|yep/)) submitAnswer('Yes');
    else if (text.match(/no|nope|not|nah/)) submitAnswer('No');
    else if (text.match(/restart|reset|start/)) startSession();
    else showToast("Voice Command Not Recognised", "info");
}

/** Runtime Event Logic & Lifecycle hooks */
micBtn.onclick = () => recognition?.start();
voiceToggle.onclick = () => {
    isVoiceActive = !isVoiceActive;
    voiceToggle.classList.toggle('active');
    voiceToggle.innerHTML = isVoiceActive ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
};
infoBtn.onclick = () => infoModal.style.display = 'flex';
document.getElementById('restart-btn').onclick = () => mainModal.style.display = 'flex';
document.getElementById('start-nlp-btn').onclick = () => startSession(document.getElementById('symptom-input').value);
document.getElementById('skip-nlp-btn').onclick = () => startSession();
document.getElementById('submit-learning').onclick = submitLearning;
document.getElementById('dash-report-btn').onclick = () => downloadReport(activeFact);

/** Domain Switching Logic */
async function switchDomain(domain) {
    if (document.getElementById(`domain-${domain}`).classList.contains('active')) return;

    // Visual Updates
    document.querySelectorAll('.domain-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`domain-${domain}`).classList.add('active');

    try {
        const res = await fetch(`${API_ROOT}/switch_domain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast(`Active Domain: ${data.domain_meta.domain}`, 'success');
            // Reset Session
            chatBox.innerHTML = '';
            optionsContainer.innerHTML = '';
            sessionLogs = [];
            logList.innerHTML = '';
            syncKnowledgeGraph();
            startSession(); // Auto start new session
        }
    } catch (e) {
        showToast("Failed to switch domain", "warning");
    }
}

// --- 3D & Visual Effects Module ---
// --- 3D & High-Fidelity Visual Effects Module ---

/** 
 * MatrixRain - Holographic background animation.
 * Simulates a cascading digital stream for a futuristic terminal aesthetic.
 */
class MatrixRain {
    constructor() {
        this.canvas = document.getElementById('matrix-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()アイウエオカキクケコサシスセソ';
        this.fontSize = 14;
        this.columns = 0;
        this.drops = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.columns = Math.floor(this.canvas.width / this.fontSize);
        this.drops = Array(this.columns).fill(1);
    }

    animate() {
        // Semi-transparent black to create a trailing 'holographic' effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#00f3ff';
        this.ctx.font = `${this.fontSize}px monospace`;

        for (let i = 0; i < this.drops.length; i++) {
            const char = this.chars[Math.floor(Math.random() * this.chars.length)];
            const x = i * this.fontSize;
            const y = this.drops[i] * this.fontSize;

            // Varied color intensity for depth
            this.ctx.fillStyle = Math.random() > 0.8 ? '#bc13fe' : '#00f3ff';
            this.ctx.fillText(char, x, y);

            // Stochastic reset to vary drop lengths
            if (y > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }
            this.drops[i]++;
        }

        requestAnimationFrame(() => this.animate());
    }
}

/** 
 * ParticleSystem - Interactive foreground micro-interactions.
 * Particles react to cursor movement and form logical clusters.
 */
class ParticleSystem {
    constructor() {
        this.canvas = document.getElementById('bg-particles');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null };
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        this.initParticles();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initParticles() {
        const count = 75;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 2 + 0.5,
                color: Math.random() > 0.5 ? '#00f3ff' : '#bc13fe'
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;

            // Gravitational attraction to mouse
            if (this.mouse.x && this.mouse.y) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200) {
                    p.vx += dx * 0.00005;
                    p.vy += dy * 0.00005;
                }
            }

            // Boundary containment
            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

            p.vx = Math.max(-0.6, Math.min(0.6, p.vx));
            p.vy = Math.max(-0.6, Math.min(0.6, p.vy));

            // Particle rendering with glow
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = p.color;
            this.ctx.globalAlpha = 0.6;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Inter-particle synaptic connections
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 110) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = p.color;
                    this.ctx.globalAlpha = (1 - (dist / 110)) * 0.4;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        });

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.animate());
    }
}

/** 
 * Initialises 3D parallax depth for the main interface container.
 * Reacts to device movement/cursor positioning.
 */
function init3DTilt() {
    const container = document.querySelector('.app-container');
    const wrapper = document.querySelector('.perspective-container');
    if (!container || !wrapper) return;

    wrapper.addEventListener('mousemove', (e) => {
        const xAxis = (window.innerWidth / 2 - e.pageX) / 60;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 60;
        container.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    });

    wrapper.addEventListener('mouseleave', () => {
        container.style.transform = `rotateY(0deg) rotateX(0deg)`;
    });
}

/** 
 * Holographic Notification System (Toasts)
 * Provides non-intrusive system feedback.
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// Initialize Everything on Load
window.onload = () => {
    mainModal.style.display = 'flex';
    syncKnowledgeGraph();
    initVisualizer();

    new MatrixRain();
    new ParticleSystem();
    init3DTilt();

    setTimeout(() => showToast('AI Diagnostic Interface Active', 'success'), 1200);
};
