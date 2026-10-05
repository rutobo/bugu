import * as THREE from 'three';
import './style.css';
import { World } from './world/world.js';
import { Sky } from './world/sky.js';
import { Boy } from './player/boy.js';
import { Input } from './player/input.js';
import { PlayerController } from './player/controller.js';
import { Hud } from './ui/hud.js';
import { Audio } from './ui/audio.js';
import { Game, hasSave, clearSave } from './game.js';
import { windUniforms } from './core/wind.js';
import { particleUniforms } from './world/particles.js';

const canvas = document.getElementById('game');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const lowEnd = matchMedia('(pointer: coarse)').matches; // phones and tablets
if (isTouch) document.body.classList.add('touch');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  particleUniforms.uScale.value = (innerHeight * renderer.getPixelRatio()) / 2;
}
addEventListener('resize', resize);
resize();

const loading = document.getElementById('loading');
const startBtn = document.getElementById('start-btn');
const newBtn = document.getElementById('new-btn');

// Let the loading text paint before the heavy world generation.
await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

const audio = new Audio();
const hud = new Hud();
const sky = new Sky(scene);
if (lowEnd) sky.sun.shadow.mapSize.set(1024, 1024);
const world = new World(scene, audio);
const boy = new Boy();
scene.add(boy.root);
const input = new Input(canvas);
const player = new PlayerController(boy, camera, world, input);
const { start } = world.plan.sites;
player.spawn(start.x, start.z, -Math.PI / 2 - 0.5); // facing the river, yurt behind
hud.bakeMap(world.terrain);
const game = new Game(scene, world, hud, audio);

player.onStep = (speed) => audio.footstep(speed);
player.onSplash = () => audio.splash();
player.onBlocked = (why) => {
  if (why === 'deep') hud.toast('Too deep!', 'The water here is deep and icy. Better stay on the shore.', { icon: '🌊', duration: 4 });
  else if (why === 'steep') hud.toast('Too steep', 'This slope is too steep to climb. Look for a gentler way up.', { icon: '⛰️', duration: 4 });
};

// Warm up shaders so the first frames don't stutter.
renderer.compile(scene, camera);
renderer.render(scene, camera);

loading.classList.add('hidden');
startBtn.disabled = false;
startBtn.textContent = hasSave() ? 'Continue' : 'Start exploring';
if (hasSave()) newBtn.classList.remove('hidden');

let running = false;
function begin() {
  document.getElementById('start').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  input.enabled = true;
  audio.start();
  running = true;
  if (!input.isTouch) canvas.requestPointerLock?.()?.catch?.(() => {});
  if (!game.isFound('yurt')) {
    hud.toast(
      'Summer in the Tien Shan',
      `You are spending the summer at Grandmother’s yurt. Explore the valley, gather wild apples and edelweiss, and find all ten secret places. ${isTouch ? 'Tap 📖' : 'Press J'} for your journal.`,
      { icon: '🏔️', big: true, duration: 12 }
    );
  } else {
    hud.toast('Welcome back', 'Your journal remembers everything you found.', { icon: '🏔️', duration: 5 });
  }
}
startBtn.addEventListener('click', begin);
document.getElementById('btn-journal').addEventListener('click', () => hud.toggleJournal(game.discoveries, game.hintFor));
newBtn.addEventListener('click', () => {
  clearSave();
  location.reload();
});

let nightAnnounced = false;
const timer = new THREE.Timer();
timer.connect(document);
let time = 0;
let mapTimer = 0;
let titleAngle = 0.6;

function frame(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.05);
  time += dt;
  windUniforms.uWindTime.value = time;

  if (running) {
    if (input.wasPressed('KeyJ')) {
      hud.toggleJournal(game.discoveries, game.hintFor);
    }
    if (input.wasPressed('KeyH')) hud.toggleHelp();
    if (input.wasPressed('KeyM')) hud.toggleMap();
    if (input.wasPressed('KeyN')) {
      const muted = audio.toggleMute();
      hud.toast(muted ? 'Sound off' : 'Sound on', '', { icon: muted ? '🔇' : '🔊', duration: 1.5 });
    }
    sky.speed = input.keys.has('KeyT') ? 30 : 1;
    player.update(dt, time);
    game.update(dt, time, player.pos);
  }

  sky.update(dt, player.pos);
  world.update(dt, time, player.pos, sky.night);

  if (running) {
    audio.update(dt, {
      altitude: player.pos.y,
      waterDist: world.waterDistance(player.pos.x, player.pos.z),
      night: sky.night,
    });
    mapTimer -= dt;
    if (mapTimer <= 0) {
      mapTimer = 0.1;
      hud.drawMap(player.pos, player.facing, game.discoveries);
      hud.setClock(sky.hours);
    }
    if (sky.night > 0.6 && !nightAnnounced) {
      nightAnnounced = true;
      hud.toast('Night falls', `Stars fill the sky and fireflies dance over the meadows.${isTouch ? '' : ' Hold T to hurry the night along.'}`, { icon: '🌙', duration: 8 });
    }
    if (sky.night < 0.1) nightAnnounced = false;
  } else {
    // Slow orbit around the yurt behind the title screen.
    titleAngle += dt * 0.03;
    const y = world.sites.yurt;
    camera.position.set(y.x + Math.cos(titleAngle) * 30, y.y + 11, y.z + Math.sin(titleAngle) * 30);
    camera.lookAt(y.x, y.y + 3, y.z);
  }

  input.endFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for debugging from the console.
window.bugu = { scene, world, player, game, sky, camera, renderer };
