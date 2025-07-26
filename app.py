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
    for out in response.output:
        if out['type'] == 'function_call':
            tool_name = out['name']
            args = out.get('arguments', '{}')
            if tool_name == 'draw_rectangle':
                params = eval(args)
                result = draw_rectangle(**params)
                session['messages'].append(out)
                session['messages'].append({
                    "type": "function_call_output",
                    "call_id": out['call_id'],
                    "output": str(result)
                })
                # call model again with new message
                response = client.responses.create(
                    model="gpt-4.1",
                    input=session['messages'],
                    tools=tools
                )
                outputs = response.output
                break

    reply = response.output_text
    session['messages'].append({"role": "assistant", "content": reply})
    return jsonify({"reply": reply, "tool_calls": outputs})

if __name__ == '__main__':
    app.run(debug=True)
