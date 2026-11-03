/* Shared demo content for the three candidates: the same screens, skinned three ways. Placeholder data. */
(function () {
  const P = {
    ico: {
      back: 'M15 5l-7 7 7 7', pause: 'M8 5v14M16 5v14', go: 'M9 5l7 7-7 7', plus: 'M12 5v14M5 12h14',
      undo: 'M9 14L4 9l5-5M4 9h9a7 7 0 0 1 0 14h-3',
      erase: 'M20 20H9L4 15a2 2 0 0 1 0-3L13 3a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-9 9',
      pencil: 'M4 20l1-5L16 4a2.1 2.1 0 0 1 3 3L8 18zM14 6l4 4',
      bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.4c.7.7 1 1.5 1 2.6h6c0-1.1.3-1.9 1-2.6A6 6 0 0 0 12 3z',
      bolt: 'M13 3L5 14h6l-1 7 8-11h-6z', restart: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
    },
    suits: {
      H: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
      D: 'M12 2l7 10-7 10-7-10z',
      S: 'M12 2c3 4 8 6.5 8 11a4.2 4.2 0 0 1-7 3.1c.2 2 .9 3.9 2.5 5.4h-7c1.6-1.5 2.3-3.4 2.5-5.4A4.2 4.2 0 0 1 4 13c0-4.5 5-7 8-11z',
      C: 'M12 2.5a4.3 4.3 0 0 0-3.6 6.7A4.3 4.3 0 1 0 11 15.6c-.1 2-.8 3.8-2.4 5.4h6.8c-1.6-1.6-2.3-3.4-2.4-5.4a4.3 4.3 0 1 0 2.6-6.4A4.3 4.3 0 0 0 12 2.5z',
    },
    pixel: {
      H: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
      D: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
      S: ['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..'],
      C: ['..###..', '..###..', '#.###.#', '#######', '#.###.#', '...#...', '..###..'],
    },
    suitStyle: 'vector',
  };

  const svg = (d, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const ico = (n, cls) => svg(P.ico[n], cls);
  const suit = (s, cls = 's') => {
    if (P.suitStyle === 'pixel') {
      const rects = P.pixel[s].flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('');
      return `<svg class="${cls}" viewBox="0 0 7 7" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
    }
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${P.suits[s]}"/></svg>`;
  };

  /* ---------- home ---------- */
  const PAT = {
    Sudoku: '5 . 3 . 7 . 1 . 9', 'Killer Sudoku': '12 . 7 . 9 . 4 . 15', Kakuro: 'x 7 4 5 . . 9 . .', Calcudoku: '6+ . 2 . 3 . 1 . 4',
    Futoshiki: '2 < 1 . . . 3 > 2', Skyscrapers: '3 . 1 . . . 2 . 4',
    Minesweeper: '1 1 1 1 x 1 1 1 1', Nonograms: 'x x . x . x . x x', Takuzu: '0 1 1 . 0 1 1 . 0', 'Lights Out': 'o x o x x x o x o',
    Flow: 'o . x . . . x . o', 'Water Sort': 'x x o x o o x o o',
    '2248': '2 2 8 4 4 2 16 8 32', '2048': '2 . 4 . 8 2 4 . 16', Threes: '1 . 2 . 3 . 6 1 12', '15-puzzle': '3 1 2 4 5 6 7 8 .', Sokoban: '. x . x o x . x .',
    'Rush Hour': 'x x . . . x o o o', 'Peg Solitaire': 'o o o o . o o o o',
    'Tic-tac-toe': 'X O X . X O O . X', 'Dots and Boxes': 'o . o . x . o . o', 'Connect Four': '. . . . x . x o o', Reversi: 'o x o x o x o x o',
    Gomoku: 'x o . . x o . . x', "Nine Men's Morris": 'o . o . o . o . o', Checkers: 'o . o . . . x . x', Mancala: 'o o o x x x o o o', Chess: 'R . K . . . . . p', Go: 'x o . o x . . . x',
    Klondike: 'A . K . Q . J . 10', FreeCell: 'K . Q . J . 10 . 9', Spider: 'A . 2 . 3 . 4 . 5', Yukon: 'K . . Q . . J . .', Canfield: 'A . . K . . Q . .', 'Forty Thieves': 'A A K K Q Q J J 10',
    'Word Guess': 'W O R D . . . . .', 'Word Search': 'C A T . . . . . .', 'Letter Wheel': '. W . A O R . D .',
    Yacht: 'o . o . o . o . o', Farkle: 'o . o . . . o . o', Pig: 'o . . . o . . . o', 'Crazy Cat': '. x . x x x x . x',
  };
  const FALL = { number: '1 . 2 . 3 . 4 . 5', logic: 'x . x . x . x . x', tiles: '2 4 8 . . . 4 2 16', computer: 'x o x o x o x o x', cards: 'A . K . Q . J . 10', words: 'W O R D . . . . .', dice: 'o . o . o . o . o', arcade: '. x . x x x x . x' };
  const CATS = [
    { id: 'number', name: 'Number puzzles', total: 8, shown: ['Sudoku', 'Killer Sudoku', 'Kakuro', 'Calcudoku', 'Futoshiki', 'Skyscrapers'] },
    { id: 'logic', name: 'Logic puzzles', total: 16, shown: ['Minesweeper', 'Nonograms', 'Takuzu', 'Lights Out', 'Flow', 'Water Sort'] },
    { id: 'tiles', name: 'Number tiles', total: 7, shown: ['2248', '2048', 'Threes', '15-puzzle', 'Sokoban', 'Rush Hour'] },
    { id: 'computer', name: 'Play the computer', total: 14, shown: ['Tic-tac-toe', 'Connect Four', 'Reversi', 'Checkers', 'Chess', 'Go'] },
    { id: 'cards', name: 'Cards', total: 9, shown: ['Klondike', 'FreeCell', 'Spider', 'Yukon', 'Canfield', 'Forty Thieves'] },
    { id: 'words', name: 'Word games', total: 3, shown: ['Word Guess', 'Word Search', 'Letter Wheel'] },
    { id: 'dice', name: 'Dice games', total: 3, shown: ['Yacht', 'Farkle', 'Pig'] },
    { id: 'arcade', name: 'Arcade', total: 1, shown: ['Crazy Cat'] },
  ];
  const META = { Sudoku: 'Medium, 12:40', Minesweeper: 'Best 0:48', '2048': 'Best 4096', Chess: '3 wins', Klondike: '12 wins', 'Connect Four': 'In progress', 'Word Guess': 'Daily ready' };

  const icon = (name, cat) => {
    const cells = (PAT[name] || FALL[cat]).split(' ');
    const cls = (t) => (t === 'x' ? 'x' : t === 'o' ? 'o' : t === '.' ? 'e' : '');
    return `<span class="icon" aria-hidden="true">${cells.map((t) => `<i class="${cls(t)}">${t === 'x' || t === 'o' || t === '.' ? '' : t}</i>`).join('')}</span>`;
  };

  const home = () => `
  <div class="app home">
    <header class="mast">
      <h1 class="wordmark">Games</h1>
      <span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <p class="tagline">Free. Offline. No ads.</p>
    </header>
    <a class="continue" href="#">
      ${icon('Sudoku', 'number')}
      <span class="txt"><b>Continue Sudoku</b><small>Medium, 12:40, 31 of 81 filled</small></span>
      ${ico('go', 'go')}
    </a>
    <nav class="cats" aria-label="Games">
      ${CATS.map((c) => `
      <section class="cat" data-cat="${c.id}">
        <h2><span class="cat-name">${c.name}</span><small class="count">${c.total} games</small></h2>
        <div class="games">
          ${c.shown.map((g) => `<a class="game" href="#" data-game="${g}">${icon(g, c.id)}<span class="name">${g}</span>${META[g] ? `<span class="meta">${META[g]}</span>` : '<span class="meta"></span>'}</a>`).join('')}
          ${c.total > c.shown.length ? `<a class="game more" href="#"><span class="plus">${c.total - c.shown.length}+</span><span class="name">more</span></a>` : ''}
        </div>
      </section>`).join('')}
    </nav>
    <p class="demo-note">Placeholder data for the prototype.</p>
  </div>`;

  /* ---------- sudoku ---------- */
  const GIVEN = ['53..7....', '6..195...', '.98....6.', '8...6...3', '4..8.3..1', '7...2...6', '.6....28.', '...419..5', '....8..79'];
  const ENTRY = { '0,2': 4, '0,3': 6, '0,5': 8, '1,1': 7, '1,2': 2, '2,3': 3, '2,0': 5, '3,1': 9, '4,4': 0 };
  const NOTES = { '4,1': [2, 5], '4,2': [2, 5, 9], '3,2': [1, 2, 4], '3,3': [1, 2, 5, 7, 9], '5,1': [1, 3, 8, 9] };
  const SEL = [4, 4];
  const sudoku = () => {
    const counts = Array(10).fill(0);
    let cells = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const g = GIVEN[r][c], e = ENTRY[`${r},${c}`], n = NOTES[`${r},${c}`];
        const sel = r === SEL[0] && c === SEL[1];
        const peer = !sel && (r === SEL[0] || c === SEL[1] || (Math.floor(r / 3) === Math.floor(SEL[0] / 3) && Math.floor(c / 3) === Math.floor(SEL[1] / 3)));
        const cls = ['cell', g !== '.' ? 'given' : e ? 'entry' : n ? 'notes' : 'blank', sel && 'sel', peer && 'peer', c % 3 === 2 && c < 8 && 'br', r % 3 === 2 && r < 8 && 'bb', c % 3 === 0 && 'bl', r % 3 === 0 && 'bt'];
        let inner = '';
        if (g !== '.') { inner = g; counts[+g]++; }
        else if (e) { inner = e; counts[e]++; if (r === 2 && c === 0) cls.push('wrong'); }
        else if (n) inner = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<i>${n.includes(d) ? d : ''}</i>`).join('');
        cells += `<div class="${cls.filter(Boolean).join(' ')}">${inner}</div>`;
      }
    }
    return `
  <div class="app play" data-game="sudoku" data-cat="number">
    <header class="topbar">
      <a class="icon-btn back" href="#" aria-label="All games">${ico('back')}</a>
      <div class="meta"><b>Medium</b><span>Sudoku</span></div>
      <button class="timer" aria-label="Pause">${ico('pause')}<span class="mono">12:40</span></button>
    </header>
    <div class="board sudoku">${cells}</div>
    <div class="tools">
      <button class="tool">${ico('undo')}<span>Undo</span></button>
      <button class="tool">${ico('erase')}<span>Erase</span></button>
      <button class="tool active">${ico('pencil')}<span>Notes</span></button>
      <button class="tool">${ico('bulb')}<span>Hint</span></button>
    </div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key${9 - counts[d] <= 0 ? ' done' : ''}"><b>${d}</b><small class="mono">${Math.max(0, 9 - counts[d])}</small></button>`).join('')}</div>
  </div>`;
  };

  /* ---------- klondike ---------- */
  const RED = { H: 1, D: 1 };
  const card = (r, s) => `<div class="card up ${RED[s] ? 'red' : 'black'}"><b>${r}</b>${suit(s, 's')}${suit(s, 'pip')}</div>`;
  const down = () => '<div class="card down"></div>';
  const COLS = [
    { d: 0, u: [['K', 'H'], ['Q', 'C'], ['J', 'D']] }, { d: 1, u: [['8', 'S']] }, { d: 2, u: [['Q', 'D'], ['J', 'S']] }, { d: 3, u: [['6', 'H']] },
    { d: 4, u: [['10', 'D'], ['9', 'C']] }, { d: 3, u: [['3', 'S']] }, { d: 5, u: [['7', 'D'], ['6', 'S'], ['5', 'H']] },
  ];
  const klondike = () => `
  <div class="app play" data-game="klondike" data-cat="cards">
    <header class="topbar">
      <a class="icon-btn back" href="#" aria-label="All games">${ico('back')}</a>
      <div class="meta"><b>Draw 1</b><span>Klondike</span></div>
      <button class="timer" aria-label="Pause">${ico('pause')}<span class="mono">6:12</span></button>
    </header>
    <div class="table">
      <div class="top-row">
        <div class="slot-card stock"><div class="card down"></div></div>
        <div class="slot-card waste">${card('5', 'C')}</div>
        <div class="slot-card gap"></div>
        <div class="slot-card found" data-suit="H">${card('2', 'H')}</div>
        <div class="slot-card found" data-suit="S">${card('A', 'S')}</div>
        <div class="slot-card found empty" data-suit="D">${suit('D', 's')}</div>
        <div class="slot-card found" data-suit="C">${card('3', 'C')}</div>
      </div>
      <div class="tableau">
        ${COLS.map((c, i) => `<div class="col" data-col="${i}">${Array(c.d).fill(0).map(down).join('')}${c.u.map(([r, s], j) => `${j === c.u.length - 1 && i === 6 ? card(r, s).replace('card up', 'card up hint') : card(r, s)}`).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="tools">
      <button class="tool">${ico('undo')}<span>Undo</span></button>
      <button class="tool">${ico('bulb')}<span>Hint</span></button>
      <button class="tool">${ico('bolt')}<span>Auto</span></button>
      <button class="tool">${ico('restart')}<span>New deal</span></button>
    </div>
  </div>`;

  /* ---------- connect four ---------- */
  const C4 = ['.......', '...a...', '..ba...', '.aaba..', 'abbab..', 'baabab.'];
  const connect4 = () => `
  <div class="app play" data-game="connect4" data-cat="computer">
    <header class="topbar">
      <a class="icon-btn back" href="#" aria-label="All games">${ico('back')}</a>
      <div class="meta"><b>Medium</b><span>Connect Four</span></div>
      <div class="score"><span class="mono">Move 17</span></div>
    </header>
    <div class="tally">
      <span class="chip p1">You <b class="mono">2</b></span><span class="chip draw">Draws <b class="mono">0</b></span><span class="chip p2">Computer <b class="mono">1</b></span>
    </div>
    <div class="c4wrap">
      <div class="drop">${[0, 1, 2, 3, 4, 5, 6].map((c) => `<span class="slot${c === 5 ? ' ghost a' : ''}"></span>`).join('')}</div>
      <div class="board c4">${C4.map((row, r) => [...row].map((ch, c) => `<span class="slot${ch === 'a' ? ' a' : ch === 'b' ? ' b' : ''}${r === 3 && c === 4 ? ' last' : ''}${r === 4 && c === 5 ? ' next' : ''}"></span>`).join('')).join('')}</div>
    </div>
    <p class="status-line"><b>Your move.</b> The computer is thinking one step ahead.</p>
    <div class="tools">
      <button class="tool">${ico('undo')}<span>Undo</span></button>
      <button class="tool">${ico('bulb')}<span>Hint</span></button>
      <button class="tool">${ico('restart')}<span>Restart</span></button>
      <button class="tool">${ico('plus')}<span>New game</span></button>
    </div>
  </div>`;

  /* ---------- mount ---------- */
  P.mount = function (opts = {}) {
    if (opts.suitStyle) P.suitStyle = opts.suitStyle;
    const screens = [['Home', home], ['Sudoku', sudoku], ['Klondike', klondike], ['Connect Four', connect4]];
    document.getElementById('phones').innerHTML = screens.map(([label, fn]) => `<figure class="phone-wrap"><div class="phone"><div class="screen">${fn()}</div></div><figcaption>${label}</figcaption></figure>`).join('');
    const solo = new URLSearchParams(location.search).get('solo');
    if (solo !== null) { document.body.classList.add('solo'); document.querySelectorAll('.phone-wrap').forEach((el, i) => { if (i !== +solo) el.remove(); }); }
    const root = document.documentElement;
    const store = (() => { try { return localStorage; } catch (e) { return null; } })();
    const saved = store && store.getItem('cand-theme');
    root.dataset.theme = new URLSearchParams(location.search).get('theme') || saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const btn = document.getElementById('theme');
    const label = () => (btn.textContent = root.dataset.theme === 'dark' ? 'Show light' : 'Show dark');
    label();
    btn.addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; if (store) store.setItem('cand-theme', root.dataset.theme); label(); });
  };
  window.Proto = P;
})();
