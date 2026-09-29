import React from 'react';
import styles from './chat.module.css';

function renderInline(source: string, keyPrefix: string): React.ReactNode[] {
  const tokenPattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const parts = source.split(tokenPattern).filter(Boolean);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <del key={key}>{part.slice(2, -2)}</del>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) return <a key={key} href={linkMatch[2]} target="_blank" rel="noreferrer">{linkMatch[1]}</a>;
    return part;
  });
}

function isTableDivider(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function highlightCode(source: string, language: string, keyPrefix: string) {
  const normalizedLanguage = language.toLowerCase();
  const keywordsByLanguage: Record<string, string> = {
    javascript: 'async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
    js: 'async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
    typescript: 'abstract any as async await boolean break case catch class const continue declare default delete do else enum export extends false finally for from function if implements import in interface instanceof let namespace never new null number object of private protected public readonly return static string super switch this throw true try type typeof undefined var void while',
    ts: 'abstract any as async await boolean break case catch class const continue declare default delete do else enum export extends false finally for from function if implements import in interface instanceof let namespace never new null number object of private protected public readonly return static string super switch this throw true try type typeof undefined var void while',
    python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
    py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
    sql: 'all alter and as asc begin between by case cast check column commit constraint create cross current_date database delete desc distinct drop else end exists fetch foreign from full group having in index inner insert into is join key left like limit not null offset on or order outer primary references right rollback select set table then union unique update values view when where with',
    bash: 'case do done elif else esac fi for function if in local return then until while',
    sh: 'case do done elif else esac fi for function if in local return then until while',
    css: 'important media supports keyframes from to',
    json: 'true false null',
  };
  const keywordSet = new Set((keywordsByLanguage[normalizedLanguage] || '').split(' ').filter(Boolean));
  if (!keywordSet.size) return source;

  const tokens = source.split(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b)/g).filter(Boolean);
  return tokens.map((token, index) => {
    const className = /^(\/\/|#|--|\/\*)/.test(token) ? styles.codeComment
      : /^("|'|`)/.test(token) ? styles.codeString
        : /^\d/.test(token) ? styles.codeNumber
          : keywordSet.has(token) ? styles.codeKeyword
            : undefined;
    return className ? <span key={`${keyPrefix}-${index}`} className={className}>{token}</span> : token;
  });
}

export default function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^```([\w+-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) codeLines.push(lines[index++]);
      if (index < lines.length) index += 1;
      const code = codeLines.join('\n');
      blocks.push(<pre key={`block-${blocks.length}`} className={styles.codeBlock}><code data-language={fence[1] || undefined}>{highlightCode(code, fence[1], `code-${blocks.length}`)}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(React.createElement(`h${level}`, { key: `block-${blocks.length}`, className: styles.markdownHeading }, renderInline(heading[2], `heading-${blocks.length}`)));
      index += 1;
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(splitTableRow(lines[index++]));
      blocks.push(
        <div key={`block-${blocks.length}`} className={styles.tableScroll}>
          <table className={styles.markdownTable}>
            <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell, `th-${blocks.length}-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] || '', `td-${blocks.length}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-*+]\s+|\d+\.\s+)/);
    if (listMatch) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: React.ReactNode[] = [];
      while (index < lines.length && /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[index])) {
        const item = lines[index++].replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, '');
        items.push(<li key={`item-${items.length}`}>{renderInline(item, `list-${blocks.length}-${items.length}`)}</li>);
      }
      blocks.push(React.createElement(ordered ? 'ol' : 'ul', { key: `block-${blocks.length}`, className: styles.markdownList }, items));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={`block-${blocks.length}`} className={styles.markdownQuote}>{renderInline(quote.join(' '), `quote-${blocks.length}`)}</blockquote>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^```|^#{1,6}\s|^\s*(?:[-*+]\s+|\d+\.\s+)|^>\s?/.test(lines[index])) {
      if (index + 1 < lines.length && lines[index].includes('|') && isTableDivider(lines[index + 1])) break;
      paragraph.push(lines[index++]);
    }
    if (paragraph.length) blocks.push(<p key={`block-${blocks.length}`} className={styles.markdownParagraph}>{renderInline(paragraph.join(' '), `paragraph-${blocks.length}`)}</p>);
    else index += 1;
  }

  return <div className={styles.markdownContent}>{blocks}</div>;
}
