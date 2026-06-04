// worklog-format.js — render the canonical Markdown summary into per-target formats.
// STRUCTURE only (not content): email -> HTML, calendar/toast -> clean plain text.
// Pure, no deps. The summary Markdown uses: #/##/### headings, "- " bullets, **bold**, `code`, "> " quote.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline markup -> HTML (bold, code). Escapes first, so it is safe on raw text.
function inlineHtml(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+?)`/g, '<code>$1</code>');
}

// Markdown -> HTML for email (-BodyAsHtml). #..### -> h2..h4, "- " -> <ul><li>, "> " -> blockquote,
// blank line -> list/paragraph break. Wrapped RTL so the Hebrew summary renders correctly.
function toHtml(md) {
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const rawLine of String(md == null ? '' : md).split('\n')) {
    const ln = rawLine.replace(/\s+$/, '');
    let m;
    if ((m = /^(#{1,6})\s+(.+)$/.exec(ln))) {
      closeList();
      const level = Math.min(m[1].length + 1, 6); // "#" -> h2, "##" -> h3, ...
      out.push('<h' + level + '>' + inlineHtml(m[2]) + '</h' + level + '>');
    } else if ((m = /^\s*[-*]\s+(.+)$/.exec(ln))) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + inlineHtml(m[1]) + '</li>');
    } else if (ln.trim() === '') {
      closeList();
    } else if ((m = /^>\s?(.*)$/.exec(ln))) {
      closeList();
      out.push('<blockquote>' + inlineHtml(m[1]) + '</blockquote>');
    } else {
      closeList();
      out.push('<p>' + inlineHtml(ln) + '</p>');
    }
  }
  closeList();
  return '<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">' + out.join('') + '</div>';
}

// Markdown -> the HTML subset Google Calendar actually renders in event descriptions:
// <b>, <i>, <ul>/<li>, <br> only (NO <h*>, <div>, or inline style — Calendar strips those).
// Headings become bold lines; bullets become a real list. Pretty, without raw Markdown markers.
function toCalHtml(md) {
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const rawLine of String(md == null ? '' : md).split('\n')) {
    const ln = rawLine.replace(/\s+$/, '');
    let m;
    if ((m = /^(#{1,6})\s+(.+)$/.exec(ln))) { closeList(); out.push('<b>' + inlineHtml(m[2]) + '</b><br>'); }
    else if ((m = /^\s*[-*]\s+(.+)$/.exec(ln))) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inlineHtml(m[1]) + '</li>'); }
    else if (ln.trim() === '') { closeList(); }
    else if ((m = /^>\s?(.*)$/.exec(ln))) { closeList(); out.push('<i>' + inlineHtml(m[1]) + '</i><br>'); }
    else { closeList(); out.push(inlineHtml(ln) + '<br>'); }
  }
  closeList();
  return out.join('');
}

// Markdown -> clean plain text (fallback / toast). Strips the markers,
// keeps the structure (bullets become "• "). Google Calendar shows this verbatim, so no raw "##"/"**".
function toPlain(md) {
  return String(md == null ? '' : md).split('\n').map((rawLine) => {
    let ln = rawLine.replace(/\s+$/, '');
    ln = ln.replace(/^(#{1,6})\s+/, '');       // heading -> plain line
    ln = ln.replace(/^(\s*)[-*]\s+/, '$1• ');   // bullet -> •
    ln = ln.replace(/^>\s?/, '');               // blockquote marker
    ln = ln.replace(/\*\*(.+?)\*\*/g, '$1');    // bold -> text
    ln = ln.replace(/`([^`]+?)`/g, '$1');       // code -> text
    return ln;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { toHtml, toCalHtml, toPlain, esc };
