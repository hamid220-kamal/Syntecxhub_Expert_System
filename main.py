# Copyright (c) 2026 Hamid Kamal
# Syntecxhub AI Internship
#
# This file is part of the Syntecxhub Expert System project.
# Unauthorized copying of this file, via any medium is strictly prohibited.
# Proprietary and confidential.

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from expert_system import KnowledgeBase, InferenceEngine
from nlp_processor import NLPProcessor
from fpdf import FPDF
import datetime

app = Flask(__name__, static_folder='static', template_folder='.')
CORS(app)

# Initialize Engine
kb = KnowledgeBase("knowledge_base.json")
engine = InferenceEngine(kb)
nlp = NLPProcessor(kb)

# Session state (simple global for single-user local demo)
# In production, use a database or session store
current_session = {
    "engine": engine
}

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/api/start', methods=['POST'])
def start_session():
    data = request.json or {}
    user_input = data.get('input', '')
    
    engine.reset()
    
    initial_message = "Hello! I am your AI Technical Support Agent."
    
    # NLP Processing
    if user_input:
        detected_facts = nlp.extract_facts(user_input)
        if detected_facts:
            for fact in detected_facts:
                engine.add_fact(fact)
            initial_message += f" I detected: {', '.join(detected_facts)}."
            engine.forward_chain()
    
    # Check if there's an immediate recommendation
    type, content = engine.recommend_next_step()
    
    # If no immediate conclusion, start with the most general question
    if type == "NO_CONCLUSION":
        # Check if we already have facts from NLP that didn't trigger a solution
        # If so, rely on the engine's next best question.
        # If not, use start default.
        initial_question = "system_dead" 
        # If system_dead is already known, pick another (simple logic for now)
        if initial_question in engine.known_facts:
             # Let engine pick
             pass
        else:
             question_text = kb.get_question(initial_question)
             return jsonify({
                 "type": "QUESTION",
                 "text": f"{initial_message} Let's verify. " + question_text,
                 "fact": initial_question,
                 "logs": engine.reasoning_log
             })
             
    return jsonify({
        "type": type,
        "text": content,
        "fact": content.split("::")[0] if "::" in content else None,
        "logs": engine.reasoning_log
    })

@app.route('/api/learn', methods=['POST'])
def learn_rule():
    data = request.json
    symptoms = data.get('symptoms', []) # List of fact IDs
    solution_text = data.get('solution')
    
    # 1. Create a new Solution ID
    solution_id = f"fix_{len(kb.solutions) + 1}"
    
    # 2. Add Solution to KB
    kb.solutions[solution_id] = {
        "text": solution_text,
        "image": "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif" # Generic 'Fixed' GIF
    }
    
    # 3. Add Rule
    # "IF symptoms THEN solution_id"
    kb.add_rule(symptoms, solution_id, explanation="Dynamically learned from user feedback.")
    
    # 4. Save
    kb.save_to_file("knowledge_base.json")
    
    return jsonify({"status": "success", "message": "I have learned this new solution!"})
    
@app.route('/api/graph')
def get_graph():
    return jsonify(nlp.get_graph_data())

@app.route('/api/report', methods=['POST'])
def generate_report():
    data = request.json
    logs = data.get('logs', [])
    conclusion = data.get('conclusion') or 'Not Resolved'
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    pdf.cell(200, 10, txt="DIAGNOSTIC REPORT - SYNTECXHUB AI", ln=1, align="C")
    pdf.cell(200, 10, txt=f"Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=1, align="C")
    pdf.ln(10)
    
    pdf.set_font("Arial", 'B', size=14)
    pdf.cell(200, 10, txt="Diagnosis Result:", ln=1)
    pdf.set_font("Arial", size=12)
    pdf.multi_cell(0, 10, txt=conclusion)
    pdf.ln(10)
    
    pdf.set_font("Arial", 'B', size=14)
    pdf.cell(200, 10, txt="Reasoning Log:", ln=1)
    pdf.set_font("Arial", size=10)
    
    for log in logs:
        # Safely encode text for PDF (filter out non-latin characters)
        safe_log = ''.join(c if ord(c) < 256 else '?' for c in log)
        pdf.cell(200, 8, txt=f"- {safe_log}", ln=1)
        
    filename = "diagnostic_report.pdf"
    pdf.output(filename)
    
    return send_from_directory('.', filename)

@app.route('/api/answer', methods=['POST'])
def answer():
    data = request.json
    fact = data.get('fact')
    answer = data.get('answer') # "yes" or "no"
    
    # Always mark this fact as queried so we don't ask again
    if fact:
        engine.mark_as_queried(fact)
    
    if answer.lower() == "yes":
        engine.add_fact(fact)
    
    # Run Inference
    new_inferences = engine.forward_chain()
    
    # Get Next Step
    type, content = engine.recommend_next_step()
    
    response = {
        "type": type,
        "text": content,
        "fact": None,
        "inferences": new_inferences,
        "logs": engine.reasoning_log[-3:] # Send last 3 logs for "transparency"
    }
    
    if type == "QUESTION":
        # Content format: "fact_id::Question Text"
        parts = content.split("::")
        response["fact"] = parts[0]
        response["text"] = parts[1]
    
    return jsonify(response)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    print("AI Expert System running on http://localhost:5000")
    app.run(debug=True, port=5000)
