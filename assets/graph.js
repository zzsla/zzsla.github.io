"use strict";

const graphToggle = document.querySelector(".graph-toggle");
const graphView = document.querySelector("#graph-view");
const graphBrand = document.querySelector(".site-brand button");
const plot = graphView.querySelector(".graph-plot");
const nodesLayer = graphView.querySelector(".graph-nodes");
const canvas = graphView.querySelector("canvas");
const menu = graphView.querySelector(".graph-menu");
const posts = searchIndex;
const graphUrl = value => decodeURIComponent(new URL(value, location.href).pathname).replace(/\/$/, "");
const postIds = new Map(posts.map((post, index) => [graphUrl(post.url), index]));
const postNames = new Map(posts.flatMap((post, index) => [
  [post.title.toLowerCase(), index],
  [post.folders.at(-1)?.toLowerCase(), index],
]));
const related = posts.map(() => new Set());
const backlinks = posts.map(() => new Set());
const edges = [];
const parser = new DOMParser();

searchIndex.forEach((post, from) => {
  const article = parser.parseFromString(post.markup, "text/html");
  const targets = new Set();
  for (const link of article.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) continue;
    try {
      const url = new URL(href, new URL(post.url, location.href));
      if (url.origin === location.origin) targets.add(postIds.get(graphUrl(url)));
    } catch {
      continue;
    }
  }
  for (const match of article.body.textContent.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/gu)) {
    targets.add(postNames.get(match[1].trim().toLowerCase()));
  }
  for (const to of targets) {
    if (to === undefined || from === to) continue;
    edges.push([from, to]);
    related[from].add(to);
    related[to].add(from);
    backlinks[to].add(from);
  }
});

let x = 0;
let y = 0;
let zoom = 1;
let positions = new Map();
let visible = [];
let highlighted;
let local;
let openFolderFilter = false;
let menuPost;
let drag;

function layoutGraph() {
  const localSet = local === undefined ? null : new Set([local, ...related[local]]);
  const openFolders = openFolderFilter ? visibleFolderPaths() : null;
  visible = posts.map((_, id) => id).filter(id =>
    (!localSet || localSet.has(id)) &&
    (!openFolders?.size || openFolders.has(JSON.stringify(posts[id].folders)))
  );
  const count = visible.length;
  const visibleSet = new Set(visible);
  const links = edges.filter(([from, to]) => visibleSet.has(from) && visibleSet.has(to));
  positions = new Map(visible.map((id, index) => {
    const angle = index * 2.39996;
    const radius = Math.sqrt(index) * 65;
    return [id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }];
  }));
  const repel = 6300;
  const gravity = .01925;
  const spring = .066;
  const distance = 140;
  for (let step = 0; step < 50 && count <= 300; step++) {
    const temperature = 1 - step / 55;
    for (let i = 0; i < count; i++) {
      const a = positions.get(visible[i]);
      a.x *= 1 - gravity;
      a.y *= 1 - gravity;
      for (let j = i + 1; j < count; j++) {
        const b = positions.get(visible[j]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.max(10, Math.hypot(dx, dy));
        const force = Math.min(8, repel / (length * length)) * temperature;
        a.x -= dx / length * force;
        a.y -= dy / length * force;
        b.x += dx / length * force;
        b.y += dy / length * force;
      }
    }
    for (const [from, to] of links) {
      const a = positions.get(from);
      const b = positions.get(to);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const force = (length - distance) * spring * temperature;
      a.x += dx / length * force;
      a.y += dy / length * force;
      b.x -= dx / length * force;
      b.y -= dy / length * force;
    }
  }
}

function nodeSize(id) {
  const steps = Math.floor(backlinks[id].size / 7);
  return 9 + 2 * steps;
}

function setHighlight(id) {
  highlighted = id;
  for (const node of nodesLayer.children) {
    const other = Number(node.dataset.id);
    node.classList.toggle("muted-node", id !== undefined && other !== id && !related[id].has(other));
  }
  draw();
}

function openMenu(event, id) {
  event.preventDefault();
  menuPost = id;
  const link = menu.querySelector("a");
  link.href = posts[id].url;
  menu.hidden = false;
  menu.style.left = Math.min(event.clientX, innerWidth - menu.offsetWidth) + "px";
  menu.style.top = Math.min(event.clientY, innerHeight - menu.offsetHeight) + "px";
  link.focus();
}

function renderNodes() {
  layoutGraph();
  graphView.querySelector(".graph-empty").hidden = visible.length !== 0;
  if (highlighted !== undefined && !visible.includes(highlighted)) highlighted = undefined;
  const nodes = visible.map(id => {
    const post = posts[id];
    const node = document.createElement("a");
    node.className = "graph-node";
    node.dataset.id = id;
    node.href = post.url;
    const label = document.createElement("span");
    label.textContent = post.title;
    node.append(label);
    node.title = post.title + " · 이 글을 참조하는 글 " + backlinks[id].size + "개";
    node.addEventListener("mouseenter", () => setHighlight(id));
    node.addEventListener("mouseleave", () => setHighlight());
    node.addEventListener("focus", () => setHighlight(id));
    node.addEventListener("blur", () => setHighlight());
    node.addEventListener("contextmenu", event => openMenu(event, id));
    return node;
  });
  nodesLayer.replaceChildren(...nodes);
  setHighlight(highlighted);
}

