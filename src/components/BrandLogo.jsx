import React from "react";

const BrandLogo = ({ className = "" }) => (
  <span className={`brand-logo ${className}`} aria-hidden="true">
    <svg viewBox="0 0 96 44" role="img" focusable="false">
      <path
        className="brand-logo-f-spine"
        d="M13 6h13L11 39H0L13 6Z"
      />
      <path
        className="brand-logo-f-top"
        d="M18 6h43l-8 9H14l4-9Z"
      />
      <path
        className="brand-logo-f-mid"
        d="M12 21h34l-8 9H8l4-9Z"
      />
      <path
        className="brand-logo-one"
        d="M65 6h28L78 39H64l11-24H59l6-9Z"
      />
      <path
        className="brand-logo-one-highlight"
        d="M73 12h11L74 34h-5l9-19h-8l3-3Z"
      />
      <path
        className="brand-logo-slip"
        d="M46 20h19M41 27h20M36 34h21"
      />
    </svg>
  </span>
);

export default BrandLogo;
