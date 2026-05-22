const HOTSPOT_POSITIONS = {
  shortTubePort: { x: -1.35, y: 4.45, z: 0.24 },
  connectorPort: { x: -0.48, y: 4.48, z: 0.12 },
  longTubePort: { x: 1.85, y: 4.54, z: 0.06 },
};

function vector(THREE, point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function createTube(THREE, points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 48, radius, 18, false);
  return new THREE.Mesh(geometry, material);
}

function createScaleMarks(THREE, height, count, color) {
  const group = new THREE.Group();
  const markMaterial = new THREE.MeshBasicMaterial({ color });

  for (let index = 0; index < count; index += 1) {
    const width = index % 5 === 0 ? 0.3 : 0.18;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.025, 0.025),
      markMaterial,
    );
    mark.position.set(0, -height / 2 + (index / (count - 1)) * height, 0);
    group.add(mark);
  }

  return group;
}

function addEdges(THREE, mesh, color) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
  });
  const lines = new THREE.LineSegments(edges, lineMaterial);
  mesh.add(lines);
}

function createHotspot(THREE, portId) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 18, 18),
    new THREE.MeshStandardMaterial({
      color: '#7fc7ff',
      emissive: '#255173',
      emissiveIntensity: 1.08,
      roughness: 0.25,
      metalness: 0.08,
    }),
  );
  mesh.position.copy(vector(THREE, HOTSPOT_POSITIONS[portId]));
  mesh.userData.portId = portId;
  return mesh;
}

function tubeMaterial(THREE, isCorrect) {
  return new THREE.MeshPhongMaterial({
    color: isCorrect === null ? '#dff5ff' : isCorrect ? '#88e0a4' : '#ffb1b1',
    transparent: true,
    opacity: 0.68,
    shininess: 95,
    specular: new THREE.Color('#ffffff'),
  });
}

function getPreviewEnd(THREE, startPortId) {
  return startPortId === 'longTubePort'
    ? new THREE.Vector3(-0.1, 6.05, -1.18)
    : new THREE.Vector3(1.6, 6.15, -1.18);
}

function getStandaloneEnd(THREE, portId) {
  if (portId === 'shortTubePort') {
    return new THREE.Vector3(-2.32, 6.18, -0.9);
  }
  if (portId === 'connectorPort') {
    return new THREE.Vector3(0.55, 6.32, -1.18);
  }
  return new THREE.Vector3(2.62, 6.26, -0.96);
}

function buildDynamicTube(THREE, startPortId, endPortId, isCorrect) {
  const start = vector(THREE, HOTSPOT_POSITIONS[startPortId]);
  const end = endPortId
    ? vector(THREE, HOTSPOT_POSITIONS[endPortId])
    : getPreviewEnd(THREE, startPortId);
  const lift = Math.max(start.y, end.y) + 1.45;
  return createTube(
    THREE,
    [
      start.clone(),
      start.clone().add(new THREE.Vector3(0.06, 0.9, -0.24)),
      new THREE.Vector3((start.x + end.x) / 2, lift, -1.08),
      end.clone().add(new THREE.Vector3(0.04, 0.86, -0.22)),
      end.clone(),
    ],
    0.1,
    tubeMaterial(THREE, isCorrect),
  );
}

function buildPatientTube(THREE, portId, isCorrect) {
  const start = vector(THREE, HOTSPOT_POSITIONS[portId]);
  const end = getStandaloneEnd(THREE, portId);
  return createTube(
    THREE,
    [
      start.clone(),
      start.clone().add(new THREE.Vector3(0.04, 0.92, -0.25)),
      new THREE.Vector3((start.x + end.x) / 2, end.y - 0.55, -1.28),
      end.clone().add(new THREE.Vector3(0, -0.22, 0)),
      end.clone(),
    ],
    0.105,
    tubeMaterial(THREE, isCorrect),
  );
}

