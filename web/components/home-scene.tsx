"use client";
import { useId } from "react";
/** A code-native illustration; colors and furniture move with the selected plan. */
export function HomeScene({
  phase = 0,
  compact = false,
}: {
  phase?: number;
  compact?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <div
      className={"home-scene " + (compact ? "compact" : "")}
      data-phase={phase}
      aria-hidden="true"
    >
      <svg viewBox="0 0 680 500" fill="none">
        <defs>
          <linearGradient
            id={id + "wall"}
            x1="160"
            y1="75"
            x2="480"
            y2="330"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#eee8df" />
            <stop offset="1" stopColor="#d8d2c9" />
          </linearGradient>
          <linearGradient
            id={id + "seat"}
            x1="250"
            y1="180"
            x2="430"
            y2="370"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c9bdb4" />
            <stop offset="1" stopColor="#887d75" />
          </linearGradient>
          <linearGradient
            id={id + "floor"}
            x1="130"
            y1="300"
            x2="530"
            y2="450"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#f5eee1" />
            <stop offset="1" stopColor="#ded6c6" />
          </linearGradient>
          <filter
            id={id + "shadow"}
            x="-30%"
            y="-40%"
            width="180%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="15" />
          </filter>
        </defs>
        <ellipse
          cx="351"
          cy="422"
          rx="215"
          ry="34"
          fill="#776f62"
          opacity=".16"
          filter={"url(#" + id + "shadow)"}
        />
        <g className="scene-room">
          <path
            d="M112 311 336 181 571 316 346 448Z"
            fill={"url(#" + id + "floor)"}
          />
          <path d="M112 311v13l234 136v-12Z" fill="#d2c8b8" />
          <path d="m346 448 225-132v13L346 460Z" fill="#bfb8aa" />
          <path d="M112 311V106L337 0v181Z" fill="#ece6dd" />
          <path d="M337 0 571 135v181L337 181Z" fill={"url(#" + id + "wall)"} />
          <path d="M112 106 123 112 337 12V0Z" fill="#fffaf2" />
          <path d="m337 0 234 135-12 6L337 12Z" fill="#f4ede4" />
          <g className="scene-window">
            <path d="m153 125 131-66v118l-131 75Z" fill="#c1cad5" />
            <path d="m164 132 109-56v95l-109 62Z" fill="#d9e4e5" />
            <path d="m218 103 4-3v103l-4 2Z" fill="#f7f3ed" />
            <path d="m165 178 107-57v5l-107 58Z" fill="#f7f3ed" />
            <path d="m153 252 131-75 14 8-131 76Z" fill="#fffcf4" />
          </g>
          <path d="m209 316 148-84 130 74-146 87Z" fill="#e7e1d2" />
          <path
            d="m222 319 135-77 116 66-132 77Z"
            stroke="#d4cdbd"
            strokeWidth="2"
          />
          <g className="scene-art">
            <path d="m398 89 73 42v79l-73-42Z" fill="#958e82" />
            <path d="m404 101 61 35v62l-61-35Z" fill="#f7efdd" />
            <path d="m415 142 11-20 14 41 17-13v36l-42-24Z" fill="#798f75" />
            <ellipse
              cx="448"
              cy="145"
              rx="6"
              ry="10"
              transform="rotate(-26 448 145)"
              fill="#d58d61"
            />
          </g>
          <g className="scene-sofa">
            <path d="m265 287 111-65 133 76-111 66Z" fill="#81756d" />
            <path
              d="m273 273 102-59 125 72v31l-103 61-124-72Z"
              fill="#9b8c82"
            />
            <path
              d="m273 211 102-59 125 72v64l-103 61-124-72Z"
              fill={"url(#" + id + "seat)"}
            />
            <path d="m273 211 13 8 88-51 112 65 14-9-125-72Z" fill="#d0c6bb" />
            <path d="m286 219 111 64v50l-111-64Z" fill="#a79a8f" />
            <path d="m397 283 89-50v50l-89 52Z" fill="#c2b6a9" />
            <path d="m279 279 31-18 86 50 91-52 18 11-109 63Z" fill="#d6cabe" />
            <path d="m286 279 21-12 72 42-21 13Z" fill="#dcd3c7" />
            <path d="m367 327 20-12 92-53 19 11-111 64Z" fill="#e1d7c9" />
            <path d="m267 249 20-11 20 11v49l-20 11-20-12Z" fill="#a5968a" />
            <path d="m267 249 20 11 20-11-20-11Z" fill="#d4c9bd" />
            <path d="m480 287 19-11 19 11v49l-19 11-19-11Z" fill="#aa9c8f" />
            <path d="m480 287 19 12 19-12-19-11Z" fill="#ded3c5" />
            <path
              d="m290 308 8 5v20l-8-5Zm100 58 8-5v19l-8 5Zm107-21 8-5v19l-8 5Z"
              fill="#4e4944"
            />
            <g className="scene-cushions">
              <path d="m309 229 28 16-2 32-28-16Z" fill="#6575c5" />
              <path d="m416 272 28-16 4 28-28 16Z" fill="#d78367" />
            </g>
          </g>
          <g className="scene-table">
            <ellipse cx="280" cy="357" rx="47" ry="26" fill="#c8baa3" />
            <path d="M233 352v7c0 30 94 30 94-1v-6Z" fill="#b49a7d" />
            <ellipse cx="280" cy="352" rx="47" ry="25" fill="#e2cbb0" />
            <path d="M249 372v26m62-28v22" stroke="#8a745f" strokeWidth="5" />
            <path d="m264 339 17-10 21 12-17 10Z" fill="#ec7b56" />
            <path d="m264 339 21 12v4l-21-12Z" fill="#bd5e42" />
            <ellipse cx="277" cy="360" rx="9" ry="5" fill="#fff9ed" />
            <path d="M268 352v8c0 7 18 7 18 0v-8Z" fill="#f5f0e6" />
            <ellipse cx="277" cy="352" rx="9" ry="5" fill="#fbf7ee" />
          </g>
          <g className="scene-plant">
            <ellipse cx="505" cy="381" rx="22" ry="12" fill="#c1b39c" />
            <path d="m483 353 7 28c3 11 26 11 30 0l7-28Z" fill="#c28565" />
            <ellipse cx="505" cy="353" rx="22" ry="12" fill="#ddac89" />
            <path d="M505 354v-85" stroke="#65754b" strokeWidth="4" />
            <path
              d="M504 319c-44-8-42-42-42-42 41-1 43 42 43 42Zm1-14c38-15 39-45 39-45-36 6-39 45-39 45Zm0-17c-25-19-10-48-10-48 28 18 10 48 10 48Z"
              fill="#7f9464"
            />
          </g>
          <g className="scene-lamp">
            <path d="M186 283v70" stroke="#95856a" strokeWidth="4" />
            <ellipse cx="186" cy="353" rx="22" ry="10" fill="#b6a48a" />
            <path d="m166 227-15 54c0 20 70 20 70 0l-15-54Z" fill="#eee0bc" />
            <ellipse cx="186" cy="227" rx="20" ry="10" fill="#f8edcf" />
          </g>
        </g>
      </svg>
    </div>
  );
}
