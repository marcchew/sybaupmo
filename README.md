# Photoshop-like Editor with AI Companion

This project is an advanced image editor that uses Fabric.js for drawing
tools and Bootstrap for styling. A sidebar on the right hosts an AI
companion that communicates with the OpenAI API. The AI can see a preview of
the canvas and can call drawing tools (rectangle, circle and text) in
multiple turns. The backend relies on Flask with SQLite for logins and keeps
chat history in the session.

## Setup

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
flask run
```

Set `OPENAI_API_KEY` in your environment.
