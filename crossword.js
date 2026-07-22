/**
 * Skinable Crossword Player for Webflow
 * Usage: <div class="crossword" data-crossword-src="/puzzles/example.json"></div>
 *        <script src="/crossword.js" defer></script>
 */
(function () {
  "use strict";

  const BLOCK = "#";
  const DIRECTIONS = ["across", "down"];

  function puzzleFromCMS(root) {
    const source = root.closest(".crossword-cms-source") || document;
    const rows = Number(root.dataset.rows);
    const cols = Number(root.dataset.columns);

    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
      throw new Error("CMS puzzles require valid data-rows and data-columns values of at least 2.");
    }

    const records = Array.from(source.querySelectorAll(".cw-entry-data")).map((element) => ({
      answer: String(element.dataset.answer || "").toUpperCase().replace(/[^A-Z]/g, ""),
      clue: String(element.dataset.clue || ""),
      direction: String(element.dataset.direction || "").toLowerCase(),
      row: Number(element.dataset.row) - 1,
      col: Number(element.dataset.column) - 1,
    }));

    if (!records.length) throw new Error("No CMS crossword entries were found.");

    const grid = Array.from({ length: rows }, () => Array(cols).fill(BLOCK));
    const starts = new Map();

    records.forEach((entry, index) => {
      if (!entry.answer || !DIRECTIONS.includes(entry.direction)) {
        throw new Error(`CMS entry ${index + 1} needs an answer and Across or Down direction.`);
      }
      if (!Number.isInteger(entry.row) || !Number.isInteger(entry.col) || entry.row < 0 || entry.col < 0) {
        throw new Error(`CMS entry ${index + 1} has an invalid starting row or column.`);
      }

      entry.answer.split("").forEach((letter, offset) => {
        const row = entry.row + (entry.direction === "down" ? offset : 0);
        const col = entry.col + (entry.direction === "across" ? offset : 0);
        if (row >= rows || col >= cols) {
          throw new Error(`The answer “${entry.answer}” extends beyond the ${rows}×${cols} grid.`);
        }
        if (grid[row][col] !== BLOCK && grid[row][col] !== letter) {
          throw new Error(`The answer “${entry.answer}” conflicts with another answer at row ${row + 1}, column ${col + 1}.`);
        }
        grid[row][col] = letter;
      });

      const startKey = `${entry.row},${entry.col},${entry.direction}`;
      if (starts.has(startKey)) throw new Error(`More than one ${entry.direction} answer begins at row ${entry.row + 1}, column ${entry.col + 1}.`);
      starts.set(startKey, entry);
    });

    const clues = { across: {}, down: {} };
    let number = 0;
    const isOpen = (row, col) => row >= 0 && row < rows && col >= 0 && col < cols && grid[row][col] !== BLOCK;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (!isOpen(row, col)) continue;
        const startsAcross = !isOpen(row, col - 1) && isOpen(row, col + 1);
        const startsDown = !isOpen(row - 1, col) && isOpen(row + 1, col);
        if (!startsAcross && !startsDown) continue;
        number += 1;

        if (startsAcross) {
          const record = starts.get(`${row},${col},across`);
          if (!record) throw new Error(`An Across answer is missing at row ${row + 1}, column ${col + 1}.`);
          clues.across[number] = record.clue;
        }
        if (startsDown) {
          const record = starts.get(`${row},${col},down`);
          if (!record) throw new Error(`A Down answer is missing at row ${row + 1}, column ${col + 1}.`);
          clues.down[number] = record.clue;
        }
      }
    }

    records.forEach((entry) => {
      if (!starts.has(`${entry.row},${entry.col},${entry.direction}`)) return;
      const beforeRow = entry.row - (entry.direction === "down" ? 1 : 0);
      const beforeCol = entry.col - (entry.direction === "across" ? 1 : 0);
      if (isOpen(beforeRow, beforeCol)) {
        throw new Error(`The answer “${entry.answer}” does not begin at the start of a grid entry.`);
      }
    });

    return {
      id: root.dataset.crosswordId,
      title: root.dataset.title,
      author: root.dataset.author,
      description: root.dataset.description,
      solution: grid.map((row) => row.join("")),
      clues,
    };
  }

  class CrosswordPlayer {
    constructor(root, puzzle) {
      this.root = root;
      this.puzzle = this.normalizePuzzle(puzzle);
      this.rows = this.puzzle.solution.length;
      this.cols = this.puzzle.solution[0].length;
      this.cells = [];
      this.entries = [];
      this.entryByCell = new Map();
      this.activeCell = null;
      this.direction = "across";
      this.completed = false;
      this.storageKey = `crossword:${this.puzzle.id}`;
      this.buildEntries();
      this.render();
      this.restore();
      this.selectFirstCell();
    }

    normalizePuzzle(puzzle) {
      if (!puzzle || !Array.isArray(puzzle.solution) || !puzzle.solution.length) {
        throw new Error("Puzzle must contain a non-empty solution array.");
      }

      const solution = puzzle.solution.map((row) =>
        String(row).toUpperCase().replace(/\./g, BLOCK)
      );
      const width = solution[0].length;
      if (!width || solution.some((row) => row.length !== width)) {
        throw new Error("Every solution row must have the same length.");
      }

      return {
        id: String(puzzle.id || this.root.dataset.crosswordId || "crossword"),
        title: String(puzzle.title || "Crossword"),
        author: String(puzzle.author || ""),
        description: String(puzzle.description || ""),
        solution,
        clues: {
          across: puzzle.clues?.across || {},
          down: puzzle.clues?.down || {},
        },
      };
    }

    key(row, col) {
      return `${row},${col}`;
    }

    isOpen(row, col) {
      return (
        row >= 0 && row < this.rows && col >= 0 && col < this.cols &&
        this.puzzle.solution[row][col] !== BLOCK
      );
    }

    buildEntries() {
      let number = 0;

      for (let row = 0; row < this.rows; row += 1) {
        for (let col = 0; col < this.cols; col += 1) {
          if (!this.isOpen(row, col)) continue;

          const startsAcross = !this.isOpen(row, col - 1) && this.isOpen(row, col + 1);
          const startsDown = !this.isOpen(row - 1, col) && this.isOpen(row + 1, col);
          if (!startsAcross && !startsDown) continue;
          number += 1;

          if (startsAcross) this.addEntry(number, "across", row, col);
          if (startsDown) this.addEntry(number, "down", row, col);
        }
      }
    }

    addEntry(number, direction, startRow, startCol) {
      const cells = [];
      let row = startRow;
      let col = startCol;

      while (this.isOpen(row, col)) {
        cells.push({ row, col });
        if (direction === "across") col += 1;
        else row += 1;
      }

      const entry = {
        id: `${number}-${direction}`,
        number,
        direction,
        cells,
        clue: String(this.puzzle.clues[direction][number] || ""),
      };
      this.entries.push(entry);

      cells.forEach(({ row: r, col: c }) => {
        const key = this.key(r, c);
        const record = this.entryByCell.get(key) || {};
        record[direction] = entry;
        this.entryByCell.set(key, record);
      });
    }

    render() {
      this.root.classList.add("cw-player");
      this.root.classList.toggle("cw-wide-grid", this.cols >= 15);
      this.root.innerHTML = `
        <div class="cw-header">
          <div>
            <h2 class="cw-title"></h2>
            <p class="cw-author"></p>
          </div>
          <button class="cw-menu-button" type="button" aria-expanded="false" aria-controls="cw-tools-${this.puzzle.id}">Options</button>
        </div>
        <p class="cw-description"></p>
        <div class="cw-status" role="status" aria-live="polite"></div>
        <div class="cw-layout">
          <div class="cw-board-column">
            <div class="cw-grid" role="grid" aria-label="${this.escape(this.puzzle.title)}"></div>
            <div class="cw-current-clue" aria-live="polite"></div>
          </div>
          <div class="cw-clues" aria-label="Crossword clues"></div>
        </div>
        <div class="cw-tools" id="cw-tools-${this.escape(this.puzzle.id)}">
          <div class="cw-tool-group" aria-label="Check answers">
            <span>Check</span>
            <button type="button" data-action="check-letter">Letter</button>
            <button type="button" data-action="check-word">Word</button>
            <button type="button" data-action="check-puzzle">Puzzle</button>
          </div>
          <div class="cw-tool-group" aria-label="Reveal answers">
            <span>Reveal</span>
            <button type="button" data-action="reveal-letter">Letter</button>
            <button type="button" data-action="reveal-word">Word</button>
            <button type="button" data-action="reveal-puzzle">Puzzle</button>
          </div>
          <button class="cw-reset" type="button" data-action="reset">Reset puzzle</button>
        </div>
        <div class="cw-complete" role="dialog" aria-modal="true" aria-labelledby="cw-complete-title-${this.escape(this.puzzle.id)}" hidden>
          <div class="cw-complete-card">
            <h2 id="cw-complete-title-${this.escape(this.puzzle.id)}">Puzzle complete!</h2>
            <p>You solved ${this.escape(this.puzzle.title)}.</p>
            <button type="button" data-action="close-complete">Continue</button>
          </div>
        </div>
        <input class="cw-mobile-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" aria-label="Enter a crossword letter">
      `;

      this.root.querySelector(".cw-title").textContent = this.puzzle.title;
      const author = this.root.querySelector(".cw-author");
      author.textContent = this.puzzle.author ? `By ${this.puzzle.author}` : "";
      author.hidden = !this.puzzle.author;
      const description = this.root.querySelector(".cw-description");
      description.textContent = this.puzzle.description;
      description.hidden = !this.puzzle.description;

      this.grid = this.root.querySelector(".cw-grid");
      this.grid.style.setProperty("--cw-columns", this.cols);
      this.renderGrid();
      this.renderClues();
      this.bindEvents();
    }

    renderGrid() {
      const numberAt = new Map();
      this.entries.forEach((entry) => {
        const first = entry.cells[0];
        numberAt.set(this.key(first.row, first.col), entry.number);
      });

      for (let row = 0; row < this.rows; row += 1) {
        this.cells[row] = [];
        for (let col = 0; col < this.cols; col += 1) {
          const block = !this.isOpen(row, col);
          const cell = document.createElement(block ? "span" : "button");
          cell.className = block ? "cw-cell cw-block" : "cw-cell";
          cell.dataset.row = row;
          cell.dataset.col = col;

          if (block) {
            cell.setAttribute("role", "presentation");
          } else {
            cell.type = "button";
            cell.setAttribute("role", "gridcell");
            const cellNumber = numberAt.get(this.key(row, col));
            cell.innerHTML = `${cellNumber ? `<span class="cw-number">${cellNumber}</span>` : ""}<span class="cw-letter"></span>`;
            cell.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}, empty`);
          }

          this.grid.appendChild(cell);
          this.cells[row][col] = cell;
        }
      }
    }

    renderClues() {
      const holder = this.root.querySelector(".cw-clues");
      DIRECTIONS.forEach((direction) => {
        const section = document.createElement("section");
        section.className = `cw-clue-section cw-${direction}`;
        section.innerHTML = `<h3>${direction[0].toUpperCase() + direction.slice(1)}</h3><ol></ol>`;
        const list = section.querySelector("ol");

        this.entries.filter((entry) => entry.direction === direction).forEach((entry) => {
          const item = document.createElement("li");
          item.value = entry.number;
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.entry = entry.id;
          button.innerHTML = `<span class="cw-clue-number">${entry.number}</span><span>${this.escape(entry.clue || "Clue unavailable")}</span>`;
          item.appendChild(button);
          list.appendChild(item);
        });
        holder.appendChild(section);
      });
    }

    bindEvents() {
      this.grid.addEventListener("click", (event) => {
        const cell = event.target.closest("button.cw-cell");
        if (!cell) return;
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (this.activeCell?.row === row && this.activeCell?.col === col) {
          const other = this.direction === "across" ? "down" : "across";
          if (this.entryByCell.get(this.key(row, col))?.[other]) this.direction = other;
        }
        this.selectCell(row, col, true);
      });

      this.root.querySelector(".cw-clues").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-entry]");
        if (!button) return;
        const entry = this.entries.find((item) => item.id === button.dataset.entry);
        if (!entry) return;
        this.direction = entry.direction;
        this.selectCell(entry.cells[0].row, entry.cells[0].col, true);
      });

      this.root.addEventListener("keydown", (event) => this.onKeyDown(event));
      this.root.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (action) this.runAction(action);
      });

      const menu = this.root.querySelector(".cw-menu-button");
      menu.addEventListener("click", () => {
        const open = this.root.classList.toggle("cw-tools-open");
        menu.setAttribute("aria-expanded", String(open));
      });

      this.mobileInput = this.root.querySelector(".cw-mobile-input");
      this.mobileInput.addEventListener("input", () => {
        const letter = this.mobileInput.value.toUpperCase().match(/[A-Z]/)?.[0];
        this.mobileInput.value = "";
        if (letter) this.enterLetter(letter);
      });
      this.mobileInput.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Backspace") {
          event.preventDefault();
          this.erase();
        }
      });
    }

    onKeyDown(event) {
      if (event.target.closest(".cw-tools, .cw-menu-button, .cw-complete")) return;
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        this.enterLetter(event.key.toUpperCase());
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        this.erase();
        return;
      }

      const moves = {
        ArrowLeft: [0, -1, "across"],
        ArrowRight: [0, 1, "across"],
        ArrowUp: [-1, 0, "down"],
        ArrowDown: [1, 0, "down"],
      };
      if (moves[event.key]) {
        event.preventDefault();
        const [dr, dc, direction] = moves[event.key];
        this.direction = direction;
        this.moveSpatial(dr, dc);
      }
      if (event.key === " ") {
        event.preventDefault();
        this.toggleDirection();
      }
    }

    selectFirstCell() {
      const first = this.entries[0]?.cells[0];
      if (first) this.selectCell(first.row, first.col, false);
    }

    selectCell(row, col, focusKeyboard) {
      if (!this.isOpen(row, col)) return;
      this.activeCell = { row, col };
      const available = this.entryByCell.get(this.key(row, col));
      if (!available?.[this.direction]) {
        this.direction = available?.across ? "across" : "down";
      }
      this.updateSelection();
      if (focusKeyboard) {
        if (window.matchMedia("(pointer: coarse)").matches) this.mobileInput.focus({ preventScroll: true });
        else this.cells[row][col].focus({ preventScroll: true });
      }
    }

    activeEntry() {
      if (!this.activeCell) return null;
      return this.entryByCell.get(this.key(this.activeCell.row, this.activeCell.col))?.[this.direction] || null;
    }

    updateSelection() {
      const entry = this.activeEntry();
      this.root.querySelectorAll(".cw-cell").forEach((cell) => cell.classList.remove("is-active", "is-related"));
      this.root.querySelectorAll(".cw-clues button").forEach((clue) => {
        const active = clue.dataset.entry === entry?.id;
        clue.classList.toggle("is-active", active);
        clue.setAttribute("aria-current", active ? "true" : "false");
      });

      entry?.cells.forEach(({ row, col }) => this.cells[row][col].classList.add("is-related"));
      if (this.activeCell) this.cells[this.activeCell.row][this.activeCell.col].classList.add("is-active");

      const current = this.root.querySelector(".cw-current-clue");
      current.textContent = entry ? `${entry.number} ${entry.direction}: ${entry.clue}` : "";
    }

    enterLetter(letter) {
      if (!this.activeCell) return;
      const cell = this.cells[this.activeCell.row][this.activeCell.col];
      this.setCellValue(cell, letter);
      cell.classList.remove("is-incorrect");
      this.save();
      this.moveWithinEntry(1);
      this.testCompletion();
    }

    erase() {
      if (!this.activeCell) return;
      const cell = this.cells[this.activeCell.row][this.activeCell.col];
      if (this.getCellValue(cell)) {
        this.setCellValue(cell, "");
        cell.classList.remove("is-correct", "is-incorrect", "is-revealed");
      } else {
        this.moveWithinEntry(-1);
        const previous = this.cells[this.activeCell.row][this.activeCell.col];
        this.setCellValue(previous, "");
        previous.classList.remove("is-correct", "is-incorrect", "is-revealed");
      }
      this.save();
    }

    moveWithinEntry(offset) {
      const entry = this.activeEntry();
      if (!entry) return;
      const index = entry.cells.findIndex(({ row, col }) => row === this.activeCell.row && col === this.activeCell.col);
      const next = entry.cells[Math.max(0, Math.min(entry.cells.length - 1, index + offset))];
      this.selectCell(next.row, next.col, false);
    }

    moveSpatial(dr, dc) {
      if (!this.activeCell) return;
      let row = this.activeCell.row + dr;
      let col = this.activeCell.col + dc;
      while (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
        if (this.isOpen(row, col)) return this.selectCell(row, col, false);
        row += dr;
        col += dc;
      }
    }

    toggleDirection() {
      if (!this.activeCell) return;
      const other = this.direction === "across" ? "down" : "across";
      if (this.entryByCell.get(this.key(this.activeCell.row, this.activeCell.col))?.[other]) {
        this.direction = other;
        this.updateSelection();
      }
    }

    runAction(action) {
      const scope = action.split("-")[1];
      if (action.startsWith("check-")) this.check(scope);
      else if (action.startsWith("reveal-")) this.reveal(scope);
      else if (action === "reset") this.reset();
      else if (action === "close-complete") this.closeComplete();
    }

    scopedCells(scope) {
      if (scope === "puzzle") return this.openCells();
      if (scope === "word") return (this.activeEntry()?.cells || []).map(({ row, col }) => this.cells[row][col]);
      return this.activeCell ? [this.cells[this.activeCell.row][this.activeCell.col]] : [];
    }

    check(scope) {
      let wrong = 0;
      this.scopedCells(scope).forEach((cell) => {
        const value = this.getCellValue(cell);
        if (!value) return;
        const correct = value === this.solutionAt(cell);
        cell.classList.toggle("is-correct", correct);
        cell.classList.toggle("is-incorrect", !correct);
        if (!correct) wrong += 1;
      });
      this.announce(wrong ? `${wrong} incorrect ${wrong === 1 ? "letter" : "letters"}.` : "No errors found in filled cells.");
      this.testCompletion();
    }

    reveal(scope) {
      const label = scope === "puzzle" ? "the entire puzzle" : `this ${scope}`;
      if (!window.confirm(`Reveal ${label}?`)) return;
      this.scopedCells(scope).forEach((cell) => {
        this.setCellValue(cell, this.solutionAt(cell));
        cell.classList.remove("is-correct", "is-incorrect");
        cell.classList.add("is-revealed");
      });
      this.save();
      this.announce(`${scope[0].toUpperCase() + scope.slice(1)} revealed.`);
      this.testCompletion();
    }

    reset() {
      if (!window.confirm("Clear all letters and restart this puzzle?")) return;
      this.openCells().forEach((cell) => {
        this.setCellValue(cell, "");
        cell.classList.remove("is-correct", "is-incorrect", "is-revealed");
      });
      localStorage.removeItem(this.storageKey);
      this.completed = false;
      this.selectFirstCell();
      this.announce("Puzzle reset.");
    }

    testCompletion() {
      const solved = this.openCells().every((cell) => this.getCellValue(cell) === this.solutionAt(cell));
      if (!solved || this.completed) return;
      this.completed = true;
      this.save();
      const modal = this.root.querySelector(".cw-complete");
      modal.hidden = false;
      modal.querySelector("button").focus();
      this.root.dispatchEvent(new CustomEvent("crossword:complete", {
        bubbles: true,
        detail: { id: this.puzzle.id, title: this.puzzle.title },
      }));
    }

    closeComplete() {
      this.root.querySelector(".cw-complete").hidden = true;
      if (this.activeCell) this.cells[this.activeCell.row][this.activeCell.col].focus();
    }

    openCells() {
      return this.cells.flat().filter((cell) => cell?.tagName === "BUTTON");
    }

    solutionAt(cell) {
      return this.puzzle.solution[Number(cell.dataset.row)][Number(cell.dataset.col)];
    }

    getCellValue(cell) {
      return cell.querySelector(".cw-letter")?.textContent || "";
    }

    setCellValue(cell, value) {
      cell.querySelector(".cw-letter").textContent = value;
      const row = Number(cell.dataset.row) + 1;
      const col = Number(cell.dataset.col) + 1;
      cell.setAttribute("aria-label", `Row ${row}, column ${col}, ${value || "empty"}`);
    }

    save() {
      const letters = this.openCells().map((cell) => ({
        row: Number(cell.dataset.row),
        col: Number(cell.dataset.col),
        value: this.getCellValue(cell),
        revealed: cell.classList.contains("is-revealed"),
      }));
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({ letters, completed: this.completed }));
      } catch (_) { /* Progress saving is optional. */ }
    }

    restore() {
      try {
        const saved = JSON.parse(localStorage.getItem(this.storageKey));
        if (!saved?.letters) return;
        saved.letters.forEach(({ row, col, value, revealed }) => {
          if (!this.isOpen(row, col)) return;
          this.setCellValue(this.cells[row][col], value || "");
          this.cells[row][col].classList.toggle("is-revealed", Boolean(revealed));
        });
        this.completed = Boolean(saved.completed);
      } catch (_) { /* Ignore malformed or unavailable saved data. */ }
    }

    announce(message) {
      this.root.querySelector(".cw-status").textContent = message;
    }

    escape(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }

  async function initialize(root) {
    try {
      let puzzle;
      if (root.dataset.crosswordCms === "true") {
        puzzle = puzzleFromCMS(root);
      } else if (root.dataset.crosswordSrc) {
        const response = await fetch(root.dataset.crosswordSrc, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`Puzzle request failed (${response.status}).`);
        puzzle = await response.json();
      } else {
        const data = root.querySelector('script[type="application/json"]');
        if (!data) throw new Error("Add data-crossword-src or embedded puzzle JSON.");
        puzzle = JSON.parse(data.textContent);
      }
      new CrosswordPlayer(root, puzzle);
    } catch (error) {
      root.classList.add("cw-error");
      root.textContent = "This crossword could not be loaded.";
      console.error("Crossword:", error);
    }
  }

  function boot() {
    document.querySelectorAll(".crossword:not([data-crossword-ready])").forEach((root) => {
      root.dataset.crosswordReady = "true";
      initialize(root);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.CrosswordPlayer = CrosswordPlayer;
  window.initializeCrosswords = boot;
})();