function draw() {
  if (graphView.hidden) return;
  const width = plot.clientWidth;
  const height = plot.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  const point = id => ({
    x: width / 2 + x + positions.get(id).x * zoom,
    y: height / 2 + y + positions.get(id).y * zoom,
  });
  for (const node of nodesLayer.children) {
    const id = Number(node.dataset.id);
    const position = point(id);
    node.style.left = position.x + "px";
    node.style.top = position.y + "px";
    node.style.setProperty("--dot-size", Math.max(.65, nodeSize(id) * zoom) + "px");
    node.classList.toggle("hide-label", zoom * 100 < 60);
  }
  ctx.strokeStyle = getComputedStyle(graphView).getPropertyValue("--accent").trim();
  ctx.lineWidth = Math.max(.35, Math.min(1, zoom));
  for (const [from, to] of edges) {
    if (!positions.has(from) || !positions.has(to)) continue;
    const a = point(from);
    const b = point(to);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const tip = Math.max(.65, nodeSize(to) * zoom) / 2;
    const endX = b.x - Math.cos(angle) * tip;
    const endY = b.y - Math.sin(angle) * tip;
    ctx.globalAlpha = highlighted === undefined ? .45 : highlighted === from || highlighted === to ? 1 : .1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

function resetCamera() {
  let extentX = 0;
  let extentY = 0;
  for (const position of positions.values()) {
    extentX = Math.max(extentX, Math.abs(position.x));
    extentY = Math.max(extentY, Math.abs(position.y));
  }
  zoom = Math.max(.005, Math.min(1, plot.clientWidth / (2 * extentX + 150), plot.clientHeight / (2 * extentY + 110)));
  x = y = 0;
  draw();
}

function zoomAt(factor, px = 0, py = 0) {
  const next = Math.min(4, Math.max(.005, zoom * factor));
  x = px - (px - x) * next / zoom;
  y = py - (py - y) * next / zoom;
  zoom = next;
  draw();
}

function showGraph(open) {
  home.hidden = open;
  graphView.hidden = !open;
  graphToggle.setAttribute("aria-pressed", String(open));
  graphBrand.disabled = !open;
  if (open) graphBrand.setAttribute("aria-label", "zzsla · 전체 그래프 초기화");
  else graphBrand.removeAttribute("aria-label");
  if (open) {
    if (matchMedia("(max-width: 47.99rem)").matches) setSidebarOpen(false);
    renderNodes();
    resetCamera();
    plot.focus();
  } else {
    menu.hidden = true;
    (graphToggle.hidden ? sidebarToggle : graphToggle).focus();
  }
}

plot.addEventListener("wheel", event => {
  event.preventDefault();
  const rect = plot.getBoundingClientRect();
  zoomAt(Math.exp(-event.deltaY * .0015), event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
}, { passive: false });
plot.addEventListener("pointerdown", event => {
  if (event.button !== 0 || event.target.closest(".graph-node")) return;
  plot.setPointerCapture(event.pointerId);
  drag = { x: event.clientX, y: event.clientY };
  plot.classList.add("dragging");
});
plot.addEventListener("pointermove", event => {
  if (!drag) return;
  x += event.clientX - drag.x;
  y += event.clientY - drag.y;
  drag = { x: event.clientX, y: event.clientY };
  draw();
});
plot.addEventListener("lostpointercapture", () => {
  drag = undefined;
  plot.classList.remove("dragging");
});
plot.addEventListener("keydown", event => {
  const step = event.shiftKey ? 70 : 25;
  const directions = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (event.key === "+" || event.key === "=" || event.key === "-") {
    event.preventDefault();
    zoomAt(event.key === "-" ? 1 / 1.2 : 1.2);
  } else if (Object.hasOwn(directions, event.key)) {
    event.preventDefault();
    const [dx, dy] = directions[event.key];
    x += dx;
    y += dy;
    draw();
  }
});

menu.querySelector("button").addEventListener("click", () => {
  local = menuPost;
  menu.hidden = true;
  renderNodes();
  resetCamera();
  plot.focus();
});
document.addEventListener("pointerdown", event => {
  if (!menu.contains(event.target)) menu.hidden = true;
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !menu.hidden) {
    menu.hidden = true;
    nodesLayer.querySelector(`[data-id="${menuPost}"]`)?.focus();
    event.preventDefault();
  }
});
function visibleFolderPaths() {
  const paths = new Set();
  for (const folder of sidebar.querySelectorAll("details[open] > summary[data-folder]")) {
    if (!folder.parentElement.parentElement.closest("details:not([open])")) {
      paths.add(folder.dataset.folder);
    }
  }
  return paths;
}

graphBrand.addEventListener("click", () => {
  openFolderFilter = false;
  local = undefined;
  for (const folder of sidebar.querySelectorAll("details[open]")) folder.open = false;
  renderNodes();
  resetCamera();
});
sidebar.addEventListener("click", event => {
  const folder = event.target.closest("summary[data-folder]");
  if (!folder || graphView.hidden) return;
  event.preventDefault();
  const details = folder.parentElement;
  details.open = !details.open;
  openFolderFilter = true;
  local = undefined;
  renderNodes();
  resetCamera();
});
new ResizeObserver(draw).observe(plot);
graphToggle.addEventListener("click", () => showGraph(graphView.hidden));
