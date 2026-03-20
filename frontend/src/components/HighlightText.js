import React from 'react';

export default function HighlightText({ text, matches }) {
  if (!text) return null;

  let highlightedText = text;

  const getColor = (similarity) => {
    if (similarity > 80) return 'rgba(255,0,0,0.4)';
    if (similarity > 50) return 'rgba(255,165,0,0.4)';
    return 'rgba(0,255,0,0.3)';
  };

  matches.forEach((match) => {
    const color = getColor(match.similarity);

    const regex = new RegExp(match.text1, 'gi');

    highlightedText = highlightedText.replace(
      regex,
      `<span style="background:${color}">${match.text1}</span>`
    );
  });

  return (
    <div dangerouslySetInnerHTML={{ __html: highlightedText }} />
  );
}
