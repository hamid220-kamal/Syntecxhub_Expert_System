# AI Rule-Based Expert System (Universal Troubleshooter)
> **Syntecxhub AI Internship - Project 2**

An **Advanced AI Expert System** that diagnoses problems using a hybrid Rule-Based Engine (Forward & Backward Chaining). Features a modern voice-enabled web interface.

## 🚀 Features
- **🧠 Hybrid Inference Engine**: Combines forward reasoning (data-driven) and backward reasoning (goal-driven).
- **🗣️ Voice Interaction**: Talk to the AI using your microphone and hear responses (Web Speech API).
- **💬 Modern Chat UI**: Cyberpunk-inspired dark interface with typing indicators and animations.
- **🔌 Pluggable Knowledge**: Logic is separated from data. Easily add `rules` for other domains (Car repair, Medical, etc.).

## 🛠️ Tech Stack
- **Backend**: Python, Flask, Custom Inference Engine
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **AI**: Rule-Based Logic (Symbolic AI)

## 📦 Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/hamid220-kamal/Syntecxhub_Expert_System.git
   cd Syntecxhub_Expert_System
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the AI Server**
   ```bash
   python main.py
   ```

4. **Open in Browser**
   - Navigate to `http://localhost:5000`
   - Click the microphone to speak!

## 💡 How it Works
The system uses a JSON knowledge base (`knowledge_base.json`) containing:
- **Rules**: Logic patterns (`IF symptoms THEN conclusion`).
- **Questions**: Queries to ask the user.
- **Solutions**: Final advice.

The engine dynamically builds a decision tree based on your answers to find the root cause.

## 👨‍💻 Author
**Hamid Kamal**  
Syntecxhub AI Internship Program
