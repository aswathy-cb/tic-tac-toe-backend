#!/bin/bash
go build --trimpath --mod=mod --buildmode=plugin -o tictactoe.so *.go
