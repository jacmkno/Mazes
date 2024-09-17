// Following instructions from https://chatgpt.com/c/66e90af5-bfac-8005-9811-859a6dfa002b
// Currently at step 3 which got me stuck. Check the animate function according to instructions.

let scene, camera, renderer, controls, labyrinth, player;
const CELL_SIZE = 10, WALL_HEIGHT = 5, LABYRINTH_SIZE = 20;
const WALK_SPEED = 150, RUN_SPEED = 300, JUMP_HEIGHT = 20, GRAVITY = 30;
const PLAYER_HEIGHT = 2, PLAYER_RADIUS = 1.1, COLLISION_MARGIN = 0.3;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, sprint = false, canJump = false, collisionEnabled = true;
let prevTime = performance.now(), velocity = new THREE.Vector3(), direction = new THREE.Vector3();

// CanonJS
let world;
let playerBody;

function init() {
    cannonJS_initWorld();
    setupScene();
    setupPlayer();
    setupEventListeners();
    drawLabyrinth();
    resetPlayerPosition();
    cannonJS_setupPlayer();
    animate();
    window.addEventListener('resize', onWindowResize, false);
}

function cannonJS_setupPlayer() {
    // Create a sphere shape with the player's radius
    const playerShape = new CANNON.Sphere(PLAYER_RADIUS);

    // Create the physics body with mass > 0 (dynamic body)
    playerBody = new CANNON.Body({ mass: 1 });
    playerBody.addShape(playerShape);

    // Set the initial position to match the player's position
    playerBody.position.set(player.position.x, player.position.y, player.position.z);

    // Add damping to reduce sliding and smooth out movement
    playerBody.linearDamping = 0.9;

    // Add the player body to the physics world
    world.addBody(playerBody);
}

function cannonJS_initWorld() {
    world = new CANNON.World();
    world.gravity.set(0, -GRAVITY, 0); // Use your GRAVITY constant (ensure it's appropriate for Cannon.js)
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
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
    scene.add(player);
    camera.position.set(0, 0, 0);
    player.add(camera);
    controls = new THREE.PointerLockControls(camera, document.body);
    scene.add(controls.getObject());
}

function setupEventListeners() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => document.getElementById('instructions').style.display = 'none');
    controls.addEventListener('unlock', () => document.getElementById('instructions').style.display = 'block');
    document.getElementById('generateBtn').addEventListener('click', ()=>drawLabyrinth());
    document.getElementById('saveBtn').addEventListener('click', saveLabyrinth);
    document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', loadLabyrinth);
    document.getElementById('toggleCollisionBtn').addEventListener('click', toggleCollision);
}

function generateLabyrinth(seed = null, width=20, height=20) {
    // From: https://github.com/professor-l/mazes/blob/master/scripts/backtracking.js

    function neighbors(maze, ic, jc) {
        var final = [];
        for (var i = 0; i < 4; i++) {
            var n = [ic, jc];
            n[i % 2] += ((Math.floor(i / 2) * 2) || -2);
            if (n[0] < maze.length && 
                n[1] < maze[0].length && 
                n[0] > 0 && 
                n[1] > 0) {
                
                if (maze[n[0]][n[1]] == 1) {
                    final.push(n);
                }
            }
        }
        return final;
    }

    // Make them odd
    width -= width % 2; width++;
    height -= height % 2; height++;
    
    // Fill maze with 1's (walls)
    var maze = [];
    for (var i = 0; i < height; i++) {
        maze.push([]);
        for (var j = 0; j < width; j++) {
            maze[i].push(1);
        }
    }
    
    // Opening at top - start of maze
    maze[0][1] = 0;
    
    var start = [];
    do {
        start[0] = Math.floor(Math.random() * height)
    } while (start[0] % 2 == 0);
    do {
        start[1] = Math.floor(Math.random() * width)
    } while (start[1] % 2 == 0);
    
    maze[start[0]][start[1]] = 0;
    
    // First open cell
    var openCells = [start];
    
    while (openCells.length) {
        
        var cell, n;
        
        // Add unnecessary element for elegance of code
        // Allows openCells.pop() at beginning of do while loop
        openCells.push([-1, -1]);
        
        // Define current cell as last element in openCells
        // and get neighbors, discarding "locked" cells
        do {
            openCells.pop();
            if (openCells.length == 0)
                break;
            cell = openCells[openCells.length - 1];
            n = neighbors(maze, cell[0], cell[1]);
        } while (n.length == 0 && openCells.length > 0);
        
        // If we're done, don't bother continuing
        if (openCells.length == 0)
            break;
        
        // Choose random neighbor and add it to openCells
        var choice = n[Math.floor(Math.random() * n.length)];
        openCells.push(choice);
        
        // Set neighbor to 0 (path, not wall)
        // Set connecting node between cell and choice to 0
        maze[ choice[0] ][ choice[1] ] = 0;
        maze[ (choice[0] + cell[0]) / 2 ][ (choice[1] + cell[1]) / 2 ] = 0;
    }
    
    // Opening at bottom - end of maze
    maze[maze.length - 1][maze[0].length - 2] = 0;
    maze[maze.length - 2][maze[0].length - 2] = 0;
    
    return maze;
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
    cannonJS_setupFloor(floor);
}

