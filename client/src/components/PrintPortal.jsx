import { createPortal } from 'react-dom';

const printRoot = typeof document !== 'undefined' ? document.getElementById('print-root') : null;

// Renders children into #print-root, outside the main #root tree.
// #print-root is display:none on screen and swapped to visible
// (while #root is hidden) only inside the @media print rules in
// index.css - see there for why this avoids blank/duplicate pages.
export default function PrintPortal({ children }) {
  if (!printRoot) return null;
  return createPortal(children, printRoot);
}
