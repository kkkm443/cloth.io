import { h } from './runtime.js';
export function MessageIcon({ size = 18, ...rest }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...rest },
        h("path", { d: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z" }),
        h("path", { d: "M8 10h8M8 14h5" }));
}
export function EmpathyIcon({ size = 17, filled = false, ...rest }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: filled ? 'currentColor' : 'none', stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...rest },
        h("path", { d: "M7 10v11H3V10h4ZM7 10l5-8c2 0 3 2 2 5l-1 3h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7" }));
}
