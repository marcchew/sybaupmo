# Photoshop-like Editor with AI Companion

This project is a simple image editor that uses Fabric.js for the canvas
and Bootstrap for styling. A sidebar on the right hosts an AI companion
which can interact with the canvas using the OpenAI API. The backend uses
Flask with SQLite for user logins and stores chat history in the session.

## Setup

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
flask run
```

Set `OPENAI_API_KEY` in your environment.
