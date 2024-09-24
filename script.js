// Initialize global variables
let scene, camera, renderer, controls;
let metalSurface, photons = [], electrons = [];
let bulb;
let frequencySlider, intensitySlider, metalSelect;
let frequencyValue, intensityValue;
let kineticEnergyOutput, currentValueOutput, workFunctionOutput, thresholdFrequencyOutput;
let thresholdFrequency;
const maxFrequency = 30; // Max frequency in 10^14 Hz

// Physical constants
const h = 4.1357e-15; // Planck's constant in eV·s
const c = 3e8;        // Speed of light in m/s
let workFunction = 2.28; // Default work function of Sodium in eV

// Metal properties
const metals = {
  sodium: {
    workFunction: 2.28,
    color: 0xf4d03f
  },
  copper: {
    workFunction: 4.7,
    color: 0xb87333
  },
  zinc: {
    workFunction: 4.3,
    color: 0x7f8c8d
  },
  solarPanel: {
    workFunction: 4.5,
    color: 0x2e2e2e // Dark gray for solar panel
  }
};

// Variables for continuous photon emission
let photonEmissionInterval = 0;
let lastPhotonEmissionTime = 0;

// Arrays for energy diagram and graph data
let energyDiagramCanvas, energyDiagramCtx;
let graphCanvas, graphCtx;
let graphData = [];

init();      // Set up the scene
animate();   // Start the animation loop

function init() {
  // Set up the Three.js scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e1e1e);

  // Set up the camera
  camera = new THREE.PerspectiveCamera(
    60,
    document.getElementById('simulation-area').clientWidth / 700, // Updated aspect ratio
    0.1,
    1000
  );
  camera.position.set(0, 15, 50);

  // Set up the renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(document.getElementById('simulation-area').clientWidth, 700); // Updated height
  document.getElementById('simulation-area').appendChild(renderer.domElement);

  // Set up OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableRotate = false;
  controls.minDistance = 40;
  controls.maxDistance = 80;

  // Add a plane to represent the metal surface
  const geometry = new THREE.BoxGeometry(20, 0.5, 10);
  const material = new THREE.MeshPhongMaterial({ color: metals.sodium.color });
  metalSurface = new THREE.Mesh(geometry, material);
  metalSurface.position.set(0, 0, 0);
  scene.add(metalSurface);

  // Add ambient and point lights to the scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 0.8);
  pointLight.position.set(0, 50, 50);
  scene.add(pointLight);

  // Create the circuit with the classical bulb
  createCircuit();

  // Set up the UI controls
  frequencySlider = document.getElementById('frequencySlider');
  intensitySlider = document.getElementById('intensitySlider');
  metalSelect = document.getElementById('metalSelect');
  frequencyValue = document.getElementById('frequencyValue');
  intensityValue = document.getElementById('intensityValue');
  kineticEnergyOutput = document.getElementById('kineticEnergy');
  currentValueOutput = document.getElementById('currentValue');
  workFunctionOutput = document.getElementById('workFunction');
  thresholdFrequencyOutput = document.getElementById('thresholdFrequency');

  // Add event listeners for sliders and metal selection
  frequencySlider.addEventListener('input', updateSettings);
  intensitySlider.addEventListener('input', updateSettings);
  metalSelect.addEventListener('change', updateMetal);

  // Initialize the energy diagram and graph view
  createEnergyDiagram();
  createGraphView();

  // Update settings initially
  updateMetal();
  updateSettings();

  // Handle window resize events
  window.addEventListener('resize', onWindowResize, false);
}

function createCircuit() {
  // Create wires using cylinders
  const wireMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const wireGeometry = new THREE.CylinderGeometry(0.1, 0.1, 20, 8);

  const wire1 = new THREE.Mesh(wireGeometry, wireMaterial);
  wire1.rotation.z = Math.PI / 2;
  wire1.position.set(-10, 10, -5);
  scene.add(wire1);

  const wire2 = wire1.clone();
  wire2.position.set(10, 10, -5);
  scene.add(wire2);

  const wire3 = new THREE.Mesh(wireGeometry, wireMaterial);
  wire3.position.set(0, 20, -5);
  scene.add(wire3);

  // Create a bulb to represent the current
  const bulbGeometry = new THREE.SphereGeometry(1, 16, 16);
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0x000000,
    emissiveIntensity: 0,
    metalness: 0.5,
    roughness: 0.5
  });
  bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
  bulb.position.set(0, 20, -5);
  scene.add(bulb);

  // Add a filament inside the bulb
  const filamentGeometry = new THREE.TorusGeometry(0.3, 0.05, 8, 16);
  const filamentMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const filament = new THREE.Mesh(filamentGeometry, filamentMaterial);
  filament.rotation.x = Math.PI / 2;
  filament.position.set(0, 20, -5);
  bulb.add(filament);
}

