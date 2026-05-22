const { createScopedThreejs } = require('threejs-miniprogram');
const {
  buildDynamicTube,
  buildModel,
  buildPatientTube,
} = require('../../utils/drainage3d');

const PORT_LABELS = {
  shortTubePort: '引流管接口',
  connectorPort: '排气口',
  longTubePort: '水封管接口',
};

const EMPTY_ANSWER = {
  firstPortId: null,
  secondPortId: null,
  patientPortId: null,
};

Page({
  data: {
    playerName: '',
    sessionId: '',
    startedAt: '',
    answer: EMPTY_ANSWER,
    result: null,
    statusText: '先连接排气口和水封管接口，再连接引流病人的管。',
    errorText: '',
    starting: false,
    submitting: false,
    progress: 0,
    stepOneText: '未完成',
    stepTwoText: '未完成 -> 引流病人的管',
  },

  onLoad(options) {
    this.setData({
      playerName: options.playerName ? decodeURIComponent(options.playerName) : '',
    });
  },

  onReady() {
    this.initScene();
  },

  onUnload() {
    if (this.canvas && this.canvas.cancelAnimationFrame && this.rafId) {
      this.canvas.cancelAnimationFrame(this.rafId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  },

  describePort(portId) {
    return PORT_LABELS[portId] || '未选择';
  },

  async initScene() {
    const query = wx.createSelectorQuery();
    query.select('#webgl').fields({ node: true, size: true });
    query.select('#webgl').boundingClientRect();
    query.exec((res) => {
      const canvasInfo = res[0];
      const rect = res[1];
      const canvas = canvasInfo.node;
      const width = canvasInfo.width;
      const height = canvasInfo.height;
      const dpr = wx.getSystemInfoSync().pixelRatio;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const THREE = createScopedThreejs(canvas);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(7.7, 5.2, 10.2);
      camera.lookAt(new THREE.Vector3(0.2, 1.15, 0));

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);

      scene.add(new THREE.AmbientLight('#f3fbff', 1.5));

      const skyLight = new THREE.HemisphereLight('#edf8ff', '#d8e6f2', 0.58);
      scene.add(skyLight);

      const mainLight = new THREE.DirectionalLight('#ffffff', 2.2);
      mainLight.position.set(8, 10, 7);
      scene.add(mainLight);

      const fillLight = new THREE.DirectionalLight('#8fc0ff', 1.08);
      fillLight.position.set(-6, 5, -8);
      scene.add(fillLight);

      const rimLight = new THREE.PointLight('#6ec6ff', 30, 24, 2);
      rimLight.position.set(0, 6.2, 2.4);
      scene.add(rimLight);

      const floorLight = new THREE.PointLight('#dceeff', 10, 18, 2);
      floorLight.position.set(0.4, -0.6, 3.1);
      scene.add(floorLight);

      const { root, stage, stageShadow, hotspots } = buildModel(THREE);
      scene.add(stageShadow);
      scene.add(stage);
      scene.add(root);

      this.THREE = THREE;
      this.canvas = canvas;
      this.canvasRect = rect;
      this.renderer = renderer;
      this.scene = scene;
      this.camera = camera;
      this.modelRoot = root;
      this.hotspots = Object.values(hotspots);
      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();
      this.dynamicTube = null;
      this.patientTube = null;
      this.touchState = {
        mode: '',
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        lastDistance: 0,
        moved: false,
      };

      this.syncSceneFromData();
      this.animate(0);
    });
  },

  animate(time = 0) {
    if (!this.renderer) {
      return;
    }
    this.paintHotspots(time);
    this.renderer.render(this.scene, this.camera);
    this.rafId = this.canvas.requestAnimationFrame((nextTime) => this.animate(nextTime));
  },

  setAnswer(answer, statusText) {
    const progress = Number(Boolean(answer.firstPortId && answer.secondPortId)) + Number(Boolean(answer.patientPortId));
    const stepOneText = answer.firstPortId
      ? `${this.describePort(answer.firstPortId)} -> ${answer.secondPortId ? this.describePort(answer.secondPortId) : '未完成'}`
      : '未完成';
    const stepTwoText = `${answer.patientPortId ? this.describePort(answer.patientPortId) : '未完成'} -> 引流病人的管`;
    this.setData({
      answer,
      statusText,
      progress,
      stepOneText,
      stepTwoText,
    });
    this.syncSceneFromData();
  },

  syncSceneFromData() {
    if (!this.modelRoot || !this.THREE) {
      return;
    }

    if (this.dynamicTube) {
      this.modelRoot.remove(this.dynamicTube);
      this.dynamicTube.geometry.dispose();
      this.dynamicTube.material.dispose();
      this.dynamicTube = null;
    }

    if (this.patientTube) {
      this.modelRoot.remove(this.patientTube);
      this.patientTube.geometry.dispose();
      this.patientTube.material.dispose();
      this.patientTube = null;
    }

    const answer = this.data.answer;
    const detail = this.data.result ? this.data.result.details[0] : null;

    if (answer.firstPortId) {
      this.dynamicTube = buildDynamicTube(
        this.THREE,
        answer.firstPortId,
        answer.secondPortId,
        detail ? detail.pairIsCorrect : null,
      );
      this.modelRoot.add(this.dynamicTube);
    }

    if (answer.patientPortId) {
      this.patientTube = buildPatientTube(
        this.THREE,
        answer.patientPortId,
        detail ? detail.patientTubeIsCorrect : null,
      );
      this.modelRoot.add(this.patientTube);
    }
  },

  paintHotspots(time) {
    if (!this.hotspots) {
      return;
    }
    const answer = this.data.answer;
    const detail = this.data.result ? this.data.result.details[0] : null;
    const selected = [answer.firstPortId, answer.secondPortId, answer.patientPortId].filter(Boolean);

    const pulse = 1 + Math.sin(time * 0.0025) * 0.07;

    this.hotspots.forEach((mesh) => {
      const portId = mesh.userData.portId;
      let color = '#79c9ff';
      let emissive = '#255173';
      let scale = 1;

      if (detail) {
        if (detail.correctPortIds.indexOf(portId) >= 0 || detail.correctPatientPortId === portId) {
          color = '#5bd17d';
          emissive = '#1f6c3c';
          scale = 1.14;
        }
        if (selected.indexOf(portId) >= 0 && detail.isCorrect === false) {
          color = '#ff8b8b';
          emissive = '#8f2c37';
          scale = 1.14;
        }
      } else if (selected.indexOf(portId) >= 0) {
        color = '#f5b35f';
        emissive = '#8a5b16';
        scale = 1.1;
      } else {
        scale = pulse;
      }

      mesh.material.color.set(color);
      mesh.material.emissive.set(emissive);
      mesh.scale.setScalar(scale);
    });
  },

  onTouchStart(event) {
    const touches = event.touches || [];
    if (!touches.length) {
      return;
    }

    if (touches.length >= 2) {
      const distance = this.touchDistance(touches[0], touches[1]);
      this.touchState = {
        mode: 'pinch',
        lastDistance: distance,
        moved: false,
      };
      return;
    }

    this.touchState = {
      mode: 'rotate',
      startX: touches[0].x,
      startY: touches[0].y,
      lastX: touches[0].x,
      lastY: touches[0].y,
      moved: false,
    };
  },

  onTouchMove(event) {
    if (!this.modelRoot) {
      return;
    }

    const touches = event.touches || [];
    if (touches.length >= 2) {
      const distance = this.touchDistance(touches[0], touches[1]);
      if (this.touchState.mode === 'pinch' && this.touchState.lastDistance) {
        const delta = distance - this.touchState.lastDistance;
        const scale = Math.max(0.82, Math.min(1.28, this.modelRoot.scale.x + delta * 0.002));
        this.modelRoot.scale.set(scale, scale, scale);
      }
      this.touchState.lastDistance = distance;
      this.touchState.moved = true;
      return;
    }

    const touch = touches[0];
    if (!touch || this.touchState.mode !== 'rotate') {
      return;
    }

    const dx = touch.x - this.touchState.lastX;
    const dy = touch.y - this.touchState.lastY;
    this.modelRoot.rotation.y += dx * 0.01;
    this.modelRoot.rotation.x = Math.max(-0.25, Math.min(0.35, this.modelRoot.rotation.x + dy * 0.004));
    this.touchState.lastX = touch.x;
    this.touchState.lastY = touch.y;
    this.touchState.moved = true;
  },

  onTouchEnd(event) {
    if (!this.hotspots || !this.canvasRect || !this.raycaster || !this.pointer) {
      return;
    }

    if (this.touchState.moved) {
      this.touchState.mode = '';
      return;
    }

    const touch = (event.changedTouches || [])[0];
    if (!touch) {
      return;
    }

    const x = ((touch.x - this.canvasRect.left) / this.canvasRect.width) * 2 - 1;
    const y = -((touch.y - this.canvasRect.top) / this.canvasRect.height) * 2 + 1;
    this.pointer.set(x, y);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hotspots, false);

    if (hits.length) {
      this.selectPort(hits[0].object.userData.portId);
    }
  },

  touchDistance(first, second) {
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  selectPort(portId) {
    if (!this.data.sessionId || this.data.result) {
      return;
    }

    const answer = { ...this.data.answer };

    if (!answer.firstPortId) {
      answer.firstPortId = portId;
      this.setAnswer(answer, '第一步已选择起点，请继续连接排气口和水封管接口。');
      return;
    }

    if (!answer.secondPortId) {
      if (answer.firstPortId === portId) {
        this.setData({ statusText: '第一步不能重复点击同一个接口。' });
        return;
      }
      answer.secondPortId = portId;
      this.setAnswer(answer, '第一步已完成。请点击剩余的那个孔，接上引流病人的管。');
      return;
    }

    if (portId === answer.firstPortId || portId === answer.secondPortId) {
      this.setData({ statusText: '第二步必须接在剩下的那个孔上。' });
      return;
    }

    answer.patientPortId = portId;
    this.setAnswer(answer, '两步接管都已完成，可以提交判定。');
  },

  onNameInput(event) {
    this.setData({ playerName: event.detail.value });
  },

  async handleStart() {
    this.setData({ starting: true, errorText: '', result: null });
    try {
      const response = await wx.cloud.callFunction({
        name: 'gameService',
        data: {
          action: 'startGame',
          playerName: this.data.playerName,
        },
      });
      this.setData({
        sessionId: response.result.sessionId,
        playerName: response.result.playerName,
        startedAt: response.result.startedAt,
        result: null,
      });
      this.setAnswer({ ...EMPTY_ANSWER }, '已开始新一局。先连接排气口和水封管接口。');
    } catch (error) {
      this.setData({ errorText: error.message || '开始挑战失败。' });
    } finally {
      this.setData({ starting: false });
    }
  },

  async handleSubmit() {
    const answer = this.data.answer;
    if (!this.data.sessionId) {
      this.setData({ statusText: '请先开始挑战。' });
      return;
    }
    if (!answer.firstPortId || !answer.secondPortId || !answer.patientPortId) {
      this.setData({ statusText: '请先完成两步接管后再提交。' });
      return;
    }

    this.setData({ submitting: true, errorText: '' });
    try {
      const response = await wx.cloud.callFunction({
        name: 'gameService',
        data: {
          action: 'submitGame',
          sessionId: this.data.sessionId,
          playerName: this.data.playerName,
          source: 'miniprogram',
          startedAt: this.data.startedAt,
          answer,
        },
      });
      this.setData({
        result: response.result.result,
        statusText: response.result.result.isCorrect
          ? '判定正确：排气口接到了水封管接口，剩余孔接上了引流病人的管。'
          : '判定错误：必须先让排气口连接水封管接口，再让剩余孔接引流病人的管。',
      });
      this.syncSceneFromData();
    } catch (error) {
      this.setData({ errorText: error.message || '提交失败。' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index',
        });
      },
    });
  },
});