function buildModel(THREE) {
  const root = new THREE.Group();
  root.position.y = -1.8;
  root.rotation.y = 0.52;

  const white = new THREE.MeshPhongMaterial({
    color: '#f8fbff',
    shininess: 34,
    specular: new THREE.Color('#f8fdff'),
  });
  const shell = new THREE.MeshPhongMaterial({
    color: '#bfd4ff',
    transparent: true,
    opacity: 0.28,
    shininess: 120,
    specular: new THREE.Color('#eef6ff'),
  });
  const blue = new THREE.MeshPhongMaterial({
    color: '#6d82c6',
    transparent: true,
    opacity: 0.78,
    shininess: 48,
    specular: new THREE.Color('#b8c9ff'),
  });
  const water = new THREE.MeshPhongMaterial({
    color: '#89abf2',
    transparent: true,
    opacity: 0.52,
    shininess: 70,
    specular: new THREE.Color('#d8e8ff'),
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.24, 2.5), white);
  base.position.set(0.3, 0.02, 0);
  root.add(base);

  const top = new THREE.Mesh(new THREE.BoxGeometry(5.55, 0.24, 2.6), white);
  top.position.set(0.3, 3.96, 0);
  root.add(top);

  const leftBottle = new THREE.Mesh(new THREE.BoxGeometry(3.45, 3.68, 2.02), shell);
  leftBottle.position.set(-0.65, 1.95, 0);
  addEdges(THREE, leftBottle, '#8ca4c9');
  root.add(leftBottle);

  const rightBottle = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.68, 2.02), shell);
  rightBottle.position.set(2, 1.95, 0);
  addEdges(THREE, rightBottle, '#8ca4c9');
  root.add(rightBottle);

  const divider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.68, 1.96), white);
  divider.position.set(0.98, 1.95, 0);
  root.add(divider);

  const sideRailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.22), white);
  sideRailLeft.position.set(-2.42, 2.05, 1.03);
  root.add(sideRailLeft);

  const sideRailRight = sideRailLeft.clone();
  sideRailRight.position.set(3.06, 2.05, 1.03);
  root.add(sideRailRight);

  const sideRailBackLeft = sideRailLeft.clone();
  sideRailBackLeft.position.set(-2.42, 2.05, -1.03);
  root.add(sideRailBackLeft);

  const sideRailBackRight = sideRailLeft.clone();
  sideRailBackRight.position.set(3.06, 2.05, -1.03);
  root.add(sideRailBackRight);

  const handleLeft = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.06, 16, 24, Math.PI),
    white,
  );
  handleLeft.rotation.set(0, Math.PI / 2, Math.PI / 2);
  handleLeft.position.set(-2.54, 2.0, 0);
  root.add(handleLeft);

  const handleRight = handleLeft.clone();
  handleRight.position.set(3.18, 2.0, 0);
  root.add(handleRight);

  const leftCap = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.34, 28), white);
  leftCap.scale.x = 1.28;
  leftCap.position.set(-0.95, 4.06, 0);
  root.add(leftCap);

  const rightCap = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.32, 28), white);
  rightCap.position.set(1.95, 4.06, 0);
  root.add(rightCap);

  const nozzles = ['shortTubePort', 'connectorPort', 'longTubePort'];
  nozzles.forEach((portId) => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.56, 18), white);
    nozzle.position.copy(vector(THREE, HOTSPOT_POSITIONS[portId])).add(new THREE.Vector3(0, -0.22, 0));
    root.add(nozzle);
  });

  const shortInnerTube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 18), white);
  shortInnerTube.position.set(-1.35, 3.1, 0.24);
  root.add(shortInnerTube);

  const longInnerTube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.45, 18), white);
  longInnerTube.rotation.z = 0.06;
  longInnerTube.position.set(1.92, 2.7, 0.04);
  root.add(longInnerTube);

  const columnA = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.55, 0.4), blue);
  columnA.position.set(0.04, 1.6, 0.24);
  root.add(columnA);

  const columnB = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.3, 0.4), blue);
  columnB.position.set(0.44, 1.46, 0.24);
  root.add(columnB);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.18, 0.4), blue);
  bridge.position.set(0.24, 2.76, 0.24);
  root.add(bridge);

  const leftWater = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.34, 1.7), water);
  leftWater.position.set(-0.7, 0.34, 0);
  root.add(leftWater);

  const rightWater = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.68, 1.7), water);
  rightWater.position.set(2, 0.52, 0);
  root.add(rightWater);

  const leftScale = createScaleMarks(THREE, 3.1, 12, '#5c7396');
  leftScale.position.set(-2.05, 2.0, 1.02);
  root.add(leftScale);

  const rightScale = createScaleMarks(THREE, 3.28, 14, '#5c7396');
  rightScale.position.set(2.7, 2.05, 1.02);
  root.add(rightScale);

  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 5.2, 0.28, 42),
    new THREE.MeshStandardMaterial({
      color: '#dbe8f3',
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  stage.position.set(0.3, -1.95, 0);

  const stageShadow = new THREE.Mesh(
    new THREE.RingGeometry(4.2, 5.1, 42),
    new THREE.MeshBasicMaterial({
      color: '#c8d8e6',
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    }),
  );
  stageShadow.rotation.x = -Math.PI / 2;
  stageShadow.position.set(0.3, -1.8, 0);

  const hotspots = {
    shortTubePort: createHotspot(THREE, 'shortTubePort'),
    connectorPort: createHotspot(THREE, 'connectorPort'),
    longTubePort: createHotspot(THREE, 'longTubePort'),
  };
  Object.keys(hotspots).forEach((key) => root.add(hotspots[key]));

  return { root, stage, stageShadow, hotspots };
}

module.exports = {
  HOTSPOT_POSITIONS,
  buildDynamicTube,
  buildPatientTube,
  buildModel,
};
