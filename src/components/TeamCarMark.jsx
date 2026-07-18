import React from 'react';
import { getTeamCarConfig } from '../data/seasonGrid.js';

const LiveryPattern = ({ config }) => {
  switch (config.pattern) {
    case 'spine':
      return (
        <>
          <path d="M39 31 L143 31 L188 35 L143 39 L39 39 Z" fill={config.secondary} />
          <path d="M65 24 L136 28 L154 35 L136 42 L65 46 L85 35 Z" fill={config.accent} />
        </>
      );
    case 'swoop':
      return (
        <>
          <path d="M61 22 C91 24 125 27 157 35 C126 35 95 40 63 47 L77 35 Z" fill={config.secondary} />
          <path d="M105 24 C131 27 146 30 165 35 C142 34 127 36 108 42 Z" fill={config.accent} />
        </>
      );
    case 'split':
      return (
        <>
          <path d="M39 31 L93 29 L119 35 L94 42 L39 39 Z" fill={config.secondary} />
          <path d="M113 28 L151 31 L178 35 L151 39 L116 42 L132 35 Z" fill={config.accent} />
        </>
      );
    case 'bolt':
      return (
        <>
          <path d="M59 23 L111 27 L96 33 L145 30 L119 39 L158 38 L124 44 L69 47 L90 37 L53 38 L84 31 Z" fill={config.accent} />
          <path d="M102 25 L135 29 L159 35 L131 35 L112 41 L119 33 Z" fill={config.trim} />
        </>
      );
    case 'slash':
      return (
        <>
          <path d="M78 22 L102 26 L78 46 L60 47 Z" fill={config.accent} />
          <path d="M108 27 L145 30 L169 35 L145 40 L113 43 L129 35 Z" fill={config.secondary} />
        </>
      );
    default:
      return null;
  }
};

const TeamCarMark = ({
  team,
  year = 2026,
  compact = false,
  className = '',
}) => {
  const config = getTeamCarConfig(team, year);
  if (!config) return null;

  return (
    <svg
      aria-label={`${config.name} Formula car`}
      className={`team-car-mark ${compact ? 'compact' : ''} ${className}`.trim()}
      role="img"
      viewBox="0 0 224 70"
    >
      <title>{config.name} Formula car</title>

      <ellipse cx="112" cy="61" rx="101" ry="3" fill="#050608" opacity="0.34" />

      <g className="car-suspension" fill="none" stroke="#343940" strokeWidth="2">
        <path d="M51 22 L76 31 M51 48 L76 39 M166 22 L148 31 M166 48 L148 39" />
      </g>

      <g className="car-wheels">
        <rect x="39" y="6" width="28" height="20" rx="5" fill="#08090b" />
        <rect x="39" y="44" width="28" height="20" rx="5" fill="#08090b" />
        <rect x="163" y="8" width="24" height="18" rx="5" fill="#08090b" />
        <rect x="163" y="44" width="24" height="18" rx="5" fill="#08090b" />
        <path d="M42 9 L64 9 M42 61 L64 61 M166 11 L184 11 M166 59 L184 59" stroke="#535860" strokeWidth="2" />
      </g>

      <g className="car-aero">
        <path d="M10 15 L45 15 L49 21 L49 49 L45 55 L10 55 L14 48 L14 22 Z" fill={config.secondary} stroke="#090b0e" strokeWidth="1.4" />
        <path d="M17 19 L41 19 L43 24 L18 24 Z M18 46 L43 46 L41 51 L17 51 Z" fill={config.accent} />
        <path d="M180 18 L215 12 L218 17 L204 35 L218 53 L215 58 L180 52 L188 44 L205 41 L205 29 L188 26 Z" fill={config.primary} stroke="#090b0e" strokeWidth="1.4" />
        <path d="M192 21 L215 16 L207 31 L184 31 Z M184 39 L207 39 L215 54 L192 49 Z" fill={config.accent} />
      </g>

      <g className="car-body">
        <path
          d="M35 28 L69 27 L83 21 L119 22 L141 29 L184 32 L202 35 L184 38 L141 41 L119 48 L83 49 L69 43 L35 42 Z"
          fill={config.primary}
          stroke="#090b0e"
          strokeWidth="1.5"
        />
        <LiveryPattern config={config} />
        <path d="M73 22 L96 15 L129 18 L145 29 L129 35 L88 33 Z" fill={config.primary} stroke="#090b0e" strokeWidth="1.4" />
        <path d="M73 48 L96 55 L129 52 L145 41 L129 35 L88 37 Z" fill={config.primary} stroke="#090b0e" strokeWidth="1.4" />
        <path d="M111 22 Q128 24 139 35 Q128 46 111 48 L92 42 L92 28 Z" fill={config.secondary} />
        <ellipse cx="113" cy="35" rx="15" ry="9" fill="#090b0e" />
        <path d="M107 29 Q114 24 121 29 L128 35 L121 41 Q114 46 107 41 L101 35 Z" fill="#20242a" />
        <path d="M105 28 Q114 20 123 28 M105 28 L105 42 M123 28 L123 42" fill="none" stroke={config.trim} strokeWidth="2.2" />
        <path d="M131 33 L187 33 L199 35 L187 37 L131 37 Z" fill={config.primary} />
        <path d="M149 34 L199 35 L149 36 Z" fill={config.trim} />
        <path d="M31 28 L42 22 L44 27 L39 31 Z M31 42 L42 48 L44 43 L39 39 Z" fill={config.accent} />
      </g>
    </svg>
  );
};

export default TeamCarMark;
