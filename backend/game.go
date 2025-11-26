package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/heroiclabs/nakama-common/runtime"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Game struct (in-memory)
type Game struct {
	ID     string `json:"game_id"`
	Board  string `json:"board"`  // 9-char string: "-" for empty, "X" or "O"
	Turn   string `json:"turn"`   // "X" or "O"
	Winner string `json:"winner"` // "", "X", "O", "draw"
}

var (
	gamesMu sync.RWMutex
	games   = map[string]*Game{}
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// helper: create empty board "---------"
func newBoard() string {
	return "---------"
}

// helper: generate simple id
func genID() string {
	return fmt.Sprintf("g-%d", rand.Intn(1000000))
}

// createGameRPC: create a new game and return payload as JSON string
func createGameRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	id := genID()
	game := &Game{
		ID:     id,
		Board:  newBoard(),
		Turn:   "X",
		Winner: "",
	}

	gamesMu.Lock()
	games[id] = game
	gamesMu.Unlock()

	resp := map[string]interface{}{
		"ok":      true,
		"game_id": game.ID,
		"board":   game.Board,
		"turn":    game.Turn,
	}
	b, _ := json.Marshal(resp)
	// Nakama RPC expects us to return a string; we'll return the JSON object as a string.
	return string(b), nil
}

// makeMoveRPC: expects payload to be a JSON string (string content) containing {"game_id":"...","cell":index}
func makeMoveRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	// payload arrives as a string (e.g. "{\"game_id\":\"g-123\",\"cell\":4}")
	// First parse payload string into an object
	var in map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &in); err != nil {
		// If payload is itself already the JSON object string (escaped), try un-quoting
		// but in our front-end we'll send properly, so this should be fine
		return "", errors.New("invalid payload JSON")
	}

	gidRaw, ok := in["game_id"]
	if !ok {
		return "", errors.New("missing game_id")
	}
	gid := fmt.Sprintf("%v", gidRaw)

	cellF, ok := in["cell"]
	if !ok {
		return "", errors.New("missing cell")
	}

	// cell could be float64 (from json.Number), convert to int
	cell := 0
	switch v := cellF.(type) {
	case float64:
		cell = int(v)
	case int:
		cell = v
	case string:
		n, _ := strconv.Atoi(v)
		cell = n
	default:
		return "", errors.New("invalid cell index")
	}
	if cell < 0 || cell > 8 {
		return "", errors.New("cell index out of range")
	}

	// find game
	gamesMu.Lock()
	game, exists := games[gid]
	if !exists {
		gamesMu.Unlock()
		return "", errors.New("game not found")
	}

	// if already finished:
	if game.Winner != "" {
		gamesMu.Unlock()
		return "", errors.New("game already finished")
	}

	// check board
	if game.Board[cell] != '-' {
		gamesMu.Unlock()
		return "", errors.New("cell already occupied")
	}

	// apply move
	boardRunes := []rune(game.Board)
	boardRunes[cell] = rune(game.Turn[0]) // 'X' or 'O'
	game.Board = string(boardRunes)

	// check winner
	if winner := checkWinner(game.Board); winner != "" {
		game.Winner = winner
	} else if !strings.Contains(game.Board, "-") {
		game.Winner = "draw"
	} else {
		// switch turn
		if game.Turn == "X" {
			game.Turn = "O"
		} else {
			game.Turn = "X"
		}
	}

	// persist back
	games[gid] = game
	gamesMu.Unlock()

	resp := map[string]interface{}{
		"ok":     true,
		"game":   game,
		"board":  game.Board,
		"turn":   game.Turn,
		"winner": game.Winner,
	}
	b, _ := json.Marshal(resp)
	return string(b), nil
}

// getGameRPC: return game by id, expects payload string like {"game_id":"..."}
func getGameRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var in map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &in); err != nil {
		return "", errors.New("invalid payload JSON")
	}
	gidRaw, ok := in["game_id"]
	if !ok {
		return "", errors.New("missing game_id")
	}
	gid := fmt.Sprintf("%v", gidRaw)

	gamesMu.RLock()
	game, exists := games[gid]
	gamesMu.RUnlock()
	if !exists {
		return "", errors.New("game not found")
	}
	resp := map[string]interface{}{
		"ok":   true,
		"game": game,
	}
	b, _ := json.Marshal(resp)
	return string(b), nil
}

// checkWinner: returns "X", "O", "" for none
func checkWinner(board string) string {
	winLines := [8][3]int{
		{0, 1, 2},
		{3, 4, 5},
		{6, 7, 8},
		{0, 3, 6},
		{1, 4, 7},
		{2, 5, 8},
		{0, 4, 8},
		{2, 4, 6},
	}
	for _, w := range winLines {
		a := board[w[0]]
		b := board[w[1]]
		c := board[w[2]]
		if a != '-' && a == b && b == c {
			return string(a)
		}
	}
	return ""
}
