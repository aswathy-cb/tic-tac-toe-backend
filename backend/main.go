package main

import (
	"context"
	"database/sql"
	"github.com/heroiclabs/nakama-common/runtime"
	"log"
)

func InitModule(
	ctx context.Context,
	logger runtime.Logger,
	db *sql.DB,
	nk runtime.NakamaModule,
	initializer runtime.Initializer,
) error {

	// Simple log so we know the module loaded
	logger.Info("Loading TicTacToe Module...")

	// Register RPCs. These must match the signature expected by Nakama:
	// func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error)
	if err := initializer.RegisterRpc("create_game", createGameRPC); err != nil {
		logger.Error("Unable to register create_game: %v", err)
		return err
	}
	if err := initializer.RegisterRpc("make_move", makeMoveRPC); err != nil {
		logger.Error("Unable to register make_move: %v", err)
		return err
	}
	if err := initializer.RegisterRpc("get_game", getGameRPC); err != nil {
		logger.Error("Unable to register get_game: %v", err)
		return err
	}

	logger.Info("TicTacToe RPCs registered: create_game, make_move, get_game")
	return nil
}

func main() {
	log.Println("TicTacToe module compiled.")
}
