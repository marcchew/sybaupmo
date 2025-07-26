const canvas = new fabric.Canvas('c');
canvas.isDrawingMode = false;

let mode = 'select';
let fillColor = '#ff0000';
let strokeColor = '#000000';
let strokeWidth = 1;
let drawingObj = null;
let startX, startY;

let history = [];
let historyStep = -1;
let restoring = false;

canvas.on('object:modified', saveState);
canvas.on('object:removed', saveState);

function setMode(m) {
  mode = m;
  canvas.isDrawingMode = m === 'draw';
  if (canvas.isDrawingMode) {
    canvas.freeDrawingBrush.color = strokeColor;
    canvas.freeDrawingBrush.width = strokeWidth;
  }
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
    saveState();
  }
};

document.getElementById('line-btn').onclick = () => setMode('line');
document.getElementById('triangle-btn').onclick = () => setMode('triangle');
document.getElementById('delete-btn').onclick = deleteSelected;
document.getElementById('bring-front-btn').onclick = () => {
  const obj = canvas.getActiveObject();
  if (obj) {
    canvas.bringToFront(obj);
    saveState();
  }
};
document.getElementById('send-back-btn').onclick = () => {
  const obj = canvas.getActiveObject();
  if (obj) {
    canvas.sendToBack(obj);
    saveState();
  }
};
document.getElementById('undo-btn').onclick = undo;
document.getElementById('redo-btn').onclick = redo;
document.getElementById('filter-select').onchange = applyFilter;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete') {
    deleteSelected();
  }
});

document.getElementById('fill-color').onchange = (e) => {
  fillColor = e.target.value;
};
document.getElementById('stroke-color').onchange = (e) => {
  strokeColor = e.target.value;
  canvas.freeDrawingBrush.color = strokeColor;
};
document.getElementById('stroke-width').onchange = (e) => {
  strokeWidth = parseInt(e.target.value, 10);
  canvas.freeDrawingBrush.width = strokeWidth;
};

document.getElementById('upload').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    fabric.Image.fromURL(reader.result, (img) => {
      canvas.add(img);
      saveState();
    });
  };
  reader.readAsDataURL(file);
};

canvas.on('mouse:down', (o) => {
  if (['rect', 'circle', 'line', 'triangle'].includes(mode)) {
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
    } else if (mode === 'line') {
      drawingObj = new fabric.Line([startX, startY, startX, startY], {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      });
    } else if (mode === 'triangle') {
      drawingObj = new fabric.Triangle({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
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
  } else if (mode === 'line') {
    drawingObj.set({ x2: pointer.x, y2: pointer.y });
  } else if (mode === 'triangle') {
    drawingObj.set({
      width: Math.abs(pointer.x - startX),
      height: Math.abs(pointer.y - startY),
      left: Math.min(pointer.x, startX),
      top: Math.min(pointer.y, startY),
    });
  }
  canvas.renderAll();
});

canvas.on('mouse:up', () => {
  if (drawingObj) {
    saveState();
  }
  drawingObj = null;
});

function saveState() {
  if (restoring) return;
  history = history.slice(0, historyStep + 1);
  history.push(JSON.stringify(canvas.toJSON()));
  historyStep = history.length - 1;
}

function undo() {
  if (historyStep <= 0) return;
  historyStep--;
  restoring = true;
  canvas.loadFromJSON(history[historyStep], () => {
    canvas.renderAll();
    restoring = false;
  });
}

function redo() {
  if (historyStep >= history.length - 1) return;
  historyStep++;
  restoring = true;
  canvas.loadFromJSON(history[historyStep], () => {
    canvas.renderAll();
    restoring = false;
  });
}

function deleteSelected() {
  const obj = canvas.getActiveObject();
  if (obj) {
    canvas.remove(obj);
    saveState();
  }
}

function applyFilter() {
  const obj = canvas.getActiveObject();
  if (!obj || !obj.filters) return;
  const value = document.getElementById('filter-select').value;
  obj.filters = [];
  if (value === 'grayscale') {
    obj.filters.push(new fabric.Image.filters.Grayscale());
  } else if (value === 'invert') {
    obj.filters.push(new fabric.Image.filters.Invert());
  }
  obj.applyFilters();
  canvas.requestRenderAll();
  saveState();
}

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
  runActions(response.data.tool_calls || response.data.actions || []);
});
