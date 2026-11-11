// Home page: lists the games and shows which ones have a game in progress.

import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import "./pwa";
import { showGameOfTheDay } from "./gotd";
import { checkForUpdate } from "./update";
import { THEMES, getTheme, setTheme } from "./theme";

type Save = Record<string, any> | null;

/** Reads a game's saved state without importing the game itself. */
function readSave(key: string): Save {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function showStatus(id: string, inProgress: boolean) {
  const el = document.getElementById(id)!;
  el.hidden = !inProgress;
  el.textContent = "In progress";
}

/** When each game's saved state counts as a game in progress, without importing the game itself. */
const IN_PROGRESS: [id: string, started: (save: Save) => boolean][] = [
  ["sudoku", (s) => !!s && !s.done],
  // A Minesweeper board only counts as started once its mines are placed, on the first reveal.
  ["minesweeper", (s) => s?.status === "playing" && !!s.board?.mines?.length],
  // A 2248 board counts as started from its first merge, a 2048 board from its first move.
  ["2248", (s) => s?.status === "playing" && !!s.startedAt],
  ["2048", (s) => s?.status === "playing" && !!s.startedAt],
  // A Halo ring counts from its first move.
  ["halo", (s) => s?.status === "playing" && !!s.startedAt],
  // A tic-tac-toe round or a dots and boxes game counts once someone has played.
  ["tictactoe", (s) => s?.status === "playing" && !!s.moves?.length],
  ["dots", (s) => s?.status === "playing" && !!s.moves?.length],
];

// The newer games all save `started` from their first move.
for (const id of [
  "killer",
  "kakuro",
  "calcudoku",
  "futoshiki",
  "skyscrapers",
  "jigsaw",
  "sudokux",
  "nonograms",
  "takuzu",
  "nurikabe",
  "hitori",
  "starbattle",
  "lightsout",
  "tents",
  "lightup",
  "heyawake",
  "lits",
  "slitherlink",
  "masyu",
  "bridges",
  "flow",
  "watersort",
  "threes",
  "fifteen",
  "sokoban",
  "rushhour",
  "pegs",
  "connect4",
  "reversi",
  "gomoku",
  "morris",
  "checkers",
  "mancala",
  "ultimate",
  "hex",
  "go",
  "chess",
  "backgammon",
  "battleship",
  "klondike",
  "freecell",
  "spider",
  "yukon",
  "canfield",
  "fortythieves",
  "pyramid",
  "tripeaks",
  "golf",
  "wordguess",
  "wordsearch",
  "letterwheel",
  "yacht",
  "farkle",
  "pig",
])
  IN_PROGRESS.push([id, (s) => s?.status === "playing" && !!s.started]);

function renderStatus() {
  for (const [id, started] of IN_PROGRESS)
    showStatus(`${id}-status`, started(readSave(`${id}.current`)));
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/**
 * The Install button on the web home page: installs the PWA when the browser offers it, otherwise (Safari, Firefox,
 * or no prompt available) sends the player to the latest release to download the Android app. Hidden once installed.
 */
function setupInstallButton() {
  const btn = document.getElementById(
    "install-btn",
  ) as HTMLButtonElement | null;
  if (!btn || matchMedia("(display-mode: standalone)").matches) return;

  let deferred: InstallPromptEvent | null = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    btn.hidden = true;
    deferred = null;
  });

  btn.addEventListener("click", async () => {
    if (deferred) {
      const prompt = deferred;
      deferred = null;
      await prompt.prompt();
    } else {
      window.open(
        "https://github.com/abhi-sawant/games/releases/latest",
        "_blank",
        "noopener",
      );
    }
  });
  btn.hidden = false;
}

/** The Theme button: a dialog of the looks in src/themes.css, each drawn in its own colours. Picking one applies it at once. */
function setupThemePicker() {
  const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
  const grid = document.getElementById("theme-grid")!;
  const options = THEMES.map((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-opt";
    btn.dataset.theme = t.id;
    btn.setAttribute("role", "radio");
    btn.innerHTML = `<span class="theme-chip" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="theme-name"></span><span class="theme-note"></span>`;
    btn.querySelector(".theme-name")!.textContent = t.name;
    btn.querySelector(".theme-note")!.textContent = t.note;
    btn.addEventListener("click", () => {
      setTheme(t.id);
      mark();
    });
    grid.append(btn);
    return btn;
  });
  const mark = () => {
    const current = getTheme();
    for (const btn of options) btn.setAttribute("aria-checked", String(btn.dataset.theme === current));
  };
  mark();

  document.getElementById("theme-btn")!.addEventListener("click", () => dialog.showModal());
  document.getElementById("theme-close")!.addEventListener("click", () => dialog.close());
  // A tap on the backdrop closes it too.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
}

document.getElementById("app-version")!.textContent = `v${__APP_VERSION__}`;

setupThemePicker();
showGameOfTheDay();
renderStatus();
// Coming back with the browser's back button can restore this page from the bfcache.
window.addEventListener("pageshow", renderStatus);

if (Capacitor.isNativePlatform()) {
  CapApp.addListener("backButton", () => CapApp.exitApp());
  // The web version updates itself through its service worker; the Android app has to be reinstalled from GitHub.
  checkForUpdate(__APP_VERSION__);
} else {
  setupInstallButton();
}

if (!Capacitor.isNativePlatform() && import.meta.env.DEV) {
  // Preview the update dialog in the browser: ?update-check=1.0.0 pretends that version is installed.
  const pretend = new URLSearchParams(location.search).get("update-check");
  if (pretend) checkForUpdate(pretend, { force: true });
}
