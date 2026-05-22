import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ConnectionAnswer, GameResult, HotspotId } from '../types/game';

type ViewerProps = {
  answer: ConnectionAnswer;
  result: GameResult | null;
  disabled?: boolean;
  onSelectPort: (portId: HotspotId) => void;
};

type HotspotMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

const HOTSPOT_POSITIONS: Record<HotspotId, THREE.Vector3> = {
  shortTubePort: new THREE.Vector3(-1.4, 4.48, 0.28),
  connectorPort: new THREE.Vector3(-0.55, 4.5, 0.16),
  longTubePort: new THREE.Vector3(1.9, 4.58, 0.08),
};

function addEdges(mesh: THREE.Mesh, color = '#8ca4c9') {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
  });
  const lines = new THREE.LineSegments(edges, lineMaterial);
  mesh.add(lines);
}

function createScaleMarks(height: number, count: number, color = '#5c7396') {
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

function createTube(points: THREE.Vector3[], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 48, radius, 18, false);
  return new THREE.Mesh(geometry, material);
}

function createHotspot(position: THREE.Vector3, portId: HotspotId): HotspotMesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 24),
    new THREE.MeshStandardMaterial({
      color: '#7fc7ff',
      emissive: '#2e5e84',
      emissiveIntensity: 1.15,
      metalness: 0.1,
      roughness: 0.26,
    }),
  );
  mesh.position.copy(position);
  mesh.userData.portId = portId;
  return mesh;
}

function buildDynamicTube(start: THREE.Vector3, end: THREE.Vector3, isCorrect: boolean | null) {
  const material = new THREE.MeshPhysicalMaterial({
    color: isCorrect === null ? '#dff5ff' : isCorrect ? '#88e0a4' : '#ffb1b1',
    transparent: true,
    opacity: 0.7,
    transmission: 0.72,
    roughness: 0.05,
    metalness: 0,
    thickness: 1.35,
  });

  const lift = Math.max(start.y, end.y) + 1.6;
  const curve = [
    start.clone(),
    start.clone().add(new THREE.Vector3(0.05, 0.9, -0.25)),
    new THREE.Vector3((start.x + end.x) / 2, lift, -1.18),
    end.clone().add(new THREE.Vector3(0.05, 0.95, -0.25)),
    end.clone(),
  ];

  return createTube(curve, 0.105, material);
}

function buildStandaloneOutletTube(portId: HotspotId, isCorrect: boolean | null = null) {
  const start = HOTSPOT_POSITIONS[portId];
  const material = new THREE.MeshPhysicalMaterial({
    color: isCorrect === null ? '#dff5ff' : isCorrect ? '#88e0a4' : '#ffb1b1',
    transparent: true,
    opacity: 0.72,
    transmission: 0.72,
    roughness: 0.05,
    metalness: 0,
    thickness: 1.35,
  });

  const end =
    portId === 'shortTubePort'
      ? new THREE.Vector3(-2.32, 6.18, -0.9)
      : portId === 'connectorPort'
        ? new THREE.Vector3(0.55, 6.32, -1.18)
        : new THREE.Vector3(2.62, 6.26, -0.96);

  const curve = [
    start.clone(),
    start.clone().add(new THREE.Vector3(0.04, 0.92, -0.25)),
    new THREE.Vector3((start.x + end.x) / 2, end.y - 0.55, -1.28),
    end.clone().add(new THREE.Vector3(0, -0.22, 0)),
    end.clone(),
  ];

  return createTube(curve, 0.105, material);
}

function getPreviewEnd(startPortId: HotspotId) {
  return startPortId === 'longTubePort'
    ? new THREE.Vector3(-0.1, 6.05, -1.18)
    : new THREE.Vector3(1.6, 6.15, -1.18);
}

