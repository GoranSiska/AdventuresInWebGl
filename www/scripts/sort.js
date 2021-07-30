// eslint-disable-next-line no-unused-vars
const main = function (canvas) {
    // configurations
    const configuration = {
        viewPortSize: 128,
        zoom: 2,
        framerate: 60,
        generations: 1
    };
    // const configuration = {
    //     viewPortSize: 4096,
    //     zoom: 0.15,
    //     framerate: 60,
    //     generations: 100
    // };

    // viewport
    const width = configuration.viewPortSize;
    const height = configuration.viewPortSize;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.style.zoom = configuration.zoom;

    // create gl context
    const gl = canvas.getContext("webgl", {
        antialias: false,
        depth: false,
        alpha: false
    });
    gl.viewport(0, 0, canvas.width, canvas.height);

    // create shader (vertex and fragment) program
    const shaderProgram = gl.createProgram();

    // vertex shader code
    // pass-through vertex shader
    const vertCode = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0, 1);
    }
    `;

    // create vertex shader and attach it to shader program
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertCode);
    gl.compileShader(vertexShader);
    gl.attachShader(shaderProgram, vertexShader);

    // fragment shader code
    // read previous cell and neighbors state from texture; output new cell state
    const fragCode = `
    precision mediump float;
    uniform sampler2D state;
    uniform float frame; 
    vec2 scale = vec2(${width}.0, ${height}.0);

    vec4 getCellColor (vec2 coord) {
        return texture2D(state, (coord.xy / scale));
    }

    void main() {
        /*
            if even frame
                if even position
                    swap if lower right
                else odd position
                    swap if higher left
            else odd frame
                if even position
                    swap if higher left
                else odd position
                    swap if lower right
            42913658
            24193658
            21439568
            12345968
            12345698
            12345689
        */
        vec4 current = getCellColor(vec2(gl_FragCoord.x, gl_FragCoord.y - 1.0));
        gl_FragColor = current;
        if (floor(gl_FragCoord.y) != frame) {
            gl_FragColor = getCellColor(gl_FragCoord.xy);;
            return;
        }
        bool isEvenFrame = mod(frame, 2.0) == 0.0;
        bool isEvenPosition = mod(floor(gl_FragCoord.x), 2.0) == 0.0;
        if ((isEvenFrame && isEvenPosition) || (!isEvenFrame && !isEvenPosition)) {
            float r = gl_FragCoord.x + 1.0;
            if (r > ${width}.0) {
                r = ${width}.0 - 0.5;
            }
            vec4 right = getCellColor(vec2(r, gl_FragCoord.y - 1.0));
            if((right.g < current.g) || (right.g == current.g && right.b < current.b)) {
                gl_FragColor = right;
                return;
            }
            return;
        }
        float l = gl_FragCoord.x - 1.0;
        if (l < 0.0) {
            l = 0.5;
        }
        vec4 left = getCellColor(vec2(l, gl_FragCoord.y - 1.0));
        if ((left.g > current.g) || (left.g == current.g && left.b > current.b)) {
            gl_FragColor = left;
            return;
        }
    }
`;

    // create fragment shader and attach it to shader program
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragCode);
    gl.compileShader(fragmentShader);
    gl.attachShader(shaderProgram, fragmentShader);

    // link and use shader program
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    // create vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // create double framebuffer
    const stateLocation = gl.getUniformLocation(shaderProgram, "state");
    const state = new Uint8Array(width * 4 * height);
    gl.uniform1i(stateLocation, 0);
    gl.activeTexture(gl.TEXTURE0);
    const textures = [];
    const frameBuffers = [];
    for (let i = 0; i < 2; i++) {
        const frameBufferTexture = gl.createTexture();
        textures.push(frameBufferTexture);
        gl.bindTexture(gl.TEXTURE_2D, frameBufferTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, state);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // create a framebuffer
        const frameBuffer = gl.createFramebuffer();
        frameBuffers.push(frameBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        // attach a texture to framebuffer.
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameBufferTexture, 0);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);

    // test, existing state
    const gameState = [];
    for (let i = 0; i < 144; i++) {
        gameState[i] = 2;
    }
    gameState[65] = 0;
    gameState[66] = 0;
    gameState[88] = 0;
    gameState[90] = 1;
    gameState[110] = 1;
    gameState[111] = 1;

    // create random initial state
    const initialState = new Uint8Array(width * height * 4);
    for (let i = 0; i < width; i++) {
        const j = i * 4;
        initialState[j] = 255.0;
        initialState[j + 1] = Math.random() * 255.0;
        initialState[j + 2] = Math.random() * 255.0;
        initialState[j + 3] = 0.0;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialState);

    // frame
    const frameLocation = gl.getUniformLocation(shaderProgram, "frame");

    // drawing to back-buffer
    const drawToTexture = function (bufferIndex) {
        gl.bindTexture(gl.TEXTURE_2D, textures[bufferIndex % 2]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[(bufferIndex + 1) % 2]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // drawing to screen
    const drawToScreen = function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // animate
    let bufferIndex = 0;
    let requestCount = 60;
    let frame = 0.0;
    const animate = function () {
        requestCount += configuration.framerate;
        gl.uniform1f(frameLocation, frame % 1024.0);
        frame++;
        if (requestCount < 60) { // skip frames depending on configuration
            requestAnimationFrame(animate);
            return;
        }
        requestCount = 0;
        for (let i = 0; i < configuration.generations; i++) {
            drawToTexture(bufferIndex);
            bufferIndex = bufferIndex === 0 ? 1 : 0;
        }
        drawToScreen();
        requestAnimationFrame(animate);
    };
    animate();
};
