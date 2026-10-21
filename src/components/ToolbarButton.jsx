export default function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}) {
  return (
    <button
      type="button"
      className={`btn btn-sm toolbar-btn ${
        active ? 'btn-primary' : 'btn-outline-secondary'
      }`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the text selection in the editor when the button is clicked.
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
