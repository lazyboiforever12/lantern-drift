// Thin helpers around raw WebGL2: shader compiling and vertex buffers. No engine, no scene graph.

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  return gl;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile failed:\n' + log);
  }
  return shader;
}

export function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program link failed:\n' + gl.getProgramInfoLog(program));
  }
  return program;
}

// Every vertex is 10 floats: position (3), normal (3), colour (3), emissive (1).
export const FLOATS_PER_VERTEX = 10;

export function createMesh(gl, floats) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, floats, gl.STATIC_DRAW);
  const stride = FLOATS_PER_VERTEX * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 36);
  gl.bindVertexArray(null);
  return { vao, buffer, count: floats.length / FLOATS_PER_VERTEX };
}

export function deleteMesh(gl, mesh) {
  gl.deleteBuffer(mesh.buffer);
  gl.deleteVertexArray(mesh.vao);
}
