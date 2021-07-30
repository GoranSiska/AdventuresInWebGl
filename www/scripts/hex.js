// eslint-disable-next-line no-unused-vars
const main = function (canvas) {
    // configurations
    const configuration = {
        viewPortSize: 256,
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
    // hex
    const fragCode = `
    precision mediump float;
    uniform sampler2D state;
    uniform sampler2D initialState;
    uniform float frame; 
    vec2 scale = vec2(${width}.0, ${height}.0);

    vec4 getCellColor (vec2 coord) {
        return texture2D(state, (coord.xy / scale));
    }

    float PHI = 1.61803398874989484820459;  // Φ = Golden Ratio   
    float getRandom(in vec2 xy, in float seed){
        return fract(tan(distance(xy*PHI, xy)*seed)*xy.x);
    }
    float getRandom2(vec2 p)
    {
        vec2 K1 = vec2(
            23.14069263277926, // e^pi (Gelfond's constant)
            2.665144142690225 // 2^sqrt(2) (Gelfondâ€“Schneider constant)
        );
        return fract( cos( dot(p,K1) ) * 12345.6789 );
    }

    void main() {
        /*
            frame 0 - create state from initial state
            frame 1 - 144 sort state
            frame 145 - 208 find winner
            initialState
                r => left
                g => right
                b => 0 - even, 1 - odd, 2 - fixed, 3 - even1, 4 - odd1, 5 - fixed1
            state
                r => left
                g => right
                b => 0 - even, 1 - odd, 2 - fixed, 3 - even1, 4 - odd1, 5 - fixed1
                a => order
        */

        // create state from initial state
        if (frame == 0.0) { 
            vec4 currentInitial = texture2D(initialState, (vec2(gl_FragCoord.x, 0.5) / scale));
            //float order = getRandom(gl_FragCoord.xy, 137.2);
            float order = getRandom2(gl_FragCoord.xy);
            currentInitial.a = order;
            currentInitial.b = currentInitial.b * 50.0;
            gl_FragColor = currentInitial;
            return;
        }

        // current is default
        vec4 current = getCellColor(gl_FragCoord.xy);
        gl_FragColor = current;

        if (frame < 144.0) { // sort 144
            /*
                state
                r => left
                g => right
                b => 0 - even, 1 - odd, 2 - fixed, 3 - even1, 4 - odd1, 5 - fixed1
                a => order
            */
            // skip existing moves that don't change - ie. remain current color
            float status = floor(current.b * 255.0);
            status = status / 50.0;
            if (status == 2.0 || status == 5.0) {
                //gl_FragColor = vec4(1,0,2.0/255.0,1);
                return;
            }

            bool isEvenFrame = mod(frame, 2.0) == 0.0;
            bool isEvenPosition = (status == 0.0 || status == 3.0);
            if ((isEvenFrame && isEvenPosition) || (!isEvenFrame && !isEvenPosition)) {
                // check and swap with right neighbor
                float rightNeigborLocation = floor(current.g * 255.0);
                vec4 right = getCellColor(vec2(gl_FragCoord.x + rightNeigborLocation, gl_FragCoord.y));
                if(right.a < current.a) {
                    // gl_FragColor = vec4(1,0,0,1);
                    // return;
                    // order data is copied, left&right info remains, status is recalculated
                    float rightStatus = floor(right.b * 255.0) / 50.0;
                    float owner = rightStatus < 3.0 ? 0.0 : 1.0; // owner from right
                    gl_FragColor.r = current.r; // right
                    gl_FragColor.g = current.g; // left
                    gl_FragColor.b = (owner * 3.0 + (isEvenPosition ? 0.0 : 1.0)) / 255.0; // status is owner + 1 if odd position
                    gl_FragColor.b = gl_FragColor.b * 50.0;
                    gl_FragColor.a = right.a; // order
                }
                return;
            }
            // check and swap with left neighbor
            float leftNeigborLocation = floor(current.r * 255.0);
            vec4 left = getCellColor(vec2(gl_FragCoord.x - leftNeigborLocation, gl_FragCoord.y));
            if(left.a > current.a) {
                // order data is copied, left&right info remains, status is recalculated
                float leftStatus = floor(left.b * 255.0) / 50.0;
                float owner = leftStatus < 3.0 ? 0.0 : 1.0; // owner from left
                gl_FragColor.r = current.r; // right
                gl_FragColor.g = current.g; // left
                gl_FragColor.b = (owner * 3.0 + (isEvenPosition ? 0.0 : 1.0)) / 255.0; // status is owner + 1 if odd position
                gl_FragColor.b = gl_FragColor.b * 50.0;
                gl_FragColor.a = left.a; // order
            }
            return;
        } // end sort

        //determine winner
        /*
            state
            r => left
            g => right
            b => 0 - even, 1 - odd, 2 - fixed, 3 - even1, 4 - odd1, 5 - fixed1
            a => order
        */

        float currentId = floor(gl_FragCoord.x);
        bool isTR = currentId < 12.0;
        bool isTL = mod(currentId, 12.0) == 0.0;
        bool isBR = mod(currentId, 12.0) == 11.0;
        bool isBL = currentId > 131.0;

        float playerOne = 0.0;
        float status = floor(current.b * 255.0) / 50.0;
        float owner = status < 3.0 ? 0.0 : 1.0;
        if (owner == playerOne && gl_FragCoord.x < 144.0) {
            // return;
            if (isTR) { //tr edge
                gl_FragColor.r = 1.0;
                return;
            }
            if(!isTL) {
                vec4 n = getCellColor(vec2(gl_FragCoord.x - 1.0, gl_FragCoord.y));
                if (n.r == 1.0) {
                    gl_FragColor.r = 1.0;
                    return;
                }
            }
            if (!isTR) {
                vec4 n = getCellColor(vec2(gl_FragCoord.x - 12.0, gl_FragCoord.y));
                if (n.r == 1.0) {
                    gl_FragColor.r = 1.0;
                    return;
                }
            }
            if (!isBR) {
                vec4 n = getCellColor(vec2(gl_FragCoord.x + 1.0, gl_FragCoord.y));
                if (n.r == 1.0) {
                    gl_FragColor.r = 1.0;
                    return;
                }
            }
            if (!isBL) {
                vec4 n = getCellColor(vec2(gl_FragCoord.x + 12.0, gl_FragCoord.y));
                if (n.r == 1.0) {
                    gl_FragColor.r = 1.0;
                    return;
                }
            }
            if (!isTR && !isBR) {
                vec4 n = getCellColor(vec2(gl_FragCoord.x - 11.0, gl_FragCoord.y));
                if (n.r == 1.0) {
                    gl_FragColor.r = 1.0;
                    return;
                }
            }
            if (!isTL && !isBL) {
                vec4 n = getCellColor(vec2(gl_FragCoord.x + 11.0, gl_FragCoord.y));
                if (n.r == 1.0) {
                    gl_FragColor.r = 1.0;
                    return;
                }
            }
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
    let gameMove = 8;
    // let gameMove = 8;
    gameState[2] = 1;
    gameState[6] = 0;
    gameState[7] = 1;
    gameState[65] = 0;
    gameState[66] = 1;
    gameState[88] = 0;
    gameState[90] = 0;
    gameState[110] = 1;

    // create random initial state
    const initialStateData = new Uint8Array(width * height * 4); // todo
    let nextPlayer = 0; // player one is 0
    let previous = 0;
    let step = 0;
    let current = 0;
    for (let i = 0; i < width; i++) {
        const j = i * 4;
        if (gameState[i] === 2) {
            // left
            initialStateData[j] = step;
            // right
            initialStateData[j + 1] = 0.0;
            // status
            initialStateData[j + 2] = nextPlayer * 3.0 + current % 2;
            // null
            initialStateData[j + 3] = 255.0;
            if (previous != null) {
                // right
                initialStateData[previous + 1] = step;
            }
            previous = j;
            step = 0;
            nextPlayer = nextPlayer === 0 ? 1 : 0;
            current++; // current swappable move number used to set even or odd position in status
        } else {
            // left
            initialStateData[j] = 0.0;
            // right
            initialStateData[j + 1] = 0.0;
            // status
            initialStateData[j + 2] = (gameState[i] * 3.0 + 2.0);
            // null
            initialStateData[j + 3] = 255.0;
        }
        step++;
    }
    console.log(initialStateData);

    // create initialState
    const initialStateLocation = gl.getUniformLocation(shaderProgram, "initialState");
    var initialStateTexture = gl.createTexture();
    gl.uniform1i(initialStateLocation, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, initialStateTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialStateData);

    // bind frame buffer (texture 0, buffer 1)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[1]);

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
        if (requestCount < 60) { // skip frames depending on configuration
            requestAnimationFrame(animate);
            return;
        }
        frame++;
        if (frame > 208) {
            return result(gl, frameBuffers[0]);
        }
        requestCount = 0;
        for (let i = 0; i < configuration.generations; i++) {
            drawToTexture(bufferIndex);
            bufferIndex = bufferIndex === 0 ? 1 : 0;
        }
        drawToScreen();
        //console.log("anim " + frame);
        requestAnimationFrame(animate);
    };
    animate();
};

const result = function (gl, fb) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    var pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    //const p = pixels.filter((e, i) => i % (576) === 0);

    const moves = [];
    for (let i = 0; i < 144; i++) {
        const move = {
            visits: 0,
            wins: 0
        };
        moves.push(move);
    }

    const rowOffset = gl.drawingBufferWidth * 4.0;
    for (let row = 0; row < gl.drawingBufferHeight; row++) {
        // get result
        const resultOffset = 132 * 4;
        let playerOneWon = false;
        for (let i = 0; i < 12; i++) {
            const r = pixels[row * rowOffset + resultOffset + (i * 4)];
            if (r === 255.0) { // player one won
                playerOneWon = true;
                break;
            }
        }
        // get stats
        for (let i = 0; i < 144; i++) {
            // b => 0 - even, 1 - odd, 2 - fixed, 3 - even1, 4 - odd1, 5 - fixed1
            const b = pixels[row * rowOffset + (i * 4)];
            if (b < 3) {
                const move = moves[i];
                move.visits++;
                if (playerOneWon) {
                    move.wins++;
                }
            }
        }
    }
    console.log(moves);
};
