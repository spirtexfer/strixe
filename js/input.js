export function createInput(canvas) {
  const state = {
    mouse: { x: 0, y: 0 },
    clicked: false,
    rightClicked: false,
    spaceHeld: false,
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    mouseDown: false,
    mouseJustDown: false,
    mouseJustUp: false,
    dragging: false,
  };

  function toWorld(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * state.scaleX + state.offsetX,
      y: (e.clientY - rect.top) * state.scaleY + state.offsetY,
    };
  }

  document.addEventListener('mousemove', (e) => {
    const p = toWorld(e);
    state.mouse.x = p.x;
    state.mouse.y = p.y;
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      state.clicked = true;
      state.mouseDown = true;
      state.mouseJustDown = true;
      state.mouseDownOnCanvas = e.target === canvas || canvas.contains(e.target);
    }
    if (e.button === 2) state.rightClicked = true;
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      state.mouseDown = false;
      state.mouseJustUp = true;
    }
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); state.spaceHeld = true; }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') state.spaceHeld = false;
  });

  return state;
}

export function consumeClick(input) {
  if (input.clicked) {
    input.clicked = false;
    return true;
  }
  return false;
}

export function consumeRightClick(input) {
  if (input.rightClicked) {
    input.rightClicked = false;
    return true;
  }
  return false;
}

export function consumeMouseJustDown(input) {
  if (input.mouseJustDown) {
    input.mouseJustDown = false;
    return true;
  }
  return false;
}

export function consumeMouseJustUp(input) {
  if (input.mouseJustUp) {
    input.mouseJustUp = false;
    return true;
  }
  return false;
}

export function updateInputScale(input, worldW, worldH, canvasW, canvasH, zoom) {
  const z = zoom || 1;
  input.scaleX = (worldW / z) / canvasW;
  input.scaleY = (worldH / z) / canvasH;
  input.offsetX = (worldW - worldW / z) / 2;
  input.offsetY = (worldH - worldH / z) / 2;
}
