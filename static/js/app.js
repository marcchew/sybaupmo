const canvas = new fabric.Canvas('c');
canvas.isDrawingMode = false;

let mode = 'select';
let fillColor = '#ff0000';
let strokeColor = '#000000';
let strokeWidth = 1;
let drawingObj = null;
let startX, startY;

function setMode(m) {
  mode = m;
  canvas.isDrawingMode = m === 'draw';
}

document.getElementById('select-btn').onclick = () => setMode('select');
document.getElementById('draw-btn').onclick = () => setMode('draw');
document.getElementById('rect-btn').onclick = () => setMode('rect');
document.getElementById('circle-btn').onclick = () => setMode('circle');
document.getElementById('text-btn').onclick = () => {
  const text = prompt('Enter text');
  if (text) {
    const t = new fabric.Text(text, { left: 100, top: 100, fill: fillColor, fontSize: 20 });
    canvas.add(t);
  }
};

document.getElementById('fill-color').onchange = (e) => (fillColor = e.target.value);
document.getElementById('stroke-color').onchange = (e) => (strokeColor = e.target.value);
document.getElementById('stroke-width').onchange = (e) => (strokeWidth = parseInt(e.target.value, 10));

document.getElementById('upload').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    fabric.Image.fromURL(reader.result, (img) => {
      canvas.add(img);
    });
  };
  reader.readAsDataURL(file);
};

canvas.on('mouse:down', (o) => {
  if (mode === 'rect' || mode === 'circle') {
    const pointer = canvas.getPointer(o.e);
    startX = pointer.x;
    startY = pointer.y;
    if (mode === 'rect') {
      drawingObj = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      });
    } else if (mode === 'circle') {
      drawingObj = new fabric.Circle({
        left: startX,
        top: startY,
        radius: 1,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      });
    }
    canvas.add(drawingObj);
  }
});

canvas.on('mouse:move', (o) => {
  if (!drawingObj) return;
  const pointer = canvas.getPointer(o.e);
  if (mode === 'rect') {
    drawingObj.set({
      width: Math.abs(pointer.x - startX),
      height: Math.abs(pointer.y - startY),
      left: Math.min(pointer.x, startX),
      top: Math.min(pointer.y, startY),
    });
  } else if (mode === 'circle') {
    const radius = Math.sqrt(Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2)) / 2;
    drawingObj.set({ radius: radius, left: (pointer.x + startX) / 2, top: (pointer.y + startY) / 2 });
  }
  canvas.renderAll();
});

canvas.on('mouse:up', () => {
  drawingObj = null;
});

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

function runActions(actions) {
  actions.forEach((act) => {
    if (act.action === 'draw_rectangle') {
      const r = new fabric.Rect({
        left: act.left,
        top: act.top,
        width: act.width,
        height: act.height,
        fill: act.fill,
      });
      canvas.add(r);
    } else if (act.action === 'draw_circle') {
      const c = new fabric.Circle({
        left: act.left,
        top: act.top,
        radius: act.radius,
        fill: act.fill,
      });
      canvas.add(c);
    } else if (act.action === 'add_text') {
      const t = new fabric.Text(act.text, {
        left: act.left,
        top: act.top,
        fill: act.fill,
        fontSize: act.font_size,
      });
      canvas.add(t);
    }
  });
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
  runActions(response.data.actions || []);
});
