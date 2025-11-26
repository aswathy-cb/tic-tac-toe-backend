// Robust script.js — replaces previous script. Handles double-encoded and normal JSON responses,
// ensures token retrieval, updates Game ID on page and shows clear error messages in console/alerts.

const SERVER = "http://localhost:7350";
const BASIC = "Basic ZGVmYXVsdGtleTo=";

let token = "";
let gameId = null;
let currentBoard = Array(9).fill("-");
let currentTurn = "X";
let gameFinished = false;

// DOM refs (safe access)
const cells = document.querySelectorAll(".cell");
const turnLabel = document.getElementById("turnLabel");
const gameIdText = document.getElementById("gameId");
const createBtn = document.getElementById("createBtn");
const resetBtn = document.getElementById("resetBtn");

// ---------- Helpers ----------
function safeLog(...args) { try { console.log(...args); } catch(e){} }
function showError(msg, err) {
  console.error(msg, err);
  // minimal user alert for critical failures
  // avoid spamming alerts on recoverable errors
  // alert(msg + (err ? (": " + (err.message || err)) : ""));
}

// ---------- Token ----------
async function getToken() {
  if (token) return token;
  try {
    safeLog("Requesting device token...");
    const r = await fetch(SERVER + "/v2/account/authenticate/device?create=true", {
      method: "POST",
      headers: { "Authorization": BASIC, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "device_" + Date.now() })
    });
    if (!r.ok) {
      const text = await r.text();
      showError("Token request failed (non-OK). Response:", text);
      return "";
    }
    const j = await r.json();
    token = j.token || "";
    safeLog("Token obtained:", !!token);
    return token;
  } catch (e) {
    showError("Token fetch error", e);
    return "";
  }
}

// ---------- Parse payload function (handles different shapes) ----------
function extractPayload(res) {
  if (!res) return null;
  try {
    if (typeof res === "string") {
      // sometimes server returns raw string
      try { return JSON.parse(res); } catch(e) { return res; }
    }
    if (res.payload) {
      // payload often is a JSON-string: try parse, otherwise return raw
      try {
        return JSON.parse(res.payload);
      } catch (e) {
        return res.payload;
      }
    }
    // maybe server returned an object directly
    return res;
  } catch (e) {
    showError("extractPayload error", e);
    return null;
  }
}

// ---------- Update UI ----------
function updateBoardUI() {
  cells.forEach((cell, i) => {
    const display = currentBoard[i] === "-" ? "" : currentBoard[i];
    cell.textContent = display;
    cell.classList.remove("X", "O");
    if (display === "X") cell.classList.add("X");
    if (display === "O") cell.classList.add("O");
  });
}

function updateTurnLabel() {
  if (!gameFinished) {
    turnLabel.innerText = "Turn: " + currentTurn;
    turnLabel.style.color = "#ffffff";
    turnLabel.style.fontSize = "20px";
  }
}

function setGameIdOnPage(id) {
  if (!gameIdText) return;
  gameIdText.innerText = id || "—";
}

// ---------- RPC helpers ----------
async function postRpcDoubleEncoded(rpcName, payloadObj) {
  // double-encoded: body is JSON.stringify(JSON.stringify(payloadObj))
  const raw = JSON.stringify(payloadObj);
  const body = JSON.stringify(raw);
  const res = await fetch(SERVER + "/v2/rpc/" + rpcName, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body
  });
  return res;
}
async function postRpcNormal(rpcName, payloadObj) {
  const res = await fetch(SERVER + "/v2/rpc/" + rpcName, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payloadObj)
  });
  return res;
}

// Try double-encoded first, fall back to normal if necessary
async function callRpcWithFallback(rpcName, payloadObj = {}) {
  await getToken();
  // Try double-encoded
  try {
    safeLog("RPC double-encoded attempt:", rpcName, payloadObj);
    const r = await postRpcDoubleEncoded(rpcName, payloadObj);
    const text = await r.text();
    // try parse JSON
    try {
      const json = JSON.parse(text);
      return json;
    } catch (e) {
      // not JSON - try normal fallback
      safeLog("Double-encoded returned non-JSON, trying normal encoding...");
    }
  } catch (e) {
    safeLog("Double-encoded RPC failed, will try normal:", e);
  }

  // Fallback: normal encoding
  try {
    safeLog("RPC normal attempt:", rpcName, payloadObj);
    const r2 = await postRpcNormal(rpcName, payloadObj);
    const j2 = await r2.json();
    return j2;
  } catch (e) {
    showError("Both RPC attempts failed for " + rpcName, e);
    return null;
  }
}