function updateMetal() {
  const selectedMetal = metalSelect.value;
  workFunction = metals[selectedMetal].workFunction;
  thresholdFrequency = workFunction / h / 1e14; // Threshold frequency in 10^14 Hz
  metalSurface.material.color.setHex(metals[selectedMetal].color);
  workFunctionOutput.textContent = workFunction.toFixed(2);
  thresholdFrequencyOutput.textContent = thresholdFrequency.toFixed(1);
  updateSettings();
}

function updateSettings() {
  // Get values from sliders
  const frequency = parseFloat(frequencySlider.value);
  const intensity = parseInt(intensitySlider.value);

  // Update displayed values
  frequencyValue.textContent = frequency.toFixed(1);
  intensityValue.textContent = intensity;

  // Calculate photon energy and kinetic energy
  const photonEnergy = h * frequency * 1e14; // Convert frequency to Hz
  const kineticEnergy = photonEnergy > workFunction ? photonEnergy - workFunction : 0;
  kineticEnergyOutput.textContent = kineticEnergy.toFixed(2);

  // Update the bulb brightness based on current
  const current = photonEnergy > workFunction ? intensity * (kineticEnergy) : 0;
  currentValueOutput.textContent = current.toFixed(2);

  // Adjust bulb emissive intensity
  bulb.material.emissiveIntensity = Math.min(current / 100, 1);
  bulb.material.emissive = new THREE.Color(0xffffee);

  // Adjust filament brightness
  bulb.children[0].material.color.setHSL(0.1, 1, Math.min(current / 100, 0.5) + 0.2);

  // Update photon emission interval
  photonEmissionInterval = 1000 / (intensity * 5); // Emit photons based on intensity

  // Update energy diagram and graph
  updateEnergyDiagram(frequency, photonEnergy, workFunction);
  updateGraph(frequency, current);
}

function createPhoton(frequency) {
  // Determine photon color based on wavelength
  const wavelength = c / (frequency * 1e14); // in meters
  const color = wavelengthToColor(wavelength * 1e9); // Convert to nm

  // Create a wavy line to represent the photon
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.1, 0.2, 0),
    new THREE.Vector3(-0.1, 0.4, 0),
    new THREE.Vector3(0, 0.6, 0)
  ]);

  const geometry = new THREE.TubeGeometry(path, 64, 0.05, 8, false);
  const material = new THREE.MeshBasicMaterial({ color: color });
  return new THREE.Mesh(geometry, material);
}

