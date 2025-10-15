from flask import Flask, jsonify, request, send_from_directory, render_template
from pymongo import MongoClient
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from bson.objectid import ObjectId
import os
import datetime

app = Flask(__name__)
CORS(app)

# ------------------ MONGODB CONNECTION ------------------
client = MongoClient("mongodb://127.0.0.1:27017/")
db = client.cookmate
recipes_collection = db.recipes
users_collection = db.users
pantry_collection = db.pantry
favorites_collection = db.favorites
feedback_collection = db.feedback

# ------------------ STATIC FILES ------------------
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

# ------------------ RECIPE IMAGES ------------------
@app.route('/static/images/<path:filename>')
def serve_recipe_image(filename):
    return send_from_directory('static/images', filename)

# ------------------ FRONTEND PAGES ------------------
@app.route('/')
@app.route('/home')
@app.route('/recipes')
@app.route('/pantry')
@app.route('/profile')
@app.route('/feedback')
@app.route('/admin')
@app.route('/recipe-detail')
def index():
    return render_template('index.html')
def admin_page():
    return render_template('admin.html')

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
            "img": r.get("img", "")
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
        "img": r.get("img", "")
    }
    return jsonify(formatted)

# ------------------ VOICE COMMAND ------------------
@app.route('/api/voice', methods=['POST'])
def voice_command():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"response": "Sorry, I didn't receive any input"}), 400

        text = data.get("text", "").lower().strip()
        if not text:
            return jsonify({"response": "Sorry, I didn't receive any voice input"}), 400

        # List all recipes
        if any(word in text for word in ["recipe", "show", "list", "what"]):
            if "all" in text or "available" in text or "show me" in text:
                recipes = list(recipes_collection.find({}, {"_id": 0, "name": 1, "cuisine": 1}))
                names = [f"{r['name']} ({r['cuisine']})" for r in recipes]
                response_text = f"I found {len(names)} recipes: {', '.join(names)}"
                return jsonify({"response": response_text})

        # Specific recipe query
        recipe_words = text.replace("show", "").replace("me", "").replace("recipe", "").replace("how to make", "").strip()
        if recipe_words:
            recipe = recipes_collection.find_one({"name": {"$regex": f"^{recipe_words}$", "$options": "i"}}, {"_id": 0})
            if not recipe:
                recipe = recipes_collection.find_one({"name": {"$regex": recipe_words, "$options": "i"}}, {"_id": 0})
            if recipe:
                ingredients_text = ', '.join(recipe['ingredients'][:3])
                if len(recipe['ingredients']) > 3:
                    ingredients_text += " and other ingredients"
                steps_preview = '. '.join(recipe['steps'][:2])
                response_text = f"Here's the {recipe['name']} recipe. It takes {recipe['time']} to prepare. You'll need {ingredients_text}. {steps_preview}"
                return jsonify({
                    "response": response_text,
                    "recipe": {
                        "id": recipe['name'].lower().replace(" ", "-"),
                        "name": recipe['name']
                    }
                })
            else:
                return jsonify({"response": f"Sorry, I couldn't find a recipe for {recipe_words}"}), 404

        # Default help message
        return jsonify({
            "response": "I can help you find and explain recipes. Try saying 'show me all recipes' or ask about a specific dish like 'how to make tea'"
        })
    except Exception as e:
        print("Voice command error:", str(e))
        return jsonify({"response": "Sorry, there was an error processing your request"}), 500

# ------------------ USER AUTH ------------------
@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        email = data.get("email")
        password = data.get("pass")
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400
        if users_collection.find_one({"email": email}):
            return jsonify({"success": False, "error": "User already exists"}), 400
        hashed = generate_password_hash(password)
        user_data = {
            "email": email,
            "password": hashed,
            "created_at": datetime.datetime.utcnow(),
            "preferences": {"voice_enabled": True, "voice_rate": 0.95}
        }
        users_collection.insert_one(user_data)
        return jsonify({"success": True, "user": {"email": email, "preferences": user_data["preferences"]}})
    except Exception as e:
        print("Registration error:", str(e))
        return jsonify({"success": False, "error": "Registration failed"}), 500

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        email = data.get("email")
        password = data.get("pass")
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400
        user = users_collection.find_one({"email": email})
        if not user or not check_password_hash(user["password"], password):
            return jsonify({"success": False, "error": "Invalid credentials"}), 401
        token = generate_password_hash(f"{email}{datetime.datetime.utcnow()}")
        users_collection.update_one({"_id": user["_id"]}, {"$set": {"last_login": datetime.datetime.utcnow(), "session_token": token}})
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "email": email,
                "name": user.get("name"),
                "created_at": user.get("created_at"),
                "preferences": user.get("preferences", {"voice_enabled": True, "voice_rate": 0.95})
            }
        })
    except Exception as e:
        print("Login error:", str(e))
        return jsonify({"success": False, "error": "Login failed"}), 500

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"success": False, "error": "No authentication token"}), 401
    token = auth_header.split(' ')[1]
    users_collection.update_one({"session_token": token}, {"$unset": {"session_token": ""}})
    return jsonify({"success": True})

