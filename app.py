import base64
import io
import os
from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
from openai import OpenAI

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite3'
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)
db = SQLAlchemy(app)

client = OpenAI()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

def create_user(username, password):
    user = User(username=username, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()

@app.before_first_request
def init_db():
    db.create_all()
    if not User.query.filter_by(username='admin').first():
        create_user('admin', 'password')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['messages'] = []
            return redirect('/')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect('/login')
    return render_template('index.html')


def build_tools():
    return [
        {
            "type": "function",
            "name": "draw_rectangle",
            "description": "Draw a rectangle on the canvas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "left": {"type": "number"},
                    "top": {"type": "number"},
                    "width": {"type": "number"},
                    "height": {"type": "number"},
                    "fill": {"type": "string"}
                },
                "required": ["left", "top", "width", "height"],
                "additionalProperties": False
            },
            "strict": True
        },
        {
            "type": "function",
            "name": "draw_circle",
            "description": "Draw a circle on the canvas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "left": {"type": "number"},
                    "top": {"type": "number"},
                    "radius": {"type": "number"},
                    "fill": {"type": "string"}
                },
                "required": ["left", "top", "radius"],
                "additionalProperties": False
            },
            "strict": True
        },
        {
            "type": "function",
            "name": "add_text",
            "description": "Add text to the canvas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "left": {"type": "number"},
                    "top": {"type": "number"},
                    "text": {"type": "string"},
                    "fill": {"type": "string"},
                    "font_size": {"type": "number"}
                },
                "required": ["left", "top", "text"],
                "additionalProperties": False
            },
            "strict": True
        }
    ]

# Dummy function to show tool calling idea

def draw_rectangle(left, top, width, height, fill="#ff0000"):
    return {
        "action": "draw_rectangle",
        "left": left,
        "top": top,
        "width": width,
        "height": height,
        "fill": fill
    }

def draw_circle(left, top, radius, fill="#ff0000"):
    return {
        "action": "draw_circle",
        "left": left,
        "top": top,
        "radius": radius,
        "fill": fill
    }

def add_text(left, top, text, fill="#000000", font_size=20):
    return {
        "action": "add_text",
        "left": left,
        "top": top,
        "text": text,
        "fill": fill,
        "font_size": font_size
    }

@app.route('/api/chat', methods=['POST'])
def chat():
    if 'messages' not in session:
        session['messages'] = []
    data = request.get_json()
    user_message = data.get('message')
    img_data = data.get('image')
    session['messages'].append({"role": "user", "content": user_message})

    # encode image as user-provided input
    if img_data:
        session['messages'].append({
            "role": "user",
            "content": [
                {"type": "input_text", "text": "canvas preview"},
                {"type": "input_image", "image_url": img_data}
            ]
        })

    tools = build_tools()

    response = client.responses.create(
        model="gpt-4.1",
        input=session['messages'],
        tools=tools
    )

    outputs = []
    while True:
        new_call = False
        for out in response.output:
            if out['type'] != 'function_call':
                continue
            tool_name = out['name']
            args = out.get('arguments', '{}')
            params = eval(args)
            result = None
            if tool_name == 'draw_rectangle':
                result = draw_rectangle(**params)
            elif tool_name == 'draw_circle':
                result = draw_circle(**params)
            elif tool_name == 'add_text':
                result = add_text(**params)
            if result:
                outputs.append(result)
                session['messages'].append(out)
                session['messages'].append({
                    "type": "function_call_output",
                    "call_id": out['call_id'],
                    "output": str(result)
                })
                response = client.responses.create(
                    model="gpt-4.1",
                    input=session['messages'],
                    tools=tools
                )
                new_call = True
                break
        if not new_call:
            break

    reply = response.output_text
    session['messages'].append({"role": "assistant", "content": reply})
    return jsonify({"reply": reply, "tool_calls": outputs})

if __name__ == '__main__':
    app.run(debug=True)
