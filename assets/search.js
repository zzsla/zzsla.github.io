"use strict";

const home = document.querySelector(".search-home");
const form = home.querySelector("form");
const field = form.elements.q;
const results = home.querySelector(".results");
const count = results.querySelector(".result-count");
const list = results.querySelector("ul");

function normalize(text) {
  return text.normalize("NFKC").toLowerCase();
}

function findPosts(query) {
  const terms = normalize(query.trim()).split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];
  return searchIndex.filter(({ title, text }) => {
    const content = normalize(title + " " + text);
    return terms.every(term => content.includes(term));
  });
}

function excerpt(text, query) {
  const term = normalize(query.trim()).split(/\s+/u)[0];
  const match = normalize(text).indexOf(term);
  const start = Math.max(0, match - 25);
  const end = start + 120;
  return (start ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function postLink(post) {
  return post.url;
}

function render() {
  const query = new URLSearchParams(location.search).get("q")?.trim() ?? "";
  field.value = query;
  home.classList.toggle("has-query", Boolean(query));
  results.hidden = !query;
  list.replaceChildren();
  if (!query) return;
  const matches = findPosts(query);
  count.textContent = matches.length ? `검색 결과 ${matches.length}개` : "검색 결과가 없어요.";
  for (const post of matches) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const snippet = document.createElement("p");
    link.href = postLink(post);
    link.textContent = post.title;
    snippet.textContent = excerpt(post.text, query);
    item.append(link, snippet);
    list.append(item);
  }
}

function search(query) {
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  if (url.href !== location.href) history.pushState(null, "", url);
  render();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  search(field.value.trim());
});
field.addEventListener("input", () => {
  if (!field.value && !results.hidden) search("");
});
window.addEventListener("popstate", render);
render();