function buildDrainageBottleModel() {
  const root = new THREE.Group();
  root.position.y = -1.8;
  root.rotation.y = 0.52;

  const plasticWhite = new THREE.MeshPhysicalMaterial({
    color: '#f7f9ff',
    roughness: 0.42,
    metalness: 0.04,
    clearcoat: 0.5,
    clearcoatRoughness: 0.24,
  });

  const clearShell = new THREE.MeshPhysicalMaterial({
    color: '#c9dcff',
    transparent: true,
    opacity: 0.34,
    transmission: 0.42,
    thickness: 1.6,
    roughness: 0.08,
    metalness: 0,
    ior: 1.18,
  });

  const blueInner = new THREE.MeshPhysicalMaterial({
    color: '#7187c8',
    transparent: true,
    opacity: 0.72,
    roughness: 0.2,
    metalness: 0.04,
  });

  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: '#93b1f5',
    transparent: true,
    opacity: 0.46,
    roughness: 0.08,
    transmission: 0.15,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.24, 2.5), plasticWhite);
  base.position.set(0.3, 0.02, 0);
  root.add(base);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(5.55, 0.24, 2.6), plasticWhite);
  topFrame.position.set(0.3, 3.96, 0);
  root.add(topFrame);

  const leftBottle = new THREE.Mesh(new THREE.BoxGeometry(3.45, 3.68, 2.02), clearShell);
  leftBottle.position.set(-0.65, 1.95, 0);
  addEdges(leftBottle);
  root.add(leftBottle);

  const rightBottle = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.68, 2.02), clearShell);
  rightBottle.position.set(2, 1.95, 0);
  addEdges(rightBottle);
  root.add(rightBottle);

  const centerPartition = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.68, 1.96), plasticWhite);
  centerPartition.position.set(0.98, 1.95, 0);
  root.add(centerPartition);

  const sideRailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.22), plasticWhite);
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

  const handleLeft = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 16, 24, Math.PI), plasticWhite);
  handleLeft.rotation.set(0, Math.PI / 2, Math.PI / 2);
  handleLeft.position.set(-2.54, 2.0, 0);
  root.add(handleLeft);

  const handleRight = handleLeft.clone();
  handleRight.position.set(3.18, 2.0, 0);
  root.add(handleRight);

  const leftCap = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.34, 36), plasticWhite);
  leftCap.scale.x = 1.28;
  leftCap.position.set(-0.95, 4.06, 0);
  root.add(leftCap);

  const rightCap = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.32, 36), plasticWhite);
  rightCap.position.set(1.95, 4.06, 0);
  root.add(rightCap);

  const shortNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.54, 24), plasticWhite);
  shortNozzle.position.copy(HOTSPOT_POSITIONS.shortTubePort).add(new THREE.Vector3(0, -0.2, 0));
  root.add(shortNozzle);

  const connectorNozzle = shortNozzle.clone();
  connectorNozzle.position.copy(HOTSPOT_POSITIONS.connectorPort).add(new THREE.Vector3(0, -0.2, 0));
  root.add(connectorNozzle);

  const longNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.58, 24), plasticWhite);
  longNozzle.position.copy(HOTSPOT_POSITIONS.longTubePort).add(new THREE.Vector3(0, -0.24, 0));
  root.add(longNozzle);

  const shortInnerTube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 22), plasticWhite);
  shortInnerTube.position.set(-1.4, 3.15, 0.28);
  root.add(shortInnerTube);

  const longInnerTube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.5, 24), plasticWhite);
  longInnerTube.rotation.z = 0.06;
  longInnerTube.position.set(1.94, 2.75, 0.05);
  root.add(longInnerTube);

  const leftColumnA = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.42), blueInner);
  leftColumnA.position.set(0.05, 1.62, 0.28);
  root.add(leftColumnA);

  const leftColumnB = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.35, 0.42), blueInner);
  leftColumnB.position.set(0.45, 1.48, 0.28);
  root.add(leftColumnB);

  const columnBridge = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.18, 0.42), blueInner);
  columnBridge.position.set(0.25, 2.8, 0.28);
  root.add(columnBridge);

  const rightWater = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.68, 1.7), waterMaterial);
  rightWater.position.set(2, 0.52, 0);
  root.add(rightWater);

  const leftWater = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.34, 1.7), waterMaterial);
  leftWater.position.set(-0.7, 0.34, 0);
  root.add(leftWater);

  const leftScale = createScaleMarks(3.1, 12);
  leftScale.position.set(-2.05, 2.0, 1.02);
  root.add(leftScale);

  const rightScale = createScaleMarks(3.28, 14);
  rightScale.position.set(2.7, 2.05, 1.02);
  root.add(rightScale);

  const hotspots = {
    shortTubePort: createHotspot(HOTSPOT_POSITIONS.shortTubePort, 'shortTubePort'),
    connectorPort: createHotspot(HOTSPOT_POSITIONS.connectorPort, 'connectorPort'),
    longTubePort: createHotspot(HOTSPOT_POSITIONS.longTubePort, 'longTubePort'),
  };

  Object.values(hotspots).forEach((hotspot) => {
    root.add(hotspot);
  });

  return { root, hotspots };
}

