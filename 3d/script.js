let scene, camera, renderer, controls, labyrinth, player;
const CELL_SIZE = 10, WALL_HEIGHT = 5, LABYRINTH_SIZE = 20;
const WALK_SPEED = 150, RUN_SPEED = 300, JUMP_HEIGHT = 20, GRAVITY = 30;
const PLAYER_HEIGHT = 2, PLAYER_RADIUS = 0.5, COLLISION_MARGIN = 0.3;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, sprint = false, canJump = false, collisionEnabled = true;
let prevTime = performance.now(), velocity = new THREE.Vector3(), direction = new THREE.Vector3();

function init() {
    setupScene();
    setupPlayer();
    setupControls();
    setupEventListeners();
    generateLabyrinth();
    animate();
    window.addEventListener('resize', onWindowResize, false);
}

function setupScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 0, 500);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87CEEB);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(50, 100, 50);
    light.castShadow = true;
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));
}

function setupPlayer() {
    player = new THREE.Group();
    player.position.set(CELL_SIZE / 2, PLAYER_HEIGHT, CELL_SIZE / 2);
    scene.add(player);
    camera.position.set(0, 0, 0);
    player.add(camera);
}

function setupControls() {
    controls = new THREE.PointerLockControls(camera, document.body);
    scene.add(controls.getObject());
}

function setupEventListeners() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => document.getElementById('instructions').style.display = 'none');
    controls.addEventListener('unlock', () => document.getElementById('instructions').style.display = 'block');
    document.getElementById('generateBtn').addEventListener('click', generateLabyrinth);
    document.getElementById('saveBtn').addEventListener('click', saveLabyrinth);
    document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', loadLabyrinth);
    document.getElementById('toggleCollisionBtn').addEventListener('click', toggleCollision);
}

function generateLabyrinth() {
    if (labyrinth) scene.remove(labyrinth);
    labyrinth = new THREE.Group();
    scene.add(labyrinth);

    const matrix = generateMatrix();
    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/brick_diffuse.jpg');
    const wallMaterial = new THREE.MeshPhongMaterial({ map: wallTexture });

    for (let i = 0; i < LABYRINTH_SIZE; i++) {
        for (let j = 0; j < LABYRINTH_SIZE; j++) {
            if (matrix[i][j] === 1) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(i * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, j * CELL_SIZE + CELL_SIZE / 2);
                wall.castShadow = true;
                wall.receiveShadow = true;
                labyrinth.add(wall);
            }
        }
    }

    setupFloor();
    resetPlayerPosition();
    localStorage.setItem('labyrinth', JSON.stringify(matrix));
}

function generateMatrix() {
    const matrix = Array(LABYRINTH_SIZE).fill().map(() => Array(LABYRINTH_SIZE).fill(1));
    const stack = [[1, 1]];
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        matrix[x][y] = 0;

        const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]].sort(() => Math.random() - 0.5);

        for (const [dx, dy] of directions) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && nx < LABYRINTH_SIZE - 1 && ny > 0 && ny < LABYRINTH_SIZE - 1 && matrix[nx][ny] === 1) {
                matrix[x + dx / 2][y + dy / 2] = 0;
                stack.push([nx, ny]);
            }
        }
    }
    return matrix;
}

function setupFloor() {
    const floorGeometry = new THREE.PlaneGeometry(LABYRINTH_SIZE * CELL_SIZE, LABYRINTH_SIZE * CELL_SIZE);
    const floorTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/hardwood2_diffuse.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(LABYRINTH_SIZE, LABYRINTH_SIZE);
  
    const floorMaterial = new THREE.MeshPhongMaterial({ map: floorTexture });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((LABYRINTH_SIZE * CELL_SIZE) / 2, 0, (LABYRINTH_SIZE * CELL_SIZE) / 2);
    floor.receiveShadow = true;
    labyrinth.add(floor);
}

function resetPlayerPosition() {
    player.position.set(CELL_SIZE / 2, PLAYER_HEIGHT, CELL_SIZE / 2);
    controls.getObject().position.set(CELL_SIZE / 2, PLAYER_HEIGHT, CELL_SIZE / 2);
    velocity.set(0, 0, 0);
}

function saveLabyrinth() {
    const matrix = JSON.parse(localStorage.getItem('labyrinth'));
    const blob = new Blob([JSON.stringify(matrix)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a =     document.createElement('a');
    a.href = url;
    a.download = 'labyrinth.json';
    a.click();
    URL.revokeObjectURL(url);
}

function loadLabyrinth(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const matrix = JSON.parse(e.target.result);
            localStorage.setItem('labyrinth', JSON.stringify(matrix));
            generateLabyrinthFromMatrix(matrix);
        };
        reader.readAsText(file);
    }
}

