// eslint-disable-next-line no-unused-vars
const main = function (canvas) {
    // configurations
    const configuration = {
        viewPortSize: 512,
        zoom: 10,
        framerate: 1,
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
    vec2 scale = vec2(${width}.0, ${height}.0);

    vec4 getCellColor (vec2 coord) {
        return texture2D(state, (coord.xy / scale));
    }

    int getCellTypeByColor (vec4 cellColor) {
        if (cellColor.a == 1.0) {
            return 1;
        };
        return 0;        
    }

    int getNeighborElectronsCount (vec2 coord) {
        int neighborElectronCount = 0;
        // top
        if (coord.y > 1.0) {
            //left
            if (coord.x > 1.0) {
                if (getCellTypeByColor(getCellColor(vec2(coord.x - 1.0, coord.y - 1.0))) == 1) {
                    neighborElectronCount += 1;
                }
            }
            // center
            if (getCellTypeByColor(getCellColor(vec2(coord.x, coord.y - 1.0))) == 1) {
                neighborElectronCount += 1;
            }
            // right
            if (coord.x < ${width}.0)
            if (getCellTypeByColor(getCellColor(vec2(coord.x + 1.0, coord.y - 1.0))) == 1) {
                neighborElectronCount += 1;
            }
        }
        // middle
        if (coord.x > 1.0) {
            if (getCellTypeByColor(getCellColor(vec2(coord.x - 1.0, coord.y))) == 1) {
                neighborElectronCount += 1;
            }
        }
        // right
        if (coord.x < ${width}.0)
        if (getCellTypeByColor(getCellColor(vec2(coord.x + 1.0, coord.y))) == 1) {
            neighborElectronCount += 1;
        }
        // bottom
        if (coord.y < ${height}.0) {
            //left
            if (coord.x > 1.0) {
                if (getCellTypeByColor(getCellColor(vec2(coord.x - 1.0, coord.y + 1.0))) == 1) {
                    neighborElectronCount += 1;
                }
            }
            // center
            if (getCellTypeByColor(getCellColor(vec2(coord.x, coord.y + 1.0))) == 1) {
                neighborElectronCount += 1;
            }
            // right
            if (coord.x < ${width}.0)
            if (getCellTypeByColor(getCellColor(vec2(coord.x + 1.0, coord.y + 1.0))) == 1) {
                neighborElectronCount += 1;
            }
        }        
        return neighborElectronCount;
    }

    void main() {
        // Any live cell with fewer than two live neighbors dies, as if by under-population.
        // Any live cell with two or three live neighbors lives on to the next generation.
        // Any live cell with more than three live neighbors dies, as if by overpopulation.
        // Any dead cell with exactly three live neighbors becomes a live cell, as if by reproduction.        
        vec4 cellColor = getCellColor(gl_FragCoord.xy);
        int cellType = getCellTypeByColor(cellColor);
        int electronNeighborCount = getNeighborElectronsCount(gl_FragCoord.xy);
        if (cellType == 1) {
            if(electronNeighborCount == 2 || electronNeighborCount == 3) {
                gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
                return;
            }
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        } else {
            if(electronNeighborCount == 3) {
                gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
                return;
            }
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        // create a framebuffer
        const frameBuffer = gl.createFramebuffer();
        frameBuffers.push(frameBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        // attach a texture to framebuffer.
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameBufferTexture, 0);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);

    // create random initial state
    const initialState = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const j = i * 4;
        const c = Math.random() > 0.5 ? 0 : 255;
        initialState[j] = c;
        initialState[j + 1] = c;
        initialState[j + 2] = c;
        initialState[j + 3] = c;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialState);

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
    const animate = function () {
        requestCount += configuration.framerate;
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
