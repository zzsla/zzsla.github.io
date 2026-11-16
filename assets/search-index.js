---
layout: null
---
const searchIndex = [
  {%- assign posts = site.pages | where_exp: "item", "item.post_folders != nil" %}
  {%- for post in posts %}
  {
    title: {{ post.title | jsonify }},
    url: {{ post.url | relative_url | jsonify }},
    folders: {{ post.post_folders | jsonify }},
    markup: {{ post.content | jsonify }},
    text: {{ post.content | strip_html | normalize_whitespace | jsonify }}
  }{% unless forloop.last %},{% endunless %}
  {%- endfor %}
];
