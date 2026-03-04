function convertTagsToHTML(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  let html = text
    .replace(
      /<original-book>(.*?)<\/original-book>/g,
      '<span class="book-tag original-book">$1</span>',
    )
    .replace(
      /<book-in-series>(.*?)<\/book-in-series>/g,
      '<span class="book-tag book-in-series">$1</span>',
    )
    .replace(
      /<unrelated-book>(.*?)<\/unrelated-book>/g,
      '<span class="book-tag unrelated-book">$1</span>',
    );

  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  if (!html.startsWith("<p>")) {
    html = "<p>" + html + "</p>";
  }

  return html;
}

module.exports = {
  convertTagsToHTML,
};
