import katex from 'katex';
import { useMemo } from 'react';

export function M({ t, d = false, className = '' }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(t, { throwOnError: false, displayMode: d });
    } catch {
      return t;
    }
  }, [t, d]);

  if (d) return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
