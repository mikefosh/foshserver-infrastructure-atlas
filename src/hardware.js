/* Public-safe hardware facts for the Infrastructure Atlas.
 *
 * PRIVACY BOUNDARY — read before editing.
 * Everything in this file is rendered into a public web page. Only the
 * approved public display values belong here. Never add: device letters
 * (sd*), disk serials, SMART attributes, mount paths, filesystem layout,
 * IP addresses (public or LAN), hostnames other than the public site,
 * tunnel/VPN details, backup repository names or paths, container names,
 * API tokens, or anything identifying the household or its location.
 */

export const COMPONENTS = [
  {
    id: 'chassis',
    name: 'Fractal Define 7 XL',
    short: 'Chassis',
    label: 'ENCLOSURE',
    sub: 'Full-tower server chassis',
    accent: 'cyan',
    facts: [
      'Full-tower form factor',
      'Sound-dampened steel panels',
      'Modular multi-bracket drive layout',
    ],
    desc: [
      'The Define 7 XL is the reason this build works as a server rather than a desktop that happens to be on. Its modular bay system takes far more 3.5" drives than a normal tower, and the dampening panels keep seven spinning disks quiet enough to live in a shared space.',
      'Shown here with the side panel removed, which is how the interior is laid out for airflow: intake at the front across the drive cage, exhaust through the radiator at the top.',
    ],
  },

  {
    id: 'pool',
    name: '75 TB Media Pool',
    short: 'Drive cage',
    label: 'STORAGE',
    sub: 'Front drive cage — mergerfs',
    accent: 'amber',
    facts: [
      '7-drive mergerfs pool',
      '2 × 6 TB + 5 × 14 TB',
      '75 TB usable',
      'JBOD pooling — not RAID',
    ],
    desc: [
      'Seven mechanical drives presented to the operating system as one large filesystem by mergerfs. This is JBOD pooling, not RAID: each disk keeps its own independent filesystem and mergerfs unifies them into a single namespace.',
      'The practical consequence is worth stating plainly, because it is the most misunderstood part of a build like this. Pooling is not redundancy. Losing a disk costs only the files that lived on that disk rather than the whole array, but it still costs those files — the protection comes from a separate backup strategy, not from the pool itself.',
      'A parity layer is planned, which would add reconstruction of a failed drive on top of the existing pooling behaviour.',
    ],
  },

  {
    id: 'cpu',
    name: 'Intel Core i9-11900K',
    short: 'CPU + AIO',
    label: 'COMPUTE',
    sub: '360 mm AIO, top exhaust',
    accent: 'cyan',
    facts: [
      '8 cores / 16 threads',
      '3.5 GHz base · 5.3 GHz turbo',
      '360 mm liquid cooling',
    ],
    desc: [
      'The scheduling core of the server. Media analysis, container orchestration, photo indexing and database work all land here, and the sustained multi-container load is closer to a workstation profile than a desktop one.',
      'The 360 mm AIO exhausts through the top of the case. Cooling headroom matters more than peak clock speed in this role — the machine runs continuously, so the design target is a low, stable temperature under long load rather than a high benchmark score.',
    ],
  },

  {
    id: 'ram',
    name: '128 GB DDR4-3200',
    short: 'Memory',
    label: 'MEMORY',
    sub: '4 × 32 GB TEAMGROUP',
    accent: 'cyan',
    facts: [
      '4 × 32 GB modules',
      'DDR4-3200',
      'Non-ECC',
    ],
    desc: [
      'All four slots populated. On a server this size the memory is spent less on any single process than on breadth: dozens of containers resident at once, plus a very large filesystem cache that keeps frequently-read media and database pages out of the mechanical drives.',
      'Non-ECC, which is a deliberate cost tradeoff rather than an oversight — the platform is a consumer desktop chipset, and data integrity is handled at the backup layer instead.',
    ],
  },

  {
    id: 'gpu',
    name: 'NVIDIA GeForce RTX 3060',
    short: 'RTX 3060',
    label: 'ACCELERATION',
    sub: 'Discrete GPU',
    accent: 'cyan',
    facts: [
      '12 GB GDDR6',
      'NVENC hardware encoding',
      'PCIe 4.0 ×16',
    ],
    desc: [
      'Chosen for its 12 GB of memory rather than its raw speed. That capacity is what lets it hold a sizeable model resident for local inference while still having room to run video encode work.',
      'It handles the heavy, long-running encode jobs through NVENC, and general compute alongside them. It works as the second half of a deliberate split: the discrete card takes the batch workloads, while the processor’s built-in video engine takes live playback.',
    ],
  },

  {
    id: 'igpu',
    name: 'Intel Quick Sync',
    short: 'Quick Sync',
    label: 'ACCELERATION',
    sub: 'UHD Graphics 750 — integrated',
    accent: 'cyan',
    facts: [
      'Intel UHD Graphics 750',
      'Fixed-function video engine',
      'Integrated on the i9-11900K',
    ],
    desc: [
      'The processor’s built-in video engine, and the other half of the transcoding split. Quick Sync is a fixed-function block: it does one job, does it in hardware, and costs very little power doing it.',
      'Dedicating it to live playback means a viewer starting a stream never has to contend with whatever batch encode work the discrete GPU is grinding through. Two independent hardware paths, two independent workloads, no queue between them.',
    ],
  },

  {
    id: 'nvme',
    name: '2 × 1 TB NVMe',
    short: 'NVMe',
    label: 'SYSTEM DISKS',
    sub: 'System drive + scratch drive',
    accent: 'cyan',
    facts: [
      'Samsung 990 PRO 1 TB — OS + containers',
      'TEAM TM8FGP001T 1 TB — download & transcode scratch',
      'PCIe 4.0 ×4 system slot',
    ],
    desc: [
      'Both deliberately separate from the media pool. The operating system, container images and the small, latency-sensitive databases that back the services live on the 990 PRO, where random reads are effectively free.',
      'The second drive exists to take the abuse. Downloads land on it, and the video re-encode pipeline stages roughly a terabyte a day of temporary files through it — write churn that would wear out a system drive in under two years. Isolating it keeps the system disk healthy and stops a busy transfer from ever making an interface feel sluggish, because the two workloads never share a device.',
    ],
  },

  {
    id: 'hba',
    name: 'ASMedia ASM1166',
    short: 'ASM1166 HBA',
    label: 'STORAGE CONTROLLER',
    sub: 'Current SATA controller',
    accent: 'amber',
    swap: true,
    facts: [
      '6 SATA ports',
      'PCIe 3.0 ×2',
    ],
    desc: [
      'The motherboard alone does not have enough SATA ports for seven pooled drives plus the system disk, so a host bus adapter makes up the difference.',
      'This one works, but it is the constrained link in the storage path: a PCIe ×2 connection is a narrow pipe to share across six drives when several are read at once. That constraint is what the incoming upgrade addresses.',
    ],
  },

  {
    id: 'hba_new',
    name: 'LSI 9207-8i',
    short: 'LSI 9207-8i',
    label: 'STORAGE CONTROLLER',
    sub: 'Incoming upgrade',
    accent: 'amber',
    status: 'INCOMING — NOT YET INSTALLED',
    swap: true,
    facts: [
      '8 internal SATA / SAS ports',
      'PCIe 3.0 ×8',
      'LSI SAS2308 controller',
      'IT mode (direct drive access)',
    ],
    desc: [
      'A proper enterprise host bus adapter, and a four-fold widening of the link: PCIe ×8 instead of ×2, feeding eight ports instead of six.',
      'IT mode is the important detail. The card passes each drive through to the operating system directly, with no RAID abstraction in between — which is exactly what a mergerfs pool needs, since every disk must keep its own visible, independent filesystem.',
    ],
  },

  {
    id: 'nic',
    name: 'Intel I225-V',
    short: 'Networking',
    label: 'NETWORKING',
    sub: '2.5 Gigabit Ethernet',
    accent: 'cyan',
    facts: [
      '2.5 GbE',
      'Intel I225-V controller',
    ],
    desc: [
      'Two and a half times the throughput of standard gigabit, which is the difference between a large media file transfer taking minutes and taking a noticeable fraction of an hour.',
      'On the local network this is comfortably faster than the mechanical pool can sustain on a single stream, so the network stops being the limiting factor and the disks become the honest bottleneck.',
    ],
  },

  {
    id: 'psu',
    name: 'EVGA SuperNOVA 1000 G6',
    short: 'Power supply',
    label: 'POWER',
    sub: '1000 W, 80+ Gold',
    accent: 'cyan',
    facts: [
      '1000 W capacity',
      '80+ Gold efficiency',
      'Fully modular',
    ],
    desc: [
      'Sized with deliberate headroom. Seven mechanical drives all spinning up at once draw a substantial surge at power-on — far more than their steady-state draw — and the supply has to absorb that peak without sagging.',
      'Running a large supply well below its rated load also keeps it in its most efficient band and keeps its fan slow, which matters for a machine that never powers down.',
    ],
  },
];

/* The platform the above sits on. Shown on the chassis card as context. */
export const PLATFORM = {
  board: 'MSI MPG Z590 GAMING FORCE',
  os: 'Ubuntu 24.04',
  stack: 'Saltbox',
  roles: 'Media services · family photo platform',
};

export const byId = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));