function cannonJS_setupFloor(floor){
    // New code to add a physics body for the floor
    // Create a plane shape for the floor physics body
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body({ mass: 0 }); // mass = 0 makes it static
    floorBody.addShape(floorShape);

    // Rotate the physics floor to match the Three.js floor rotation
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

    // Position the physics floor
    floorBody.position.set(floor.position.x, floor.position.y, floor.position.z);

    // Add the floor body to the physics world
    world.addBody(floorBody);

    // Optional: Store a reference to the physics body in the floor mesh's userData for future use
    floor.userData.physicsBody = floorBody;  
}


function resetPlayerPosition() {
    let x = 0, z = 0;
    let found = false;

    // Search for the first non-wall space (value 0) in the labyrinth
    for (let i = 0; i < LABYRINTH_SIZE; i++) {
        for (let j = 0; j < LABYRINTH_SIZE; j++) {
            if (matrix[i][j] === 0) {
                x = i;
                z = j;
                found = true;
                break; // Exit the loop once the first non-wall cell is found
            }
        }
        if (found) break;
    }

    // Set the player's position based on the first non-wall cell
    const posX = x * CELL_SIZE + CELL_SIZE / 2;
    const posZ = z * CELL_SIZE + CELL_SIZE / 2;

    player.position.set(posX, PLAYER_HEIGHT, posZ);
    controls.getObject().position.set(posX, PLAYER_HEIGHT, posZ);
    velocity.set(0, 0, 0);
}

function saveLabyrinth() {
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
            drawLabyrinth(matrix);
        };
        reader.readAsText(file);
    }
}

function drawLabyrinth(inputMatrix = null) {
    matrix = inputMatrix??generateLabyrinth();
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

    // Step the physics world
    world.step(1 / 60, delta);

    // Existing movement functions (we'll adjust these in the next steps)
    updateVelocity(delta);
    handleMovement(delta);

    if (controls.getObject().position.y < PLAYER_HEIGHT) {
        velocity.y = 0;
        controls.getObject().position.y = PLAYER_HEIGHT;
        canJump = true;
    }

    // Synchronize the player's Three.js object position with the physics body's position
    //controls.getObject().position.copy(playerBody.position);

    renderer.render(scene, camera);
    prevTime = time;
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
    handleCollisions(oldPosition);
}

function handleCollisions(oldPosition) {    
    if (!collisionEnabled) return;    

    const player = controls.getObject();
    const movementVector = player.position.clone().sub(oldPosition);

    // Create a raycaster to detect collisions based on movement
    const raycaster = new THREE.Raycaster();
    const rayDirection = movementVector.clone().normalize();

    // Set the collision distance to account for the player's radius and margin
    const collisionDistance = 1.5;

    // Cast the ray from the player's position in the direction of movement
    raycaster.set(player.position.clone(), rayDirection);

    // Check for intersections with all wall objects in the labyrinth
    const intersects = raycaster.intersectObjects(labyrinth.children, true);


    // If there are intersections, process them
    if (intersects.length > 0) {
        // Initialize a total rejection vector
        let totalRejection = new THREE.Vector3();
        let collision = false;
        // Check each intersection within the collision distance
        intersects.forEach(intersect => {
            if (intersect.distance < collisionDistance) {
                collision = true;
                // Calculate the collision normal from the intersected face
                const collisionNormal = intersect.face.normal.clone();

                // Project the movement vector onto the collision normal to get the rejection vector
                const rejectionVector = collisionNormal.multiplyScalar(1.0*movementVector.dot(collisionNormal));

                // Add the rejection vector to the total rejection to account for multiple walls
                totalRejection.add(rejectionVector);
            }
        });
        if(!collision) return false;

        // Update the player's position using the adjusted movement
        player.position.sub(totalRejection);

        // Before updating velocity, convert the rejection vector to the camera's coordinate system
        const camera = controls.getObject(); // This is your player or camera object

        // Create a matrix to convert world coordinates to the camera's local coordinates
        const worldToCameraMatrix = new THREE.Matrix4();
        worldToCameraMatrix.makeRotationFromQuaternion(camera.quaternion);

        // Apply the inverse of the matrix to the rejection vector
        const relativeRejection = totalRejection.clone().applyMatrix4(worldToCameraMatrix);
        
        // Adjust the velocity to remove the component along the collision normal
        const velocityRejection = relativeRejection.normalize().multiplyScalar(velocity.dot(relativeRejection.normalize()));
        velocity.sub(velocityRejection);  // Remove velocity in the direction of the rejection normal

        // Return early since a collision occurred and movement has been adjusted
        return true;
    }

    return false
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