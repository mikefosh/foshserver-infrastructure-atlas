# foshserver — Infrastructure Atlas

An interactive 3D map of a full-tower Ubuntu homelab. Visitors can orbit the
chassis, zoom, explode the assembly, and click any component to read what it
does and why it was chosen.

Live: <https://atlas.foshinbaur.com>

---

## What this is built with

Nothing. That is deliberate.

The page is plain HTML, CSS and ES modules. The only external code is Three.js,
loaded from a pinned CDN URL:

```
https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js
```

There is **no build step, no bundler, no `node_modules`, and no lockfile**, so
there is also no dependency tree to audit or keep patched. The orbit/zoom
controls are hand-written (`src/scene.js`) rather than pulled from Three's
`examples/jsm/` addons — that avoids the bare `three` import specifier, which
in turn removes the need for an inline `<script type="importmap">`, which is
what lets the site ship a strict `script-src` CSP with no `'unsafe-inline'`.

### Files

| Path | Role |
|---|---|
| `index.html` | Page shell, meta, CSP |
| `src/style.css` | All styling; single dark theme |
| `src/hardware.js` | **The public content.** Component facts and copy |
| `src/scene.js` | Three.js scene: procedural textures, materials, geometry, lighting, camera, picking |
| `src/main.js` | Interaction: pointer, keyboard, panel, labels |
| `_headers` | Cloudflare Pages security headers |
| `favicon.svg` | Site icon |

---

## Local development

No install and no toolchain. Serve the directory over HTTP — opening
`index.html` as a `file://` URL will **not** work, because ES modules are
blocked by the browser's same-origin rules on `file://`.

```bash
cd foshserver-infrastructure-atlas
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

Any static server works equally well (`npx serve`, `caddy file-server`, etc.).

## Build

There is no build. The repository root *is* the deployable artifact.

---

## Deployment — Cloudflare Pages

Git-connected, so every push to `main` redeploys automatically.

| Setting | Value |
|---|---|
| Project name | `foshserver-infrastructure-atlas` |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | *(leave empty)* |
| Build output directory | `/` |

The empty build command is the important part. Selecting the Vite preset would
make the build fail, because there is no `package.json` for it to install from.

### Custom domain

`atlas.foshinbaur.com` is attached through the Pages project's **Custom
domains** tab, not as a hand-made DNS record. Pages then provisions and
validates its own CNAME and issues the certificate. Creating a standalone DNS
record pointing at the `.pages.dev` hostname instead would bypass that
association and leave the certificate unmanaged.

This site is entirely independent of the server it describes. It is not served
from foshserver and does not touch the existing Cloudflare Tunnel.

---

## Public privacy boundary

This is a **public** repository and a **public** site, describing a machine
that lives in someone's home. The boundary is enforced by convention, so it is
written down here and repeated at the top of `src/hardware.js`.

**Publishable** — component makes and models, port and lane counts, capacities,
architectural intent, and the reasoning behind hardware choices.

**Never publishable:**

- Device letters, disk serial numbers, or SMART attributes
- Mount points, filesystem layout, share names, or backup repository paths
- IP addresses, public or private; router, VPN, or tunnel configuration
- Hostnames other than this site's own
- Container names, service ports, or API tokens of any kind
- Anything identifying the household, its members, or its location
- Photographs of the physical build (`.gitignore` excludes `photos/`)

The distinction to hold on to: *what the hardware is* is publishable, *how to
reach it* is not.

### Before pushing

Keep a scan pattern in a local, uncommitted file — `patterns.txt`, already
covered by `.gitignore` — listing the private strings specific to this
environment: address ranges, filesystem roots, the names of any networking or
tunnelling daemons in use, service hostnames, and disk serials. Naming them
here in a public README would itself disclose the infrastructure this file
exists to protect, which is why the list lives outside the repository.

```bash
grep -rInf patterns.txt --exclude-dir=.git . || echo "clean"
```

One expected false positive: the pinned Three.js version number matches most
IP-address patterns.

---

## Updating when the LSI 9207-8i is installed

The card is currently rendered ghosted and labelled *incoming*. Once it is
physically installed and confirmed working, three edits in
`src/hardware.js` retire that state:

1. On the `hba_new` entry, **delete the `status` line**
   (`status: 'INCOMING — NOT YET INSTALLED'`). That single line drives the amber
   badge in the info panel.
2. Change its `sub` from `'Incoming upgrade'` to `'Storage controller'`.
3. On the `hba` (ASM1166) entry, change `sub` to `'Previous SATA controller'`,
   or remove the entry entirely if the card is pulled from the machine.

Then in `src/scene.js`, find the `hba_new` block and raise the two `opacity`
values (`0.16` and `0.2`) to `1`, and delete `transparent: true` from both, so
the card renders solid like every other installed component.

Finally, in `src/main.js`, the `swapBlock()` function renders the
current → incoming timeline. Once the swap is done, either delete the `swap:
true` flag from both entries — which falls back to the normal fact list — or
reword the two row tags from `Installed today` / `Incoming upgrade` to
something retrospective.

Commit and push; Pages redeploys on its own.

---

## Accessibility notes

- Every component is reachable without the 3D view, via the component list
  below the canvas — which is also what a screen reader is pointed at from the
  canvas `role="img"` description.
- Keyboard: arrow keys orbit, `+` / `-` zoom, `R` resets, `E` explodes, `L`
  toggles labels, `P` strips or restores the removable covers, `Escape`
  closes the panel.
- `prefers-reduced-motion` disables the idle auto-rotation, the camera damping,
  and the explode animation, snapping directly to each end state instead.

---

## Accuracy

The visualization is **stylized**. Proportions are approximately 1 unit =
100 mm so the interior reads as a real ATX tower, but no dimension is measured
and nothing here is derived from CAD. It is a diagram, not a model.

The *arrangement* does follow photographs of the actual build in its storage
layout: a top-mounted 360 mm radiator with fans beneath it, a 140 mm rear
exhaust, three 140 mm front intakes, a single seven-drive column at the front
behind a slotted cover plate, the graphics card lying flat in the primary slot
with its fans facing the shroud, the SATA controller a few slots below it, two
M.2 heatsink shields, and a full-length power-supply shroud. The photographs
themselves are not part of the repository.

Rendering is fully procedural: every texture (circuit board, brushed steel,
perforated mesh, drive labels, braided sleeving) is painted onto a canvas at
load time, lighting comes from a small generated environment map plus one
shadow-casting key light, and the case is opaque steel with the side panel
off. Hovering or selecting the power supply or the drive column fades the
shroud or the cover plate that hides it. Five covers are removable with a tap
(top panel, front door, closed side panel, PSU shroud, drive-bay cover
plate); each slides off in its natural direction and fades. The **Panels**
button (or `P`) strips them all or puts them all back.
