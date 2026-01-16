// Syntecxhub AI Expert System - Frontend Logic
// Handles Chat, API calls, and Voice Interaction

const API_URL = 'http://localhost:5000/api';
let currentFact = null;
let voiceEnabled = true;

// DOM Elements
const chatBox = document.getElementById('chat-box');
const optionsContainer = document.getElementById('options-container');
const logList = document.getElementById('log-list');
const micBtn = document.getElementById('mic-btn');
const statusText = document.getElementById('status-text');
const voiceToggle = document.getElementById('voice-toggle');
const modal = document.getElementById('initial-input-modal');

let allLogs = []; // Store logs for report

// Graph Visualization
function initGraph() {
    fetch(`${API_URL}/graph`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('mynetwork');
            const nodes = new vis.DataSet(data.nodes);
            const edges = new vis.DataSet(data.links.map(l => ({ from: l.source, to: l.target })));

            const options = {
                nodes: { shape: 'dot', size: 10, font: { color: '#fff' } },
                edges: { color: '#ffffff55' },
                groups: {
                    rules: { color: '#ef4444', size: 15 },
                    facts: { color: '#3b82f6' }
                },
                physics: { stabilization: false },
                layout: { randomSeed: 2 } // Keep consistent layout
            };
            new vis.Network(container, { nodes, edges }, options);
        });
}

// Voice Synthesis (TTS)
const synth = window.speechSynthesis;
function speak(text) {
    if (!voiceEnabled) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1;
    utterance.rate = 1;
    synth.speak(utterance);
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

// Chat Functions
function addMessage(text, type = 'bot') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = type === 'bot' ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user"></i>';

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = text;

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (type === 'bot') speak(text);
}

function showOptions(type) {
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
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = 'Start Over';
        btn.onclick = () => modal.style.display = 'flex';
        optionsContainer.appendChild(btn);

        if (type === 'SOLUTION') {
            const reportBtn = document.createElement('button');
            reportBtn.className = 'option-btn';
            reportBtn.textContent = '📄 Download Report';
            reportBtn.style.background = '#10b981';
            reportBtn.onclick = () => downloadReport(currentFact); // currentFact holds solution text here roughly
            optionsContainer.appendChild(reportBtn);
        }
    }
}

async function downloadReport(conclusion) {
    const res = await fetch(`${API_URL}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: allLogs, conclusion: conclusion })
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Diagnostic_Report.pdf';
    a.click();
}

function updateLogs(logs) {
    if (!logs) return;
    logList.innerHTML = ''; // Clear old logs (or append if preferred)
    logs.forEach(log => {
        const li = document.createElement('li');
        li.textContent = log;
        logList.appendChild(li);
    });
    // Auto scroll logs
    const container = document.querySelector('.inference-log');
    container.scrollTop = container.scrollHeight;
}

// API Calls
async function startSession(userInput = '') {
    chatBox.innerHTML = '';
    optionsContainer.innerHTML = '';
    allLogs = [];
    logList.innerHTML = '';
    modal.style.display = 'none'; // Close modal

    try {
        const res = await fetch(`${API_URL}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: userInput })
        });
        const data = await res.json();
        processResponse(data);
    } catch (e) {
        addMessage("Error connecting to AI Brain. Ensure backend is running.", "bot");
    }
}

async function submitAnswer(answer) {
    addMessage(answer, 'user');
    optionsContainer.innerHTML = ''; // Hide buttons

    try {
        const res = await fetch(`${API_URL}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fact: currentFact, answer: answer })
        });
        const data = await res.json();

        // Add artificial delay for "thinking" feel
        setTimeout(() => processResponse(data), 500);

    } catch (e) {
        addMessage("Error communicating with server.", "bot");
    }
}

function processResponse(data) {
    addMessage(data.text);
    currentFact = data.fact;
    showOptions(data.type);

    if (data.logs) {
        data.logs.forEach(log => {
            if (!allLogs.includes(log)) {
                allLogs.push(log);
                const li = document.createElement('li');
                li.textContent = log;
                logList.insertBefore(li, logList.firstChild);
            }
        });
    }
}

function handleVoiceInput(text) {
    if (text.includes('yes') || text.includes('yeah') || text.includes('correct')) {
        submitAnswer('Yes');
    } else if (text.includes('no') || text.includes('nope') || text.includes('not')) {
        submitAnswer('No');
    } else if (text.includes('restart') || text.includes('start over')) {
        startSession();
    } else {
        speak("Please say Yes or No.");
        statusText.textContent = "Please say Yes or No";
    }
}

// Event Listeners
micBtn.onclick = () => {
    if (recognition) recognition.start();
};

voiceToggle.onclick = () => {
    voiceEnabled = !voiceEnabled;
    voiceToggle.classList.toggle('active');
    voiceToggle.innerHTML = voiceEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
};

document.getElementById('restart-btn').onclick = () => modal.style.display = 'flex';
document.getElementById('start-nlp-btn').onclick = () => startSession(document.getElementById('symptom-input').value);
document.getElementById('skip-nlp-btn').onclick = () => startSession();

// Initialize
window.onload = () => {
    modal.style.display = 'flex';
    initGraph();
};