function wavelengthToColor(wavelength) {
  // Convert wavelength to RGB color
  let r, g, b;
  if (wavelength >= 380 && wavelength <= 440) {
    r = -1 * (wavelength - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelength > 440 && wavelength <= 490) {
    r = 0;
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength > 490 && wavelength <= 510) {
    r = 0;
    g = 1;
    b = -1 * (wavelength - 510) / (510 - 490);
  } else if (wavelength > 510 && wavelength <= 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelength > 580 && wavelength <= 645) {
    r = 1;
    g = -1 * (wavelength - 645) / (645 - 580);
    b = 0;
  } else if (wavelength > 645 && wavelength <= 780) {
    r = 1;
    g = 0;
    b = 0;
  } else if (wavelength < 380) {
    // UV light represented as violet
    r = 0.5;
    g = 0;
    b = 1;
  } else if (wavelength > 780) {
    // IR light represented as dark red
    r = 0.5;
    g = 0;
    b = 0;
  } else {
    r = 0;
    g = 0;
    b = 0;
  }
  return new THREE.Color(r, g, b);
}

function animate() {
  requestAnimationFrame(animate);

  const currentTime = Date.now();

  // Emit photons continuously based on intensity
  if (currentTime - lastPhotonEmissionTime > photonEmissionInterval) {
    emitPhotons();
    lastPhotonEmissionTime = currentTime;
  }

  // Move photons towards the metal surface
  photons.forEach((photon, index) => {
    photon.position.y -= 0.2; // Adjust speed as needed

    const frequency = parseFloat(frequencySlider.value);
    const photonEnergy = h * frequency * 1e14;
    const kineticEnergy = photonEnergy > workFunction ? photonEnergy - workFunction : 0;

    if (photon.position.y <= 0.5) {
      if (kineticEnergy > 0) {
        // High-frequency photon: absorb and emit electron
        emitElectrons(photon.position, kineticEnergy);
        // Add a visual effect to indicate interaction
        createInteractionEffect(photon.position);
        // Remove photon from scene
        scene.remove(photon);
        photons.splice(index, 1);
      } else {
        // Low-frequency photon: bounce off
        photon.userData = { bouncing: true };
      }
    }

    // Handle bouncing photons
    if (photon.userData && photon.userData.bouncing) {
      photon.position.y += 0.2; // Photon bounces back upward
      if (photon.position.y >= 20) {
        // Remove photon after it bounces away
        scene.remove(photon);
        photons.splice(index, 1);
      }
    }
  });

  // Move electrons through the circuit
  electrons.forEach((electron, index) => {
    const path = electron.userData.path;
    electron.userData.progress += 0.01; // Adjust speed as needed
    if (electron.userData.progress >= 1) {
      // Electron has completed the circuit
      scene.remove(electron);
      electrons.splice(index, 1);
    } else {
      const point = path.getPointAt(electron.userData.progress);
      electron.position.copy(point);
    }
    electron.material.opacity -= 0.005; // Fade out electron over time
  });

  // Render the scene
  renderer.render(scene, camera);
}

function emitPhotons() {
  const frequency = parseFloat(frequencySlider.value);
  const intensity = parseInt(intensitySlider.value);

  // Adjust the number of photons emitted
  const numPhotons = Math.max(1, intensity); // Emit more photons based on intensity
  for (let i = 0; i < numPhotons; i++) {
    const photon = createPhoton(frequency);
    photon.position.set((Math.random() - 0.5) * 18, 25 + Math.random() * 5, (Math.random() - 0.5) * 8);
    scene.add(photon);
    photons.push(photon);
  }
}

function emitElectrons(position, kineticEnergy) {
  // Create electrons and set their path through the circuit
  const electronMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 1 });
  const electronGeometry = new THREE.SphereGeometry(0.1, 8, 8);

  // Path for electrons: from metal surface, up the wire, through bulb, back down other wire
  const pathPoints = [
    new THREE.Vector3(position.x, 0.5, -5),
    new THREE.Vector3(-10, 10, -5),
    new THREE.Vector3(0, 20, -5),
    new THREE.Vector3(10, 10, -5),
    new THREE.Vector3(position.x, 0.5, -5)
  ];

  const path = new THREE.CatmullRomCurve3(pathPoints);

  // Number of electrons proportional to kinetic energy
  const numElectrons = Math.ceil(kineticEnergy);
  for (let i = 0; i < numElectrons; i++) {
    const electron = new THREE.Mesh(electronGeometry, electronMaterial.clone());
    electron.position.copy(position);
    electron.userData = {
      path: path,
      progress: i / numElectrons // Spread out electrons along the path
    };
    scene.add(electron);
    electrons.push(electron);
  }
}

function createInteractionEffect(position) {
  // Visual effect to show photon-electron interaction
  const spriteMap = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');
  const spriteMaterial = new THREE.SpriteMaterial({ map: spriteMap, color: 0xffff00 });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.5, 0.5, 0.5);
  sprite.position.copy(position);
  scene.add(sprite);

  // Fade out and remove the sprite
  let opacity = 1;
  const fadeOut = () => {
    opacity -= 0.05;
    sprite.material.opacity = opacity;
    if (opacity <= 0) {
      scene.remove(sprite);
    } else {
      requestAnimationFrame(fadeOut);
    }
  };
  fadeOut();
}

function createEnergyDiagram() {
  // Adjust the canvas width to fit the new layout
  energyDiagramCanvas = document.createElement('canvas');
  energyDiagramCanvas.width = 280; // Adjusted width
  energyDiagramCanvas.height = 200;
  energyDiagramCanvas.style.border = '1px solid #ffffff';
  document.getElementById('energy-diagram').appendChild(energyDiagramCanvas);
  energyDiagramCtx = energyDiagramCanvas.getContext('2d');
}

