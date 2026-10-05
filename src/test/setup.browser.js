import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "../index.css";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// localStorage guarda a cópia do modo sem rede: cada teste começa sem ela.
afterEach(() => { cleanup(); localStorage.clear(); });
