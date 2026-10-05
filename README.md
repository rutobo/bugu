# Bugu: a boy in the Tien Shan

A small exploration game built with [three.js](https://threejs.org/). You play a boy spending the summer at his
grandmother's yurt in a valley of the Tien Shan mountains. Roam the Schrenk's spruce forests, alpine meadows and
rocky ridges, gather wild apples and edelweiss, and find the valley's ten secret places.

*Bugu* is Kyrgyz for "deer". It also refers to the legend of the Horned Mother Deer, Bugu-Ene, whom you may meet in
the forest.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/ (relative paths, host anywhere)
npm run preview  # serve the build
```

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Walk | `W A S D` / arrows | left thumb stick |
| Run | `Shift` | 🏃 toggle |
| Jump | `Space` | ⤒ |
| Look | mouse (click to lock), `Q`/`E` to turn | drag on the right side |
| Zoom | mouse wheel | none |
| Journal with hints | `J` | 📖 |
| Big map | `M` | none |
| Hurry time | hold `T` | none |
| Sound on/off | `N` | none |

Progress (discoveries and pickups) is saved in `localStorage`.

## What's in the valley

- **Terrain**: a procedural heightfield. A river winds north to south across a meadow floor, spruce-covered walls rise
  into snowy ridges, and an alpine lake (in the spirit of the Kolsay lakes) sits at the northern end. A ring of
  distant snow peaks closes the horizon.
- **Living world**: a day–night cycle with stars and fireflies, wind-swayed grass, flowers and trees, smoke from the
  yurt's tunduk, and steam from a hot spring. Animals include sheep, a horse, marmots that dive into their burrows,
  ibex that flee across the crags, a golden eagle, a rare snow leopard, and Bugu, the mother deer, with her fawn.
- **Goals**: 10 discoveries, 25 wild apples (the Tien Shan is the ancestral home of the apple) and 10 edelweiss.
  Landmarks are placed by searching the terrain, so every one of them can be reached on foot.
- **No asset files**: models are built from primitives, textures are drawn on canvases, and all sound is synthesized
  with the Web Audio API.

## Code map

```
src/
  main.js                renderer, loop, start screen
  game.js                discoveries, collectibles, save/load
  core/                  noise, colliders, wind shader patch, canvas textures
  world/terrain.js       heightfield, reachability flood fill (pure JS, runs in Node)
  world/placement.js     where the yurt, landmarks, animals and pickups go
  world/terrainMesh.js   terrain and backdrop meshes
  world/vegetation.js    instanced, chunked forests, grass, flowers, rocks
  world/props.js         yurt, bridge, balbal, hot spring, cairn, pickups
  world/animals.js       wildlife and livestock
  world/sky.js           sky dome, sun/moon, day–night cycle
  player/                the boy, input, movement and camera
  ui/                    HUD, minimap, journal, procedural audio
```