function generateLabyrinthFromMatrix(matrix) {
    if (labyrinth) scene.remove(labyrinth);
    labyrinth = new THREE.Group();
    scene.add(labyrinth);

    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/brick_diffuse.jpg');
    const wallMaterial = new THREE.MeshPhongMaterial({ map: wallTexture });

    for (let i = 0; i < LABYRINTH_SIZE; i++) {
        for (let j = 0; j < LABYRINTH_SIZE; j++) {
            if (matrix[i][j] === 1) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(i * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, j * CELL_SIZE + CELL_SIZE / 2);
                wall.castShadow = true;
                wall.receiveShadow = true;
                labyrinth.add(wall);
            }
        }
    }

    setupFloor();
    resetPlayerPosition();
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    updateVelocity(delta);
    const oldPosition = handleMovement(delta);
    handleCollisions(oldPosition);

    if (controls.getObject().position.y < PLAYER_HEIGHT) {
        velocity.y = 0;
        controls.getObject().position.y = PLAYER_HEIGHT;
        canJump = true;
    }

    prevTime = time;
    renderer.render(scene, camera);
}

function updateVelocity(delta) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= GRAVITY * delta; // Apply gravity
}

function handleMovement(delta) {
    const oldPosition = controls.getObject().position.clone();

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    const speed = sprint ? RUN_SPEED : WALK_SPEED;

    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    controls.getObject().position.y += velocity.y * delta;
    return oldPosition;
}

function handleCollisions(oldPosition) {
    if (!collisionEnabled) return;

    const matrix = JSON.parse(localStorage.getItem('labyrinth'));
    const playerX = Math.floor(controls.getObject().position.x / CELL_SIZE);
    const playerZ = Math.floor(controls.getObject().position.z / CELL_SIZE);

    const movementVector = controls.getObject().position.clone().sub(oldPosition);

    const checkCollision = (x, z) => {
        if (x >= 0 && x < LABYRINTH_SIZE && z >= 0 && z < LABYRINTH_SIZE && matrix[x][z] === 1) {
            const wallMinX = x * CELL_SIZE;
            const wallMaxX = (x + 1) * CELL_SIZE;
            const wallMinZ = z * CELL_SIZE;
            const wallMaxZ = (z + 1) * CELL_SIZE;

            const playerMinX = controls.getObject().position.x - PLAYER_RADIUS - COLLISION_MARGIN;
            const playerMaxX = controls.getObject().position.x + PLAYER_RADIUS + COLLISION_MARGIN;
            const playerMinZ = controls.getObject().position.z - PLAYER_RADIUS - COLLISION_MARGIN;
            const playerMaxZ = controls.getObject().position.z + PLAYER_RADIUS + COLLISION_MARGIN;

            if (playerMaxX > wallMinX && playerMinX < wallMaxX &&
                playerMaxZ > wallMinZ && playerMinZ < wallMaxZ) {
                
                const overlapX = Math.min(playerMaxX - wallMinX, wallMaxX - playerMinX);
                const overlapZ = Math.min(playerMaxZ - wallMinZ, wallMaxZ - playerMinZ);

                let collisionNormal = new THREE.Vector3();
                if (overlapX < overlapZ) {
                    // Collision is mostly along the X axis
                    collisionNormal.set((playerMinX < wallMinX) ? -1 : 1, 0, 0);
                } else {
                    // Collision is mostly along the Z axis
                    collisionNormal.set(0, 0, (playerMinZ < wallMinZ) ? -1 : 1);
                }

                // Project the movement vector onto the collision plane
                const rejectionVector = collisionNormal.clone().multiplyScalar(movementVector.dot(collisionNormal));
                const adjustedMovement = movementVector.sub(rejectionVector);

                // Apply the adjusted movement to the player position
                controls.getObject().position.copy(oldPosition).add(adjustedMovement);

                // Adjust the velocity to remove the component along the collision normal
                const velocityNormal = collisionNormal.clone().multiplyScalar(velocity.dot(collisionNormal));
                velocity.sub(velocityNormal);  // Preserve velocity parallel to the surface

                return true;
            }
        }
        return false;
    };

    if (checkCollision(playerX, playerZ) ||
        checkCollision(playerX - 1, playerZ) ||
        checkCollision(playerX + 1, playerZ) ||
        checkCollision(playerX, playerZ - 1) ||
        checkCollision(playerX, playerZ + 1)) {
        // Now, velocity is only reduced along the collision normal, not reset to zero.
    }
}




function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            sprint = true;
            break;
        case 'Space':
            if (canJump) {
                velocity.y += JUMP_HEIGHT;
                canJump = false;
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            sprint = false;
            break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function toggleCollision() {
    collisionEnabled = !collisionEnabled;
    const button = document.getElementById('toggleCollisionBtn');
    button.textContent = collisionEnabled ? 'Disable Collision' : 'Enable Collision';
    button.style.background = collisionEnabled ? '#ff4136' : '#4CAF50';
}

init();