# ------------------ PANTRY ------------------
@app.route('/api/pantry', methods=['GET', 'POST'])
def pantry():
    try:
        user = request.args.get("user")
        if not user:
            return jsonify({"error": "User email is required"}), 401
        if not users_collection.find_one({"email": user}):
            return jsonify({"error": "Invalid user"}), 401

        if request.method == 'GET':
            items = list(pantry_collection.find({"user": user}, {"_id": 1, "name": 1, "expiry": 1, "added_at": 1}))
            for item in items:
                item["_id"] = str(item["_id"])
                if "added_at" in item and "expiry" in item:
                    days_passed = (datetime.datetime.utcnow() - item["added_at"]).days
                    item["days_left"] = max(0, item["expiry"] - days_passed)
            return jsonify(items)

        if request.method == 'POST':
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            name = data.get("name")
            if not name:
                return jsonify({"error": "Item name is required"}), 400
            expiry = data.get("expiry", 7)
            try:
                expiry = int(expiry)
                if expiry < 1: raise ValueError("Expiry must be positive")
            except ValueError:
                return jsonify({"error": "Invalid expiry value"}), 400
            item_data = {"user": user, "name": name, "expiry": expiry, "added_at": datetime.datetime.utcnow()}
            result = pantry_collection.insert_one(item_data)
            return jsonify({"message": "Item added", "item": {"_id": str(result.inserted_id), "name": name, "expiry": expiry, "days_left": expiry}})
    except Exception as e:
        print("Pantry error:", str(e))
        return jsonify({"error": "Failed to process pantry request"}), 500

@app.route('/api/pantry/<item_id>', methods=['DELETE'])
def delete_pantry(item_id):
    try:
        user = request.args.get("user")
        if not user:
            return jsonify({"error": "User email is required"}), 401
        if not users_collection.find_one({"email": user}):
            return jsonify({"error": "Invalid user"}), 401
        item = pantry_collection.find_one({"_id": ObjectId(item_id), "user": user})
        if not item:
            return jsonify({"error": "Item not found"}), 404
        pantry_collection.delete_one({"_id": ObjectId(item_id), "user": user})
        return jsonify({"message": "Item deleted"})
    except Exception as e:
        print("Delete pantry error:", str(e))
        return jsonify({"error": "Failed to delete item"}), 500

# ------------------ FAVORITES ------------------
@app.route('/api/favorites', methods=['GET', 'POST'])
def favorites():
    try:
        user = request.args.get("user")
        if not user:
            return jsonify({"error": "User email is required"}), 401
        if not users_collection.find_one({"email": user}):
            return jsonify({"error": "Invalid user"}), 401

        if request.method == 'GET':
            favorites_list = list(favorites_collection.find({"user": user}))
            result = []
            for fav in favorites_list:
                recipe_id = fav.get("recipeId")
                if recipe_id:
                    recipe = recipes_collection.find_one({"name": recipe_id.replace("-", " ").title()}, {"_id": 0, "name": 1, "cuisine": 1, "time": 1, "img": 1})
                    if recipe:
                        result.append({
                            "id": recipe["name"].lower().replace(" ", "-"),
                            "name": recipe["name"],
                            "cuisine": recipe.get("cuisine", ""),
                            "time": recipe.get("time", ""),
                            "img": recipe.get("img", "").replace("/static/images/", ""),
                            "addedAt": fav.get("addedAt", datetime.datetime.utcnow())
                        })
            return jsonify(result)

        if request.method == 'POST':
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            recipe_id = data.get("recipeId")
            if not recipe_id:
                return jsonify({"error": "Recipe ID is required"}), 400
            recipe_name = recipe_id.replace("-", " ").title()
            if not recipes_collection.find_one({"name": recipe_name}):
                return jsonify({"error": "Recipe not found"}), 404
            if favorites_collection.find_one({"user": user, "recipeId": recipe_id}):
                return jsonify({"error": "Recipe already in favorites"}), 400
            favorite_data = {"user": user, "recipeId": recipe_id, "addedAt": datetime.datetime.utcnow()}
            favorites_collection.insert_one(favorite_data)
            return jsonify({"message": "Recipe added to favorites"})
    except Exception as e:
        print("Favorites error:", str(e))
        return jsonify({"error": "Failed to process favorites request"}), 500

# ------------------ USER PROFILE ------------------
@app.route('/api/users/profile', methods=['GET'])
def get_user_profile():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"success": False, "error": "No authentication token"}), 401
    token = auth_header.split(' ')[1]
    user = users_collection.find_one({"session_token": token})
    if not user:
        return jsonify({"success": False, "error": "Invalid token"}), 401
    recipes_viewed = len(set(user.get("viewed_recipes", [])))
    favorites_count = favorites_collection.count_documents({"user": user["email"]})
    feedback_count = feedback_collection.count_documents({"user": user["email"]})
    return jsonify({
        "success": True,
        "email": user["email"],
        "name": user.get("name"),
        "created_at": user.get("created_at"),
        "preferences": user.get("preferences", {"voice_enabled": True, "voice_rate": 0.95}),
        "stats": {
            "recipes_viewed": recipes_viewed,
            "favorites": favorites_count,
            "feedback_count": feedback_count
        }
    })

# ------------------ FEEDBACK ------------------
@app.route('/api/feedback', methods=['GET', 'POST'])
def feedback():
    if request.method == 'GET':
        recipeId = request.args.get("recipeId")
        if not recipeId:
            return jsonify([])
        items = list(feedback_collection.find({"recipeId": recipeId}, {"_id": 0}))
        return jsonify(items)

    data = request.get_json()
    user = data.get("user")
    recipeId = data.get("recipeId")
    rating = data.get("rating")
    spice = data.get("spice")
    salt = data.get("salt")
    sweet = data.get("sweet")
    taste = data.get("taste")
    improve = data.get("improve")
    feedback_collection.insert_one({
        "user": user,
        "recipeId": recipeId,
        "rating": rating,
        "spice": spice,
        "salt": salt,
        "sweet": sweet,
        "taste": taste,
        "improve": improve
    })
    return jsonify({"message": "Feedback submitted"})

# ------------------ RUN APP ------------------
if __name__ == '__main__':
    os.makedirs('static/images', exist_ok=True)
    app.run(debug=True, port=5000)
