import "./globus-loader.css";

type GlobusLoaderProps = {
  fullScreen?: boolean;
  label?: string;
};

export function GlobusLoader({
  fullScreen = false,
  label = "Loading Globus",
}: GlobusLoaderProps) {
  return (
    <div
      className={`globus-loader ${fullScreen ? "globus-loader--fullscreen" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="globus-loader__stage" aria-hidden="true">
        <span className="globus-loader__orbit globus-loader__orbit--gold">
          <i />
        </span>
        <span className="globus-loader__orbit globus-loader__orbit--blue">
          <i />
        </span>
        <img
          className="globus-loader__mark"
          src={`${import.meta.env.BASE_URL}globus-mark.png`}
          alt=""
        />
      </div>
      <p className="globus-loader__label">{label}</p>
    </div>
  );
}
