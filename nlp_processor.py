# Copyright (c) 2026 Hamid Kamal
# Syntecxhub AI Internship

from fuzzywuzzy import process
from expert_system import KnowledgeBase

class NLPProcessor:
    def __init__(self, kb: KnowledgeBase):
        self.kb = kb
        # Create a mapping of keywords to facts
        # Heuristic: Use question text as "keywords" for that fact
        self.fact_keywords = {}
        for fact, question in kb.questions.items():
            self.fact_keywords[fact] = question

    def extract_facts(self, user_input: str) -> list[str]:
        """
        Analyze user input string and return a list of initial facts (ids).
        Uses fuzzy matching against question text.
        """
        found_facts = []
        
        # Simple Logic: Compare user input against each fact's associated question
        # If high similarity, assume that condition is TRUE (or relevant)
        # NOTE: This is a basic demo. Real NLP needs intent classification.
        
        # Better approach for this simple system:
        # Check against a manual keyword map if available, or just use question text matching
        
        results = process.extract(user_input, self.fact_keywords, limit=3)
        # results = [(question, score, fact_id), ...]
        
        for question, score, fact_id in results:
            if score > 50: # Threshold
                # Wait, this logic is tricky. "My screen is black" matches "Is your screen black?"
                # Ideally we want to set 'screen_black' to True.
                found_facts.append(fact_id)
        
        return found_facts

    def get_graph_data(self):
        """
        Generate nodes and links for D3.js visualization
        """
        nodes = []
        links = []
        
        # Add Rule Nodes (Logic Hubs)
        for rule in self.kb.rules:
            rule_node_id = f"rule_{rule.id}"
            nodes.append({"id": rule_node_id, "label": rule.id, "group": "rules"})
            
            # Link Conditions -> Rule
            for condition in rule.conditions:
                # Add condition node if not exists
                if not any(n['id'] == condition for n in nodes):
                     nodes.append({"id": condition, "label": condition, "group": "facts"})
                links.append({"source": condition, "target": rule_node_id, "value": 1})
            
            # Link Rule -> Consequence
            consequence = rule.consequence
            if not any(n['id'] == consequence for n in nodes):
                 nodes.append({"id": consequence, "label": consequence, "group": "facts"})
            links.append({"source": rule_node_id, "target": consequence, "value": 1})
            
        return {"nodes": nodes, "links": links}