// ---------- Create Game (robust) ----------
async function createGame() {
  try {
    // ensure token
    await getToken();

    // call rpc (handles both server styles)
    const res = await callRpcWithFallback("create_game", {});
    if (!res) {
      alert("Create Game failed: no response. Check console for details.");
      return;
    }

    const payload = extractPayload(res);
    if (!payload) {
      alert("Create Game failed: unexpected response. See console.");
      safeLog("create_game raw response:", res);
      return;
    }

    // extract fields robustly
    const gid = payload.game_id || (payload.game && (payload.game.ID || payload.game.game_id)) || null;
    const board = payload.board || (payload.game && payload.game.Board) || "---------";
    const turn = payload.turn || (payload.game && payload.game.Turn) || "X";

    gameId = gid;
    currentBoard = board.split("").map(ch => ch === "-" ? "-" : ch);
    currentTurn = turn;
    gameFinished = false;

    updateBoardUI();
    updateTurnLabel();
    setGameIdOnPage(gameId);

    // feedback
    alert("🎮 Game Created!\nGame ID: " + (gameId || "—"));
    safeLog("create_game payload:", payload);
  } catch (e) {
    showError("createGame error", e);
    alert("Create Game failed. See console.");
  }
}

// ---------- Make Move (robust) ----------
async function makeMove(index) {
  try {
    if (!gameId) { alert("Create a game first"); return; }
    if (gameFinished) return;
    if (currentBoard[index] !== "-") return;

    const res = await callRpcWithFallback("make_move", { game_id: gameId, cell: index });
    if (!res) { showError("make_move: no response"); return; }

    const payload = extractPayload(res);
    if (!payload) { safeLog("make_move raw:", res); return; }

    const boardStr = payload.board || (payload.game && payload.game.Board);
    const winner = payload.winner || (payload.game && payload.game.Winner) || "";
    const turn = payload.turn || (payload.game && payload.game.Turn) || currentTurn;

    if (boardStr) currentBoard = boardStr.split("").map(ch => ch === "-" ? "-" : ch);
    currentTurn = turn;

    if (winner) {
      gameFinished = true;
      updateBoardUI();
      // celebration
      turnLabel.style.color = "#00ff90";
      turnLabel.style.fontSize = "20px";
      turnLabel.innerText = "🎉 Winner: " + winner + " 🎉";
      safeLog("Winner:", winner);
      return;
    }

    // local draw detection if needed
    if (boardStr && !boardStr.includes("-")) {
      gameFinished = true;
      updateBoardUI();
      turnLabel.style.color = "#ffd580";
      turnLabel.innerText = "Draw 🤝";
      return;
    }

    updateBoardUI();
    updateTurnLabel();

  } catch (e) {
    showError("makeMove error", e);
  }
}

// ---------- Reset ----------
function resetBoard() {
  currentBoard = Array(9).fill("-");
  currentTurn = "X";
  gameFinished = false;
  updateBoardUI();
  updateTurnLabel();
  // keep gameId visible in page; if you want to clear it, uncomment next line:
  // setGameIdOnPage(null);
}

// ---------- Attach listeners (safe: after DOM loaded) ----------
function attachListeners() {
  cells.forEach((cell, i) => {
    cell.removeEventListener("click", () => makeMove(i)); // harmless; ensures no duplicates
    cell.addEventListener("click", () => makeMove(i));
  });
  if (createBtn) {
    createBtn.removeEventListener("click", createGame);
    createBtn.addEventListener("click", createGame);
  }
  if (resetBtn) {
    resetBtn.removeEventListener("click", resetBoard);
    resetBtn.addEventListener("click", resetBoard);
  }
}

// ---------- Init ----------
(async function init() {
  try {
    attachListeners();
    // initial board and UI
    currentBoard = Array(9).fill("-");
    updateBoardUI();
    updateTurnLabel();
    setGameIdOnPage(null);
    // pre-get token asynchronously (not required but helpful)
    getToken().then(() => safeLog("Token prefetched"));
  } catch (e) {
    showError("Init error", e);
  }
})();
