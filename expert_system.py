"""
Syntecxhub AI Expert System - Core Inference Engine
===================================================
A hybrid rule-based expert system supporting Forward and Backward chaining.
Author: Hamid Kamal
"""

# Copyright (c) 2026 Hamid Kamal
# Syntecxhub AI Internship

import json
from typing import List, Dict, Set, Optional, Tuple

class Rule:
    def __init__(self, data: Dict):
        self.id = data.get("id")
        self.conditions = set(data.get("if", []))
        self.consequence = data.get("then")
        self.explanation = data.get("explanation", "")

    def __repr__(self):
        return f"<Rule {self.id}: IF {self.conditions} THEN {self.consequence}>"

class KnowledgeBase:
    def __init__(self, filepath: str):
        self.rules: List[Rule] = []
        self.facts: Set[str] = set()
        self.questions: Dict[str, str] = {}
        self.solutions: Dict[str, str] = {}
        self.metadata: Dict = {}
        self.load_from_file(filepath)

    def load_from_file(self, filepath: str):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.metadata = data.get("metadata", {})
                self.questions = data.get("questions", {})
                self.solutions = data.get("solutions", {})
                for rule_data in data.get("rules", []):
                    self.rules.append(Rule(rule_data))
            print(f"✓ Loaded {len(self.rules)} rules for {self.metadata.get('domain')}")
        except FileNotFoundError:
            print(f"✗ Error: Knowledge base file '{filepath}' not found!")
            raise SystemExit(1)
        except json.JSONDecodeError as e:
            print(f"✗ Error: Invalid JSON in knowledge base - {e}")
            raise SystemExit(1)

    def save_to_file(self, filepath: str):
        data = {
            "metadata": self.metadata,
            "rules": [
                {"id": r.id, "if": list(r.conditions), "then": r.consequence, "explanation": r.explanation}
                for r in self.rules
            ],
            "questions": self.questions,
            "solutions": self.solutions
        }
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=4)
            
    def add_rule(self, conditions, consequence, explanation="Learned from user interaction"):
        new_id = f"learned_rule_{len(self.rules) + 1}"
        new_rule_data = {
            "id": new_id,
            "if": conditions,
            "then": consequence,
            "explanation": explanation
        }
        self.rules.append(Rule(new_rule_data))
        # Ensure solution entry exists (simple placeholder if new)
        if consequence not in self.solutions:
            self.solutions[consequence] = {"text": "User defined solution.", "image": None}
            
        return new_id

    def get_question(self, fact_id: str) -> Optional[str]:
        return self.questions.get(fact_id)

    def get_solution(self, fact_id: str) -> Optional[Dict]:
        # Returns dict {text, image} or None
        return self.solutions.get(fact_id)

class InferenceEngine:
    def __init__(self, kb: KnowledgeBase):
        self.kb = kb
        self.known_facts: Set[str] = set()
        self.inferred_facts: Set[str] = set()
        self.queried_facts: Set[str] = set() # Facts we've already asked about
        self.reasoning_log: List[str] = []

    def reset(self):
        self.known_facts.clear()
        self.inferred_facts.clear()
        self.queried_facts.clear()
        self.reasoning_log.clear()

    def add_fact(self, fact: str):
        if fact not in self.known_facts:
            self.known_facts.add(fact)
            self.queried_facts.add(fact) # If we know it, we don't need to ask
            self.reasoning_log.append(f"Fact defined: {fact}")
            
    def mark_as_queried(self, fact: str):
        self.queried_facts.add(fact)

    def forward_chain(self) -> List[str]:
        """
        Data-Driven: Apply rules to known facts to discover new facts.
        Returns a list of newly inferred facts.
        """
        new_inferences = []
        while True:
            added_this_cycle = False
            for rule in self.kb.rules:
                # If rule has not fired yet (consequence not known)
                if rule.consequence not in self.known_facts and rule.consequence not in self.inferred_facts:
                    # Check if all conditions are met
                    if rule.conditions.issubset(self.known_facts | self.inferred_facts):
                        self.inferred_facts.add(rule.consequence)
                        new_inferences.append(rule.consequence)
                        self.reasoning_log.append(f"Rule '{rule.id}' fired: {rule.explanation} -> Inferred: {rule.consequence}")
                        added_this_cycle = True
            
            if not added_this_cycle:
                break
        
        return new_inferences

    def backward_chain(self, goal: str, visited: Set[str] = None) -> bool:
        """
        Goal-Driven: Try to prove a specific goal by recursively proving its conditions.
        """
        if visited is None:
            visited = set()

        if goal in self.known_facts or goal in self.inferred_facts:
            return True

        if goal in visited:
            return False  # Circular dependency prevention
        visited.add(goal)

        # Find rules that conclude this goal
        matching_rules = [r for r in self.kb.rules if r.consequence == goal]
        
        if not matching_rules:
            # No rules conclude this. It must be a primitive fact. 
            # In a real generic engine, we might ask the user here if we don't know it.
            return False

        for rule in matching_rules:
            # Try to prove all conditions of this rule
            all_conditions_met = True
            for condition in rule.conditions:
                if not self.backward_chain(condition, visited):
                    all_conditions_met = False
                    break
            
            if all_conditions_met:
                self.inferred_facts.add(goal)
                self.reasoning_log.append(f"Goal proved: {goal} via Rule '{rule.id}'")
                return True

        return False

    def recommend_next_step(self) -> Tuple[Optional[str], Optional[str]]:
        """
        Intelligent function to determine what question to ask next or what solution to offer.
        Prioritizes:
        1. Solutions inferred via Forward Chaining
        2. Questions that could trigger the most relevant rules
        """
        # 1. Check for solutions first
        all_knowledge = self.known_facts | self.inferred_facts
        for fact in all_knowledge:
            solution_data = self.kb.get_solution(fact)
            if solution_data:
                # Handle old format (string) vs new format (dict)
                if isinstance(solution_data, str):
                    return "SOLUTION", solution_data # backward compat
                return "SOLUTION", f"{solution_data['text']}::{solution_data['image'] or ''}"

        # 2. Find best question
        # Simple heuristic: Find a rule that is partially satisfied and ask about the missing condition
        best_question = None
        
        # Sort rules by number of known conditions (closest to firing)
        sorted_rules = sorted(self.kb.rules, key=lambda r: len(r.conditions.intersection(all_knowledge)), reverse=True)
        
        for rule in sorted_rules:
            if rule.consequence in all_knowledge:
                continue # Already fired
            
            for condition in rule.conditions:
                if condition not in all_knowledge and condition not in self.queried_facts:
                    question = self.kb.get_question(condition)
                    if question:
                         # Found a question for a missing condition of a relevant rule
                         # Return the ID of the condition so the UI knows what fact to set
                        return "QUESTION", f"{condition}::{question}" 
                        
        return "NO_CONCLUSION", "I cannot determine the problem based on current information."

# Quick Test
if __name__ == "__main__":
    kb = KnowledgeBase("knowledge_base.json")
    engine = InferenceEngine(kb)
    
    print("--- Test 1: PC Dead ---")
    engine.add_fact("system_dead")
    engine.add_fact("no_lights")
    engine.forward_chain()
    print(engine.reasoning_log)
    
    print("\n--- Test 2: Recommendation Engine ---")
    engine.reset()
    engine.add_fact("lights_on")
    # Should ask about screen or beeps next
    type, content = engine.recommend_next_step()
    print(f"Next Step: {type} -> {content}")

