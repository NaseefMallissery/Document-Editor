import { useRef, useState } from 'react';

export default function SignaturePad({ onInsert, onClose }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDrawing(event) {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = getPoint(event);

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);

    context.strokeStyle = '#172554';
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(point.x, point.y);
    // Draw a dot so a single tap leaves a mark.
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
    setIsEmpty(false);
  }

  function draw(event) {
    if (!drawingRef.current) return;

    const context = canvasRef.current.getContext('2d');
    const point = getPoint(event);

    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;

    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }

  function insertSignature() {
    if (isEmpty) return;

    onInsert(canvasRef.current.toDataURL('image/png'));
  }

  return (
    <div className="signature-panel">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>Draw signature</strong>

        <button
          type="button"
          className="btn btn-sm btn-light"
          onClick={clearCanvas}
        >
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={560}
        height={150}
        className="signature-canvas"
        aria-label="Draw your signature"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      />

      <div className="d-flex gap-2 mt-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={isEmpty}
          onClick={insertSignature}
        >
          Insert signature
        </button>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
