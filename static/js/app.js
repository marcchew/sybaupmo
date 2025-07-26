const canvas = new fabric.Canvas('c');
canvas.isDrawingMode = true;

function captureCanvas() {
  return canvas.toDataURL('image/png');
}

function appendMessage(role, text) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = role === 'user' ? 'text-end' : 'text-start';
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById('send').addEventListener('click', async () => {
  const input = document.getElementById('user-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendMessage('user', msg);
  const response = await axios.post('/api/chat', {
    message: msg,
    image: captureCanvas()
  });
  appendMessage('assistant', response.data.reply);
});
