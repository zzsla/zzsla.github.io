"use strict";

const sidebar = document.querySelector("#file-sidebar");
const sidebarToggle = document.querySelector(".sidebar-toggle");
const fileList = sidebar.querySelector("ul");
const emptyFiles = sidebar.querySelector(".empty-files");

let folders = new WeakMap();

function getFolderList(parent, name, path) {
  if (!folders.has(parent)) folders.set(parent, new Map());
  const children = folders.get(parent);
  if (!children.has(name)) {
    const item = document.createElement("li");
    const folder = document.createElement("details");
    const summary = document.createElement("summary");
    const entries = document.createElement("ul");
    const icon = document.createElement("span");
    icon.className = "folder-mark";
    icon.setAttribute("aria-hidden", "true");
    summary.append(icon, name);
    summary.dataset.folder = JSON.stringify(path);
    folder.append(summary, entries);
    item.append(folder);
    parent.append(item);
    children.set(name, entries);
  }
  return children.get(name);
}

function renderSidebar(posts) {
  fileList.replaceChildren();
  folders = new WeakMap();
  for (const post of posts) {
    const parent = post.folders.reduce((list, part, index) => getFolderList(list, part, post.folders.slice(0, index + 1)), fileList);
    const item = document.createElement("li");
    const link = document.createElement("a");
    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.setAttribute("aria-hidden", "true");
    link.href = post.url;
    link.append(icon, post.title);
    item.append(link);
    parent.append(item);
  }

  fileList.hidden = posts.length === 0;
  emptyFiles.hidden = !fileList.hidden;
}

const sidebarStateKey = "zzsla.sidebar-open";

function setSidebarOpen(open) {
  sidebar.hidden = !open;
  document.querySelector(".graph-toggle").hidden = !open;
  sidebarToggle.setAttribute("aria-expanded", String(open));
  sidebarToggle.setAttribute("aria-label", open ? "파일 탐색기 닫기" : "파일 탐색기 열기");
  document.body.classList.toggle("sidebar-open", open);
  try {
    sessionStorage.setItem(sidebarStateKey, String(open));
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

sidebarToggle.addEventListener("click", () => setSidebarOpen(sidebar.hidden));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !sidebar.hidden && !event.defaultPrevented) {
    setSidebarOpen(false);
    sidebarToggle.focus();
  }
});

renderSidebar(searchIndex);
try {
  setSidebarOpen(sessionStorage.getItem(sidebarStateKey) === "true");
} catch {
  setSidebarOpen(false);
}
