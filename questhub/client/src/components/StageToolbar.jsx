import { useStore } from '../state/store.js';

const TOOLS = [
  { t: 'select',      icon: '🖱️', label: 'Select / move tokens' },
  { t: 'add-token',   icon: '⭕', label: 'Add token' },
  { t: 'draw-wall',   icon: '🧱', label: 'Draw wall' },
  { t: 'draw-door',   icon: '🚪', label: 'Draw door' },
  { t: 'toggle-door', icon: '🔓', label: 'Open / close door' },
  { t: 'erase-wall',  icon: '🧹', label: 'Erase wall' },
  { t: 'align-grid',  icon: '📐', label: 'Align grid to map (click 2 corners of one square)' },
];

// Always-visible cursor-mode switcher on the left edge of the stage.
export default function StageToolbar() {
  const tool = useStore(s => s.tool);
  const setTool = useStore(s => s.setTool);
  return (
    <div className="stage-toolbar">
      {TOOLS.map(({ t, icon, label }) => (
        <button key={t}
          className={`stage-tool ${tool === t ? 'active' : ''}`}
          title={label}
          onClick={() => setTool(tool === t ? 'select' : t)}>
          {icon}
        </button>
      ))}
    </div>
  );
}
