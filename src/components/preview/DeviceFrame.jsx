import './DeviceFrame.css';

export function readPreviewFrame() {
  return new URLSearchParams(window.location.search).get('frame');
}

export default function DeviceFrame({ children, enabled }) {
  if (!enabled) return children;

  return (
    <div className="device-preview-stage">
      <div className="device-preview-shell" aria-label="معاينة آيفون">
        <div className="device-preview-notch" aria-hidden="true" />
        <div className="device-preview-screen">
          <div className="device-preview-app">{children}</div>
        </div>
        <div className="device-preview-home" aria-hidden="true" />
      </div>
    </div>
  );
}
