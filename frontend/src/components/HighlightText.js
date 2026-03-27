import React from 'react';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function HighlightText({ text, matches, totalSimilarity = 0 }) {
  if (!text) return null;

  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const getColor = (similarity) => {
    if (similarity > 80) return 'rgba(235, 87, 87, 0.28)';
    if (similarity > 50) return 'rgba(242, 153, 74, 0.26)';
    return 'rgba(111, 207, 151, 0.24)';
  };

  const safeMatches = [];
  (matches || []).forEach((match) => {
    if (!match?.text1 || typeof match.text1 !== 'string') return;
    safeMatches.push(match);
  });

  const renderParagraph = (paragraph) => {
    let html = escapeHtml(paragraph);
    let hasMatch = false;

    safeMatches.forEach((match) => {
      const escapedNeedle = escapeRegex(escapeHtml(match.text1));
      const regex = new RegExp(escapedNeedle, 'gi');
      const color = getColor(match.similarity);

      if (regex.test(html)) {
        hasMatch = true;
        html = html.replace(
          regex,
          `<mark style="background:${color}" class="inline-match">$&</mark>`
        );
      }
    });

    const paragraphLevelColor = hasMatch ? '' : getColor(totalSimilarity * 0.55);

    return (
      <p
        key={`${paragraph.slice(0, 30)}-${paragraph.length}`}
        className={`doc-paragraph ${hasMatch ? 'doc-paragraph--matched' : ''}`}
        style={paragraphLevelColor ? { background: paragraphLevelColor } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return <div className="highlighted">{paragraphs.map(renderParagraph)}</div>;
}