function updateEnergyDiagram(frequency, photonEnergy, workFunction) {
  // Clear the canvas
  energyDiagramCtx.clearRect(0, 0, energyDiagramCanvas.width, energyDiagramCanvas.height);

  // Draw energy levels
  const vacuumLevel = 180;
  const fermiLevel = vacuumLevel - workFunction * 30;
  const photonLevel = vacuumLevel - photonEnergy * 30;

  energyDiagramCtx.fillStyle = '#ffffff';
  energyDiagramCtx.fillRect(50, vacuumLevel, 200, 2); // Vacuum level
  energyDiagramCtx.fillRect(50, fermiLevel, 200, 2);  // Fermi level

  // Label energy levels
  energyDiagramCtx.fillText('Vacuum Level', 10, vacuumLevel + 5);
  energyDiagramCtx.fillText('Fermi Level', 10, fermiLevel + 5);

  // Draw photon energy arrow
  energyDiagramCtx.beginPath();
  energyDiagramCtx.moveTo(150, vacuumLevel);
  energyDiagramCtx.lineTo(150, photonLevel);
  energyDiagramCtx.strokeStyle = '#ff0000';
  energyDiagramCtx.stroke();

  // Label photon energy
  energyDiagramCtx.fillText('Photon Energy', 155, (vacuumLevel + photonLevel) / 2);

  // Indicate if photon energy is sufficient
  if (photonEnergy >= workFunction) {
    energyDiagramCtx.fillStyle = '#00ff00';
    energyDiagramCtx.fillText('Electron Emitted', 100, fermiLevel - 10);
  } else {
    energyDiagramCtx.fillStyle = '#ff0000';
    energyDiagramCtx.fillText('No Electron Emission', 100, fermiLevel - 10);
  }
}

function createGraphView() {
  // Adjust the canvas width to fit the new layout
  graphCanvas = document.createElement('canvas');
  graphCanvas.width = 280; // Adjusted width
  graphCanvas.height = 200;
  graphCanvas.style.border = '1px solid #ffffff';
  document.getElementById('graph-view').appendChild(graphCanvas);
  graphCtx = graphCanvas.getContext('2d');
}

function updateGraph(frequency, current) {
  // Add data point
  graphData.push({ frequency: frequency, current: current });

  // Keep only the latest 50 data points
  if (graphData.length > 50) {
    graphData.shift();
  }

  // Clear the canvas
  graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

  // Draw axes
  graphCtx.strokeStyle = '#ffffff';
  graphCtx.beginPath();
  graphCtx.moveTo(30, 170);
  graphCtx.lineTo(30, 10);
  graphCtx.lineTo(290, 10);
  graphCtx.stroke();

  // Plot data
  graphCtx.strokeStyle = '#00ff00';
  graphCtx.beginPath();
  graphData.forEach((point, index) => {
    const x = 30 + ((point.frequency - 1) / (maxFrequency - 1)) * 260;
    const y = 170 - (point.current / 100) * 160;
    if (index === 0) {
      graphCtx.moveTo(x, y);
    } else {
      graphCtx.lineTo(x, y);
    }
  });
  graphCtx.stroke();

  // Label axes
  graphCtx.fillStyle = '#ffffff';
  graphCtx.fillText('Frequency (x10^14 Hz)', 100, 190);
  graphCtx.save();
  graphCtx.translate(10, 100);
  graphCtx.rotate(-Math.PI / 2);
  graphCtx.fillText('Current (mA)', 0, 0);
  graphCtx.restore();

  // Draw threshold frequency line
  const thresholdX = 30 + ((thresholdFrequency - 1) / (maxFrequency - 1)) * 260;
  graphCtx.strokeStyle = '#ff0000';
  graphCtx.beginPath();
  graphCtx.moveTo(thresholdX, 170);
  graphCtx.lineTo(thresholdX, 10);
  graphCtx.stroke();
  graphCtx.fillText('f₀', thresholdX - 5, 180);
}

function onWindowResize() {
  camera.aspect = document.getElementById('simulation-area').clientWidth / 700; // Updated aspect ratio
  camera.updateProjectionMatrix();
  renderer.setSize(document.getElementById('simulation-area').clientWidth, 700); // Updated height
}