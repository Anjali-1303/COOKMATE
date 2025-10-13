from flask import Flask, jsonify, request, send_from_directory
from pymongo import MongoClient
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import os
import uuid

app = Flask(__name__)
CORS(app)

# ------------------ MONGODB CONNECTION ------------------
client = MongoClient("mongodb://127.0.0.1:27017/")
db = client.cookmate
recipes_collection = db.recipes
users_collection = db.users
pantry_collection = db.pantry
favorites_collection = db.favorites

# ------------------ STATIC FILES ------------------
@app.route('/static/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)

# ------------------ HOME ------------------
@app.route('/')
def home():
    return "🥘 CookMate Backend is Running Successfully!"

# ------------------ RECIPES ------------------
@app.route('/api/recipes', methods=['GET'])
def get_all_recipes():
    recipes = list(recipes_collection.find({}, {"_id": 0}))
    formatted = []
    for r in recipes:
        formatted.append({
            "id": r.get("name", "").lower().replace(" ", "-"),
            "title": r.get("name", ""),
            "name": r.get("name", ""),
            "cuisine": r.get("cuisine", ""),
            "time": str(r.get("time", "")).replace(" mins", ""),
            "difficulty": r.get("difficulty", "Easy"),
            "ingredients": r.get("ingredients", []),
            "basic_ingredients": r.get("basic_ingredients", []),
            "steps": r.get("steps", []),
            "alternatives": r.get("alternatives", []),
            "img": r.get("img", "").replace("/static/images/", "")
        })
    return jsonify(formatted)

@app.route('/api/recipes/<recipe_id>', methods=['GET'])
def get_recipe(recipe_id):
    recipe_name = recipe_id.replace("-", " ").title()
    r = recipes_collection.find_one({"name": recipe_name}, {"_id": 0})
    if not r:
        return jsonify({"error": "Recipe not found"}), 404
    formatted = {
        "id": r.get("name", "").lower().replace(" ", "-"),
        "title": r.get("name", ""),
        "name": r.get("name", ""),
        "cuisine": r.get("cuisine", ""),
        "time": str(r.get("time", "")).replace(" mins", ""),
        "difficulty": r.get("difficulty", "Easy"),
        "ingredients": r.get("ingredients", []),
        "basic_ingredients": r.get("basic_ingredients", []),
        "steps": r.get("steps", []),
        "alternatives": r.get("alternatives", []),
        "img": r.get("img", "").replace("/static/images/", "")
    }
    return jsonify(formatted)

# ------------------ VOICE ------------------
@app.route('/api/voice', methods=['POST'])
def voice_command():
    data = request.get_json()
    text = data.get("text", "").lower()
    response_text = "I can help you find recipes. Try saying 'show me recipes' or ask about a specific dish like tea or biryani."
    if "recipe" in text or "show" in text:
        recipes = list(recipes_collection.find({}, {"_id": 0, "name": 1}))
        names = [r["name"] for r in recipes]
        response_text = f"I found {len(names)} recipes: {', '.join(names)}"
    elif "tea" in text:
        r = recipes_collection.find_one({"name": "Tea"}, {"_id": 0})
        if r:
            response_text = f"Tea recipe: Cook for {r['time']}. Ingredients: {', '.join(r['ingredients'][:3])}"
    elif "biryani" in text:
        r = recipes_collection.find_one({"name": "Chicken Biryani"}, {"_id": 0})
        if r:
            response_text = f"Chicken Biryani: Takes {r['time']}. Main ingredients are {', '.join(r['ingredients'][:3])}"
    return jsonify({"response": response_text})

# ------------------ USER AUTH ------------------
@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("pass")
    if users_collection.find_one({"email": email}):
        return jsonify({"success": False, "error": "User already exists"}), 400
    hashed = generate_password_hash(password)
    users_collection.insert_one({"email": email, "password": hashed})
    return jsonify({"success": True})

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("pass")
    user = users_collection.find_one({"email": email})
    if user and check_password_hash(user["password"], password):
        return jsonify({"success": True, "user": {"email": email}})
    return jsonify({"success": False, "error": "Invalid credentials"}), 401

# ------------------ PANTRY ------------------
@app.route('/api/pantry', methods=['GET', 'POST'])
def pantry():
    user = request.args.get("user")
    if not user:
        return jsonify([])

    if request.method == 'GET':
        items = list(pantry_collection.find({"user": user}, {"_id": 1, "name": 1, "expiry": 1}))
        for i in items:
            i["_id"] = str(i["_id"])
        return jsonify(items)

    # POST
    data = request.get_json()
    name = data.get("name")
    expiry = data.get("expiry", 7)
    pantry_collection.insert_one({"user": user, "name": name, "expiry": expiry})
    return jsonify({"message": "Item added"})

@app.route('/api/pantry/<item_id>', methods=['DELETE'])
def delete_pantry(item_id):
    pantry_collection.delete_one({"_id": uuid.UUID(item_id) if "-" in item_id else item_id})
    return jsonify({"message": "Item deleted"})

# ------------------ FAVORITES ------------------
@app.route('/api/favorites', methods=['GET', 'POST'])
def favorites():
    user = request.args.get("user")
    if not user:
        return jsonify([])

    if request.method == 'GET':
        items = list(favorites_collection.find({"user": user}, {"_id": 0}))
        return jsonify(items)

    data = request.get_json()
    recipeId = data.get("recipeId")
    favorites_collection.insert_one({"user": user, "recipeId": recipeId})
    return jsonify({"message": "Favorite added"})

# ------------------ RUN ------------------
if __name__ == '__main__':
    os.makedirs('static/images', exist_ok=True)
    app.run(debug=True, port=5000)
