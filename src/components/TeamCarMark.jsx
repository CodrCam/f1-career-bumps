import React from 'react';
import { getTeamCarConfig } from '../data/seasonGrid.js';

const LiveryPattern = ({ config }) => {
  switch (config.pattern) {
    case 'spine':
      return (
        <>
          <path d="M48 40 L172 40 L224 45 L172 50 L48 50 Z" fill={config.secondary} />
          <path d="M74 27 L139 29 L168 39 L138 38 L93 33 Z M74 63 L139 61 L168 51 L138 52 L93 57 Z" fill={config.accent} />
        </>
      );
    case 'swoop':
      return (
        <>
          <path d="M66 25 C104 22 139 27 169 40 C132 37 98 38 69 49 L88 43 Z" fill={config.secondary} />
          <path d="M101 24 C134 26 155 31 182 41 L151 40 L116 35 Z M71 54 C107 59 139 56 171 50 C139 64 102 67 72 63 Z" fill={config.accent} />
        </>
      );
    case 'split':
      return (
        <>
          <path d="M49 36 L112 26 L143 36 L114 46 L49 48 Z" fill={config.secondary} />
          <path d="M126 51 L163 39 L210 43 L178 48 L147 61 Z" fill={config.accent} />
        </>
      );
    case 'bolt':
      return (
        <>
          <path d="M70 24 L125 25 L108 35 L160 31 L133 43 L186 40 L147 52 L88 63 L111 49 L65 54 L98 40 Z" fill={config.accent} />
          <path d="M120 25 L157 31 L184 41 L151 40 L132 48 L139 37 Z" fill={config.trim} />
        </>
      );
    case 'slash':
      return (
        <>
          <path d="M92 21 L123 25 L90 66 L66 64 Z" fill={config.accent} />
          <path d="M132 29 L169 35 L205 43 L171 47 L134 59 L155 43 Z" fill={config.secondary} />
        </>
      );
    case 'alpine':
      return (
        <>
          <path
            d="M55 35 L90 22 L126 20 L151 32 L159 39 L130 42 L88 38 Z M55 55 L90 68 L126 70 L151 58 L159 51 L130 48 L88 52 Z"
            fill={config.accent}
          />
          <path d="M116 28 L147 34 L181 41 L151 43 L129 39 Z M116 62 L147 56 L181 49 L151 47 L129 51 Z" fill={config.secondary} />
          <path d="M67 31 L91 25 M67 59 L91 65" stroke={config.trim} strokeWidth="1.8" />
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
  decorative = false,
  number,
}) => {
  const config = getTeamCarConfig(team, year);
  if (!config) return null;

  return (
    <svg
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${config.name} Formula car`}
      className={`team-car-mark ${compact ? 'compact' : ''} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      viewBox="0 0 276 90"
    >
      {!decorative && <title>{config.name} Formula car</title>}

      <ellipse cx="139" cy="83" rx="130" ry="4" fill="#050608" opacity="0.42" />

      <g className="car-floor">
        <path
          d="M58 28 L107 17 L151 21 L181 32 L225 38 L230 45 L225 52 L181 58 L151 69 L107 73 L58 62 Z"
          fill="#101318"
          stroke="#050608"
          strokeWidth="1.5"
        />
        <path d="M67 31 L110 22 L151 27 L177 36 L211 40 L211 50 L177 54 L151 63 L110 68 L67 59 Z" fill="#252a30" opacity="0.72" />
      </g>

      <g className="car-suspension" fill="none" stroke="#454b52" strokeWidth="2.2">
        <path d="M55 24 L91 37 M55 66 L91 53 M203 28 L179 39 M203 62 L179 51" />
        <path d="M67 24 L98 34 M67 66 L98 56 M213 29 L184 41 M213 61 L184 49" opacity="0.7" />
      </g>

      <g className="car-wheels">
        <rect x="36" y="6" width="40" height="27" rx="6" fill="#07080a" stroke="#33383e" strokeWidth="1.5" />
        <rect x="36" y="57" width="40" height="27" rx="6" fill="#07080a" stroke="#33383e" strokeWidth="1.5" />
        <rect x="198" y="10" width="33" height="24" rx="6" fill="#07080a" stroke="#33383e" strokeWidth="1.5" />
        <rect x="198" y="56" width="33" height="24" rx="6" fill="#07080a" stroke="#33383e" strokeWidth="1.5" />
        <path
          d="M42 10 H70 M42 29 H70 M42 61 H70 M42 80 H70 M203 14 H226 M203 30 H226 M203 60 H226 M203 76 H226"
          stroke="#555c64"
          strokeWidth="2"
        />
        <path d="M55 8 V31 M55 59 V82 M214 12 V32 M214 58 V78" stroke="#171a1e" strokeWidth="2" opacity="0.9" />
      </g>

      <g className="car-aero">
        <path
          d="M7 10 L47 12 L52 20 L49 70 L47 78 L7 80 L12 68 L12 22 Z"
          fill={config.secondary}
          stroke="#07080a"
          strokeWidth="1.7"
        />
        <path d="M14 17 L43 18 L46 24 L15 24 Z M15 66 L46 66 L43 72 L14 73 Z" fill={config.accent} />
        <path d="M27 15 V75" stroke={config.trim} strokeWidth="1.5" opacity="0.82" />

        <path
          d="M214 9 L224 10 L246 27 L265 38 L274 41 L276 45 L274 49 L265 52 L246 63 L224 80 L214 81 L222 61 L247 50 L258 47 L258 43 L247 40 L222 29 Z"
          fill={config.primary}
          stroke="#07080a"
          strokeWidth="1.7"
        />
        <path
          d="M220 15 L245 31 L264 40 L248 38 L226 30 Z M226 60 L248 52 L264 50 L245 59 L220 75 Z"
          fill={config.accent}
        />
        <path d="M236 41 L274 42 L276 45 L274 48 L236 49 Z" fill={config.secondary} />
        <path d="M216 13 L223 14 L225 27 L218 25 Z M218 65 L225 63 L223 76 L216 77 Z" fill={config.trim} opacity="0.8" />
      </g>

      <g className="car-body">
        <path
          d="M45 35 C62 32 72 27 84 21 L121 18 C141 19 153 27 165 35 L205 39 L250 45 L205 51 L165 55 C153 63 141 71 121 72 L84 69 C72 63 62 58 45 55 Z"
          fill={config.primary}
          stroke="#07080a"
          strokeWidth="1.7"
        />
        <path d="M73 28 L104 15 L140 18 L160 34 L143 41 L91 39 Z" fill={config.primary} stroke="#07080a" strokeWidth="1.4" />
        <path d="M73 62 L104 75 L140 72 L160 56 L143 49 L91 51 Z" fill={config.primary} stroke="#07080a" strokeWidth="1.4" />
        <path d="M70 30 L94 23 L87 34 L68 39 Z M68 51 L87 56 L94 67 L70 60 Z" fill={config.secondary} opacity="0.88" />
        <LiveryPattern config={config} />
        <path d="M132 28 Q150 29 164 45 Q150 61 132 62 L108 55 L108 35 Z" fill={config.secondary} />
        <ellipse cx="139" cy="45" rx="17" ry="11" fill="#080a0d" />
        <path d="M132 38 Q140 31 148 38 L156 45 L148 52 Q140 59 132 52 L124 45 Z" fill="#242930" />
        <path d="M129 37 Q140 25 151 37 M129 37 V53 M151 37 V53" fill="none" stroke={config.trim} strokeWidth="2.7" />
        <path d="M153 41 L222 41 L249 45 L222 49 L153 49 Z" fill={config.primary} stroke="#07080a" strokeWidth="1.1" />
        <path d="M177 43 L249 45 L177 47 Z" fill={config.trim} opacity="0.95" />
        <path d="M41 32 L53 25 L55 32 L48 38 Z M41 58 L53 65 L55 58 L48 52 Z" fill={config.accent} />
        <path d="M93 23 L116 21 M93 67 L116 69" stroke={config.trim} strokeWidth="1.5" opacity="0.65" />
        {number !== undefined && number !== null && (
          <text
            fill={config.trim}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="9"
            fontWeight="900"
            textAnchor="middle"
            x="193"
            y="48"
          >
            {number}
          </text>
        )}
      </g>
    </svg>
  );
};

export default TeamCarMark;
