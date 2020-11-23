// eslint-disable-next-line no-unused-vars
const main = function (canvas) {
    // viewport
    const width = 800;
    const height = 600;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    // create gl context
    const gl = canvas.getContext("webgl", {
        antialias: true,
        depth: false,
        alpha: false
    });
    gl.viewport(0, 0, canvas.width, canvas.height);

    // create shader (vertex and fragment) program
    const shaderProgram = gl.createProgram();

    // define triangle geometry and color
    const vertices = [-1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, -1.0, 0.0];
    const indices = [0, 1, 2];
    // top left, bottom right, bottom left (3 x rgb)
    const colors = [1.0, 0.2, 0.2, 0.2, 1.0, 0.2, 0.2, 0.2, 1.0];

    // vertex shader code
    // transform position with projection and orientation; output color;
    const vertCode = `
    attribute vec3 position;
    uniform mat4 projection;
    uniform mat4 orientation;
    attribute vec3 color;
    varying vec3 vColor;

    void main(void) {
        gl_Position = projection * orientation * vec4(position, 1.);
        vColor = color;
    }`;

    // create vertex shader and attach it to shader program
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);
    gl.attachShader(shaderProgram, vertShader);

    // fragment shader code
    // pass input color to output;
    const fragCode = `
    precision mediump float;
    varying vec3 vColor;

    void main(void) {
        gl_FragColor = vec4(vColor, 1.);
    }`;

    // create fragment shader and attach it to shader program
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);
    gl.attachShader(shaderProgram, fragShader);

    // link and use shader program
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    // create vertex and index buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(shaderProgram, "position");
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // create color buffer
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    const color = gl.getAttribLocation(shaderProgram, "color");
    gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(color);

    // setup projection
    const projection = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2];
    const projectionLocation = gl.getUniformLocation(shaderProgram, "projection");

    // setup orientation
    let orientation = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const rotateY = function (inMatrix, angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        var rotatedMatrix = inMatrix.slice();
        rotatedMatrix[0] = c * inMatrix[0] - s * inMatrix[2];
        rotatedMatrix[2] = c * inMatrix[2] + s * inMatrix[0];
        return rotatedMatrix;
    };
    const orientationLocation = gl.getUniformLocation(shaderProgram, "orientation");

    // clear to cornflower blue
    gl.clearColor(0.3921, 0.5843, 0.9294, 1);

    // draw function
    const draw = function (orientation) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniformMatrix4fv(orientationLocation, false, orientation);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    };

    // animate
    var previousTime = 0;
    var animate = function (time) {
        orientation = rotateY(orientation, (time - previousTime) * 0.0025);
        draw(orientation);
        previousTime = time;
        window.requestAnimationFrame(animate);
    };
    animate(0);
};
