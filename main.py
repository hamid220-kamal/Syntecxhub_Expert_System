from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from expert_system import KnowledgeBase, InferenceEngine
import os

app = Flask(__name__, static_folder='static', template_folder='.')
CORS(app)

# Initialize Engine
kb = KnowledgeBase("knowledge_base.json")
engine = InferenceEngine(kb)

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
    engine.reset()
    # Check if there's an immediate recommendation (unlikely without facts, but good practice)
    type, content = engine.recommend_next_step()
    
    # If no immediate conclusion, start with the most general question
    if type == "NO_CONCLUSION":
        # Hardcoded starting point for better UX or find question with most rules
        initial_question = "system_dead" 
        question_text = kb.get_question(initial_question)
        return jsonify({
            "type": "QUESTION",
            "text": "Hello! I am your AI Technical Support Agent. Let's diagnose your computer. " + question_text,
            "fact": initial_question
        })
    
    return jsonify({
        "type": type,
        "text": content,
        "fact": content.split("::")[0] if "::" in content else None
    })

@app.route('/api/answer', methods=['POST'])
def answer():
    data = request.json
    fact = data.get('fact')
    answer = data.get('answer') # "yes" or "no"
    
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