export function DrainageModelViewer({
  answer,
  result,
  disabled = false,
  onSelectPort,
}: ViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectPort);
  const stateRef = useRef({
    answer,
    result,
    disabled,
  });

  useEffect(() => {
    onSelectRef.current = onSelectPort;
  }, [onSelectPort]);

  useEffect(() => {
    stateRef.current = {
      answer,
      result,
      disabled,
    };
  }, [answer, result, disabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const host = container;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(6.4, 4.4, 7.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 6.2;
    controls.maxDistance = 10.2;
    controls.minPolarAngle = 0.75;
    controls.maxPolarAngle = 1.45;
    controls.target.set(0.1, 1.8, 0);

    scene.add(new THREE.AmbientLight('#f3fbff', 1.9));

    const mainLight = new THREE.DirectionalLight('#ffffff', 2.2);
    mainLight.position.set(8, 10, 7);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight('#8fc0ff', 1.1);
    fillLight.position.set(-6, 5, -8);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight('#6ec6ff', 34, 24, 2);
    rimLight.position.set(0, 6.2, 2.4);
    scene.add(rimLight);

    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 5.2, 0.28, 48),
      new THREE.MeshStandardMaterial({
        color: '#dbe8f3',
        roughness: 0.92,
        metalness: 0.04,
      }),
    );
    stage.position.set(0.3, -1.95, 0);
    scene.add(stage);

    const stageShadow = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 5.1, 64),
      new THREE.MeshBasicMaterial({
        color: '#c8d8e6',
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    stageShadow.rotation.x = -Math.PI / 2;
    stageShadow.position.set(0.3, -1.8, 0);
    scene.add(stageShadow);

    const { root, hotspots } = buildDrainageBottleModel();
    scene.add(root);

    const hotspotList = Object.values(hotspots);
    const portMaterialMap = new Map(
      Object.entries(hotspots).map(([portId, mesh]) => [portId as HotspotId, mesh.material]),
    );

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let animationFrame = 0;
    let pointerDown = { x: 0, y: 0 };
    let currentConnectionTube: THREE.Mesh | null = null;
    let currentRemainingTube: THREE.Mesh | null = null;
    let tubeSignature = '';

    function disposeDynamicTube(mesh: THREE.Mesh | null) {
      if (!mesh) {
        return;
      }

      root.remove(mesh);
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
    }

    function resize() {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const isCompact = width <= 720;
      const isTablet = width <= 1100;

      camera.fov = isCompact ? 42 : isTablet ? 38 : 34;

      if (isCompact) {
        camera.position.set(7.8, 5.25, 10.4);
        controls.target.set(0.2, 1.15, 0);
        controls.minDistance = 7.8;
        controls.maxDistance = 13.4;
      } else if (isTablet) {
        camera.position.set(6.9, 4.8, 8.8);
        controls.target.set(0.15, 1.45, 0);
        controls.minDistance = 6.8;
        controls.maxDistance = 11.6;
      } else {
        camera.position.set(6.4, 4.4, 7.4);
        controls.target.set(0.1, 1.8, 0);
        controls.minDistance = 6.2;
        controls.maxDistance = 10.2;
      }

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      controls.update();
      renderer.setSize(width, height, false);
    }

    function syncDynamicTube() {
      const { firstPortId, secondPortId } = stateRef.current.answer;
      const { patientPortId } = stateRef.current.answer;
      const signature = `${firstPortId || 'none'}-${secondPortId || 'none'}-${patientPortId || 'none'}-${stateRef.current.result?.isCorrect ?? 'pending'}`;

      if (signature === tubeSignature) {
        return;
      }

      disposeDynamicTube(currentConnectionTube);
      disposeDynamicTube(currentRemainingTube);
      currentConnectionTube = null;
      currentRemainingTube = null;

      tubeSignature = signature;
      if (!firstPortId) {
        return;
      }

      const start = HOTSPOT_POSITIONS[firstPortId];
      const end = secondPortId
        ? HOTSPOT_POSITIONS[secondPortId]
        : getPreviewEnd(firstPortId);

      currentConnectionTube = buildDynamicTube(
        start,
        end,
        stateRef.current.result
          ? stateRef.current.result.details[0]?.pairIsCorrect ?? false
          : null,
      );
      root.add(currentConnectionTube);

      if (patientPortId) {
        const patientTubeIsCorrect = stateRef.current.result
          ? stateRef.current.result.details[0]?.patientTubeIsCorrect ?? false
          : null;
        currentRemainingTube = buildStandaloneOutletTube(patientPortId, patientTubeIsCorrect);
        root.add(currentRemainingTube);
      }
    }

    function paintHotspots(time: number) {
      const selectedSet = new Set(
        [stateRef.current.answer.firstPortId, stateRef.current.answer.secondPortId].filter(
          Boolean,
        ) as HotspotId[],
      );
      const correctSet = new Set(
        (stateRef.current.result?.details[0]?.correctPortIds || []) as HotspotId[],
      );
      const pulse = 1 + Math.sin(time * 0.0025) * 0.07;

      hotspotList.forEach((hotspot) => {
        const material = hotspot.material;
        const portId = hotspot.userData.portId as HotspotId;
        const isSelected = selectedSet.has(portId);
        const isCorrectPort = correctSet.has(portId);

        let color = '#79c9ff';
        let emissive = '#255173';
        let scale = 1;

        if (stateRef.current.result) {
          if (isCorrectPort) {
            color = '#5bd17d';
            emissive = '#1f6c3c';
            scale = 1.14;
          }
          if (isSelected && !isCorrectPort) {
            color = '#ff7b7b';
            emissive = '#8f2c37';
            scale = 1.14;
          }
        } else if (isSelected) {
          color = '#f5b35f';
          emissive = '#8a5b16';
          scale = 1.1;
        } else if (!stateRef.current.disabled) {
          scale = pulse;
        }

        material.color.set(color);
        material.emissive.set(emissive);
        hotspot.scale.setScalar(scale);
      });
    }

    function animate(time: number) {
      controls.update();
      syncDynamicTube();
      paintHotspots(time);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    }

    function setPointer(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function handlePointerDown(event: PointerEvent) {
      pointerDown = { x: event.clientX, y: event.clientY };
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(hotspotList, false);
      renderer.domElement.style.cursor = intersections.length > 0 ? 'pointer' : 'grab';
    }

    function handlePointerMove(event: PointerEvent) {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(hotspotList, false);
      renderer.domElement.style.cursor = intersections.length > 0 ? 'pointer' : 'grab';
    }

    function handlePointerUp(event: PointerEvent) {
      const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      if (moved > 10 || stateRef.current.disabled) {
        return;
      }

      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(hotspotList, false);

      if (intersections[0]) {
        const portId = intersections[0].object.userData.portId as HotspotId;
        onSelectRef.current(portId);
      }
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.style.cursor = 'grab';
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      disposeDynamicTube(currentConnectionTube);
      disposeDynamicTube(currentRemainingTube);
      controls.dispose();
      portMaterialMap.forEach((material) => material.dispose());
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material: THREE.Material) => material.dispose());
          } else if (!portMaterialMap.has(object.userData.portId as HotspotId)) {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="viewer-canvas" ref={containerRef} />;
}
