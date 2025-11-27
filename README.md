# 🎮 Tic Tac Toe – Multiplayer (Nakama + Go + AWS Deployment)

A fully functional multiplayer Tic-Tac-Toe game built using:

- **Nakama Game Server**
- **Golang RPC plugin**
- **HTML/CSS/JavaScript frontend**
- **Docker + AWS EC2**
- **Custom RPC-based game logic**

This project is implemented as part of the **Lila Full Stack Backend Assignment**.

---

## 🚀 Live Deployment

### 🔹 Frontend (Game UI)
👉 **http://13.236.1.26/**

### 🔹 Backend API (Nakama)
👉 **http://13.236.1.26:7350/**

Both services run on an AWS EC2 Ubuntu instance.

---

## 📌 Features

- Create new multiplayer game (auto-generated Game ID)
- Make moves with server-authoritative validation
- Winner & draw detection
- Backend RPC plugin written in Golang
- Dockerized deployment (Nakama, Postgres, Redis)
- Fully hosted on AWS EC2
- Clean & responsive UI

---

## 🧩 System Architecture

```
AWS EC2
│
├── Nakama Server (port 7350)
│   ├── Redis (session cache)
│   ├── Postgres (game state storage)
│   ├── tictactoe.so (Go plugin RPC)
│   └── RPC functions:
│       • create_game
│       • make_move
│       • get_game
│
└── Web Server (Apache or Nginx, port 80)
    ├── index.html
    ├── script.js
    └── style.css
```

The frontend communicates with Nakama using REST RPC endpoints.

---

## ⚙️ RPC Endpoints

### **1️⃣ create_game**
**POST** `/v2/rpc/create_game`

Creates a new game and returns:
- `game_id`
- `board`
- `turn`

---

### **2️⃣ make_move**

**POST** `/v2/rpc/make_move`

#### Request:
```json
{
  "game_id": "xxxx",
  "cell": 4
}
```

#### Response:
- updated board  
- next turn  
- winner (if exists)

---

### **3️⃣ get_game**

**POST** `/v2/rpc/get_game`

Returns the full game state.

---

## 🏗️ Local Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/aswathy-cb/tic-tac-toe-backend.git
cd tic-tac-toe-backend
```

---

### 2. Start Nakama + Postgres + Redis
```bash
sudo docker compose up -d
```

---

### 3. Build the Go plugin
```bash
docker run --rm -v $(pwd)/backend:/workspace -w /workspace \
heroiclabs/nakama-pluginbuilder:3.17.0 \
go build --trimpath --buildmode=plugin -o tictactoe.so *.go
```

---

### 4. Copy plugin into Nakama
```bash
docker cp tictactoe.so tic-tac-toe-backend_nakama_1:/nakama/data/modules/
docker restart tic-tac-toe-backend_nakama_1
```

---

## 🟣 Frontend (Local)

Serve frontend files using a simple HTTP server:

```bash
cd frontend
python3 -m http.server 8000
```

Visit:

```
http://localhost:8000
```

Update `script.js` for local testing:

```
const SERVER = "http://localhost:7350";
```

---

## ☁️ AWS Deployment Summary

1. Launch EC2 Ubuntu instance  
2. Install Docker + docker compose  
3. Clone repository to server  
4. Run `docker compose up -d`  
5. Build plugin using plugin builder  
6. Place `tictactoe.so` inside `/nakama/data/modules/`  
7. Restart Nakama container  
8. Copy frontend files to `/var/www/html`  
9. Ensure inbound rules allow ports **80** and **7350**  

---

## 🧪 How to Play

1. Open: **http://13.236.1.26/**
2. Click **Create Game**
3. A Game ID is generated
4. Open the same link in another browser/incognito
5. Enter Game ID or simply make moves (turn-based)
6. Winner/draw is displayed automatically
7. Game state updates via backend RPC calls

---

## 📁 Folder Structure

```
tic-tac-toe-backend/
│
├── backend/
│   ├── main.go
│   ├── game.go
│   ├── test.go
│   ├── go.mod
│   └── modules/
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── docker-compose.yml
├── local.yml
└── README.md
```

---

## 👩‍💻 Author

**Aswathy C B**

GitHub: https://github.com/aswathy-cb

