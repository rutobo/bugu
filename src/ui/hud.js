// DOM overlay: counters, minimap, toasts, journal and the ending card.
import * as THREE from 'three';
import { groundColor } from '../world/terrainMesh.js';
import { WORLD } from '../world/terrain.js';

const MAP_RANGE = 470; // metres from centre shown on the map
const MAP_PX = 360;

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.toasts = $('toasts');
    this.counters = {
      apples: $('count-apples'),
      edelweiss: $('count-edelweiss'),
      discoveries: $('count-discoveries'),
    };
    this.clock = $('clock');
    this.map = $('minimap');
    this.map.width = this.map.height = MAP_PX;
    this.mapCtx = this.map.getContext('2d');
    this.journal = $('journal');
    this.journalList = $('journal-list');
    this.help = $('help');
    this.mapBase = null;
  }

  bakeMap(terrain) {
    const c = document.createElement('canvas');
    c.width = c.height = MAP_PX;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(MAP_PX, MAP_PX);
    const col = new THREE.Color();
    for (let py = 0; py < MAP_PX; py++) {
      for (let px = 0; px < MAP_PX; px++) {
        const x = (px / MAP_PX - 0.5) * 2 * MAP_RANGE;
        const z = (py / MAP_PX - 0.5) * 2 * MAP_RANGE;
        const h = terrain.getHeight(x, z);
        if (h < WORLD.waterLevel) {
          col.set('#3c7f95');
        } else {
          groundColor(terrain, x, z, h, terrain.getSlope(x, z), col);
          // Hill shading from the north-west.
          const shade = (terrain.getHeight(x - 3, z - 3) - h) * 0.04;
          col.offsetHSL(0, 0, Math.max(-0.12, Math.min(0.12, shade)));
        }
        col.convertLinearToSRGB();
        const k = (py * MAP_PX + px) * 4;
        img.data[k] = col.r * 255;
        img.data[k + 1] = col.g * 255;
        img.data[k + 2] = col.b * 255;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Darken outside the walkable circle.
    ctx.fillStyle = 'rgba(10,16,26,0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, MAP_PX, MAP_PX);
    ctx.arc(MAP_PX / 2, MAP_PX / 2, (WORLD.walkRadius / MAP_RANGE) * (MAP_PX / 2), 0, Math.PI * 2, true);
    ctx.fill();
    this.mapBase = c;
  }

  toMap(x, z) {
    return [(x / MAP_RANGE / 2 + 0.5) * MAP_PX, (z / MAP_RANGE / 2 + 0.5) * MAP_PX];
  }

  drawMap(player, facing, discoveries) {
    const ctx = this.mapCtx;
    ctx.drawImage(this.mapBase, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const d of discoveries) {
      const [mx, my] = this.toMap(d.x, d.z);
      if (d.found) {
        ctx.font = '20px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillText(d.icon, mx, my);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(mx, my, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a3a3a';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText('?', mx, my + 1);
      }
    }
    const [px, py] = this.toMap(player.x, player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-facing + Math.PI);
    ctx.fillStyle = '#ffdd57';
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('N', MAP_PX / 2, 12);
  }

  toggleMap() {
    this.map.classList.toggle('big');
  }

  setCounts({ apples, applesTotal, edelweiss, edelweissTotal, found, foundTotal }) {
    this.counters.apples.textContent = `${apples}/${applesTotal}`;
    this.counters.edelweiss.textContent = `${edelweiss}/${edelweissTotal}`;
    this.counters.discoveries.textContent = `${found}/${foundTotal}`;
  }

  setClock(hours) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const icon = hours >= 6 && hours < 19.5 ? '☀️' : '🌙';
    this.clock.textContent = `${icon} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  toast(title, body = '', { icon = '', big = false, duration = 6 } = {}) {
    const el = document.createElement('div');
    el.className = `toast${big ? ' big' : ''}`;
    el.innerHTML = `<div class="toast-title">${icon ? `<span class="toast-icon">${icon}</span>` : ''}${title}</div>${body ? `<div class="toast-body">${body}</div>` : ''}`;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 600);
    }, duration * 1000);
  }

  renderJournal(discoveries, hintFor) {
    this.journalList.innerHTML = discoveries
      .map(
        (d) => `<li class="${d.found ? 'found' : ''}">
          <span class="j-icon">${d.found ? d.icon : '❔'}</span>
          <div><div class="j-name">${d.found ? d.name : '???'}</div>
          <div class="j-text">${d.found ? d.text : hintFor(d)}</div></div>
        </li>`
      )
      .join('');
  }

  toggleJournal(discoveries, hintFor) {
    const open = this.journal.classList.toggle('open');
    if (open) this.renderJournal(discoveries, hintFor);
    return open;
  }

  toggleHelp() {
    this.help.classList.toggle('hidden');
  }

  showEnding(stats) {
    const el = $('ending');
    $('ending-stats').innerHTML = `
      <div>🍎 Wild apples: <b>${stats.apples}/${stats.applesTotal}</b></div>
      <div>🌼 Edelweiss: <b>${stats.edelweiss}/${stats.edelweissTotal}</b></div>
      <div>🧭 Discoveries: <b>${stats.found}/${stats.foundTotal}</b></div>
      <div>⏱️ Time wandering: <b>${Math.floor(stats.seconds / 60)} min</b></div>`;
    this.toasts.replaceChildren();
    document.exitPointerLock?.();
    el.classList.add('open');
    $('ending-close').onclick = () => {
      el.classList.remove('open');
      document.getElementById('game').requestPointerLock?.()?.catch?.(() => {});
    };
  }
}
