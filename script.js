 const firebaseConfig = {
    apiKey: "AIzaSyC92VIzjNXjPHNQDC6JqblcNUcE0PJBIRk",
    authDomain: "four-player-chess.firebaseapp.com",
    projectId: "four-player-chess",
    storageBucket: "four-player-chess.firebasestorage.app",
    messagingSenderId: "643436972189",
    appId: "1:643436972189:web:1a035f62019b8302a5ac74",
    measurementId: "G-S1C4GPJFXT"
  };

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================
// 4-PLAYER TEAM CHESS ENGINE (COMPLETE)
// ============================================
class MultiKingChess {
    constructor() {
        this.board = this.getInitialBoard();
        this.ownership = this.getInitialOwnership();
        this.currentTurn = 'white'; // white, black, gold, silver
        this.moveHistory = [];
        this.gameOver = false;
        this.winner = null; // 'A' or 'B'
        this.eliminated = { white: false, gold: false, black: false, silver: false };
    }

    // ---------- Initial board (exact layout) ----------
    getInitialBoard() {
        // 8x8 array, rows 0=rank8 ... 7=rank1
        return [
            // rank 8 (white back rank)
            [{type:'k', color:'w'}, {type:'r', color:'w'}, {type:'p', color:'w'}, null, null, {type:'p', color:'w'}, {type:'r', color:'w'}, {type:'k', color:'w'}],
            // rank 7
            [{type:'q', color:'w'}, {type:'p', color:'w'}, {type:'n', color:'w'}, null, null, {type:'n', color:'w'}, {type:'p', color:'w'}, {type:'q', color:'w'}],
            // rank 6
            [{type:'p', color:'w'}, {type:'n', color:'w'}, {type:'b', color:'w'}, null, null, {type:'b', color:'w'}, {type:'n', color:'w'}, {type:'p', color:'w'}],
            // rank 5 (empty)
            [null, null, null, null, null, null, null, null],
            // rank 4 (empty)
            [null, null, null, null, null, null, null, null],
            // rank 3 (black)
            [{type:'p', color:'b'}, {type:'n', color:'b'}, {type:'b', color:'b'}, null, null, {type:'b', color:'b'}, {type:'n', color:'b'}, {type:'p', color:'b'}],
            // rank 2
            [{type:'q', color:'b'}, {type:'p', color:'b'}, {type:'n', color:'b'}, null, null, {type:'n', color:'b'}, {type:'p', color:'b'}, {type:'q', color:'b'}],
            // rank 1 (black back rank)
            [{type:'k', color:'b'}, {type:'r', color:'b'}, {type:'p', color:'b'}, null, null, {type:'p', color:'b'}, {type:'r', color:'b'}, {type:'k', color:'b'}]
        ];
    }

    getInitialOwnership() {
        const own = {};
        // White team: white (left cluster) and gold (right cluster)
        // white: files a-c (cols 0-2) on ranks 6-8 (rows 0-2)
        // gold: files f-h (cols 5-7) on ranks 6-8
        // Black team: black (left cluster) and silver (right cluster) on ranks 1-3 (rows 5-7)
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = this.indicesToSquare(r, c);
                if (this.board[r][c]) {
                    if (this.board[r][c].color === 'w') {
                        if (c <= 2) own[sq] = 'white';
                        else if (c >= 5) own[sq] = 'gold';
                        else own[sq] = null; // center files empty
                    } else { // black
                        if (c <= 2) own[sq] = 'black';
                        else if (c >= 5) own[sq] = 'silver';
                        else own[sq] = null;
                    }
                } else {
                    own[sq] = null;
                }
            }
        }
        return own;
    }

    // ---------- Helpers ----------
    squareToIndices(sq) {
        const file = sq.charCodeAt(0) - 97;
        const rank = 8 - parseInt(sq[1]);
        return { row: rank, col: file };
    }
    indicesToSquare(row, col) {
        const file = String.fromCharCode(97 + col);
        const rank = 8 - row;
        return file + rank;
    }
    getPiece(sq) {
        const { row, col } = this.squareToIndices(sq);
        return this.board[row][col];
    }
    setPiece(sq, piece) {
        const { row, col } = this.squareToIndices(sq);
        this.board[row][col] = piece;
    }

    // ---------- Find all kings of a given color ----------
    findKings(color) {
        const kings = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.type === 'k' && piece.color === color) {
                    kings.push(this.indicesToSquare(r, c));
                }
            }
        }
        return kings;
    }

    // ---------- Check if a square is attacked by opponent (ignoring dead pieces) ----------
    isSquareAttacked(sq, attackingColor) {
        const { row, col } = this.squareToIndices(sq);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (!piece || piece.color !== attackingColor) continue;
                const owner = this.ownership[this.indicesToSquare(r, c)];
                if (owner && this.eliminated[owner]) continue; // dead piece doesn't attack
                const from = this.indicesToSquare(r, c);
                const moves = this.getPseudoMoves(from);
                if (moves.includes(sq)) return true;
            }
        }
        return false;
    }

    // ---------- Pseudo-legal moves (no check validation, no dead piece check) ----------
    getPseudoMoves(sq) {
        const piece = this.getPiece(sq);
        if (!piece) return [];
        const { row, col } = this.squareToIndices(sq);
        const moves = [];
        const color = piece.color;

        switch (piece.type) {
            case 'p': {
                const dir = (color === 'w') ? -1 : 1;
                // one step forward
                const r1 = row + dir;
                if (r1 >= 0 && r1 < 8 && !this.board[r1][col]) {
                    moves.push(this.indicesToSquare(r1, col));
                    // two steps from starting rows (white on rank6, black on rank3)
                    const r2 = row + 2*dir;
                    if ((color === 'w' && row === 2) || (color === 'b' && row === 5)) {
                        if (!this.board[r2][col] && !this.board[r1][col]) {
                            moves.push(this.indicesToSquare(r2, col));
                        }
                    }
                }
                // captures
                for (const dc of [-1, 1]) {
                    const rcap = row + dir;
                    const ccap = col + dc;
                    if (rcap >= 0 && rcap < 8 && ccap >= 0 && ccap < 8) {
                        const target = this.board[rcap][ccap];
                        if (target && target.color !== color) {
                            moves.push(this.indicesToSquare(rcap, ccap));
                        }
                    }
                }
                break;
            }
            case 'n': {
                const knightDeltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
                for (const [dr, dc] of knightDeltas) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                        const target = this.board[nr][nc];
                        if (!target || target.color !== color) {
                            moves.push(this.indicesToSquare(nr, nc));
                        }
                    }
                }
                break;
            }
            case 'b': {
                const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
                for (const [dr, dc] of dirs) {
                    for (let i = 1; i < 8; i++) {
                        const nr = row + i*dr, nc = col + i*dc;
                        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
                        const target = this.board[nr][nc];
                        if (!target) {
                            moves.push(this.indicesToSquare(nr, nc));
                        } else {
                            if (target.color !== color) moves.push(this.indicesToSquare(nr, nc));
                            break;
                        }
                    }
                }
                break;
            }
            case 'r': {
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                for (const [dr, dc] of dirs) {
                    for (let i = 1; i < 8; i++) {
                        const nr = row + i*dr, nc = col + i*dc;
                        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
                        const target = this.board[nr][nc];
                        if (!target) {
                            moves.push(this.indicesToSquare(nr, nc));
                        } else {
                            if (target.color !== color) moves.push(this.indicesToSquare(nr, nc));
                            break;
                        }
                    }
                }
                break;
            }
            case 'q': {
                const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
                for (const [dr, dc] of dirs) {
                    for (let i = 1; i < 8; i++) {
                        const nr = row + i*dr, nc = col + i*dc;
                        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
                        const target = this.board[nr][nc];
                        if (!target) {
                            moves.push(this.indicesToSquare(nr, nc));
                        } else {
                            if (target.color !== color) moves.push(this.indicesToSquare(nr, nc));
                            break;
                        }
                    }
                }
                break;
            }
            case 'k': {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = row + dr, nc = col + dc;
                        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            const target = this.board[nr][nc];
                            if (!target || target.color !== color) {
                                moves.push(this.indicesToSquare(nr, nc));
                            }
                        }
                    }
                }
                break;
            }
        }
        return moves;
    }

    // ---------- Check if a specific player is in check ----------
    isPlayerInCheck(playerId) {
        if (this.eliminated[playerId]) return false;
        const color = (playerId === 'white' || playerId === 'gold') ? 'w' : 'b';
        const kings = this.findKings(color);
        for (const kingSq of kings) {
            if (this.ownership[kingSq] === playerId) {
                if (this.isSquareAttacked(kingSq, color === 'w' ? 'b' : 'w')) return true;
            }
        }
        return false;
    }

    // ---------- Get all legal moves for a player (considering check) ----------
    getLegalMovesForPlayer(playerId) {
        if (this.eliminated[playerId]) return [];
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = this.indicesToSquare(r, c);
                if (this.ownership[sq] === playerId) {
                    const pseudo = this.getPseudoMoves(sq);
                    for (const to of pseudo) {
                        if (this.isMoveLegal(playerId, { from: sq, to })) {
                            moves.push({ from: sq, to });
                        }
                    }
                }
            }
        }
        return moves;
    }

    // ---------- Check if a specific move is legal (doesn't leave any of player's kings in check) ----------
    isMoveLegal(playerId, move) {
        const { from, to } = move;
        const piece = this.getPiece(from);
        if (!piece) return false;
        const targetPiece = this.getPiece(to);
        const targetOwner = this.ownership[to];

        // Make copies
        const boardCopy = JSON.parse(JSON.stringify(this.board));
        const ownershipCopy = { ...this.ownership };
        const { row: fromR, col: fromC } = this.squareToIndices(from);
        const { row: toR, col: toC } = this.squareToIndices(to);

        boardCopy[toR][toC] = piece;
        boardCopy[fromR][fromC] = null;
        ownershipCopy[to] = playerId;
        ownershipCopy[from] = null;

        // Create temporary game
        const temp = new MultiKingChess();
        temp.board = boardCopy;
        temp.ownership = ownershipCopy;
        temp.eliminated = { ...this.eliminated };

        // If move captures a king, mark that player as eliminated for check calculation
        if (targetPiece && targetPiece.type === 'k' && targetOwner) {
            temp.eliminated[targetOwner] = true;
        }

        // Check if any of playerId's kings are in check after move
        const playerColor = (playerId === 'white' || playerId === 'gold') ? 'w' : 'b';
        const playerKings = temp.findKings(playerColor);
        for (const kingSq of playerKings) {
            if (temp.ownership[kingSq] === playerId) {
                if (temp.isSquareAttacked(kingSq, playerColor === 'w' ? 'b' : 'w')) {
                    return false;
                }
            }
        }
        return true;
    }

    // ---------- Execute a move (return true if successful) ----------
    makeMove(move, playerId) {
        if (this.gameOver) return false;
        if (this.currentTurn !== playerId) return false;
        if (this.eliminated[playerId]) return false;

        const { from, to } = move;
        if (this.ownership[from] !== playerId) return false;

        // Verify move is legal
        const legal = this.getLegalMovesForPlayer(playerId);
        if (!legal.some(m => m.from === from && m.to === to)) return false;

        const targetPiece = this.getPiece(to);
        const targetOwner = this.ownership[to];

        // If capture a king, eliminate that player immediately
        if (targetPiece && targetPiece.type === 'k' && targetOwner) {
            this.eliminated[targetOwner] = true;
        }

        // Apply move
        this.setPiece(to, this.getPiece(from));
        this.setPiece(from, null);
        this.ownership[to] = playerId;
        this.ownership[from] = null;

        // Pawn promotion (auto-queen for now; you can add a modal later)
        const piece = this.getPiece(to);
        if (piece.type === 'p') {
            const { row } = this.squareToIndices(to);
            if ((piece.color === 'w' && row === 0) || (piece.color === 'b' && row === 7)) {
                piece.type = 'q';
            }
        }

        // Record move in history
        this.moveHistory.push({
            from, to,
            player: playerId,
            piece: piece.type,
            captured: targetPiece ? targetPiece.type : null
        });

        // Advance turn
        this.advanceTurn();

        // Check game over (all players of one team eliminated)
        const teamA = ['white', 'gold'];
        const teamB = ['black', 'silver'];
        const teamADead = teamA.every(p => this.eliminated[p]);
        const teamBDead = teamB.every(p => this.eliminated[p]);
        if (teamADead) {
            this.gameOver = true;
            this.winner = 'B';
        } else if (teamBDead) {
            this.gameOver = true;
            this.winner = 'A';
        }

        return true;
    }

    // Advance to next player who is not eliminated
    advanceTurn() {
        const order = ['white', 'black', 'gold', 'silver'];
        let idx = order.indexOf(this.currentTurn);
        do {
            idx = (idx + 1) % 4;
        } while (this.eliminated[order[idx]] && !this.gameOver);
        this.currentTurn = order[idx];

        // After advancing, if the new current player is in checkmate, eliminate them immediately
        if (!this.gameOver && !this.eliminated[this.currentTurn]) {
            if (this.isPlayerInCheck(this.currentTurn) && this.getLegalMovesForPlayer(this.currentTurn).length === 0) {
                // Checkmate! Eliminate this player
                this.eliminated[this.currentTurn] = true;
                // Re-check game over
                const teamA = ['white', 'gold'];
                const teamB = ['black', 'silver'];
                const teamADead = teamA.every(p => this.eliminated[p]);
                const teamBDead = teamB.every(p => this.eliminated[p]);
                if (teamADead) {
                    this.gameOver = true;
                    this.winner = 'B';
                } else if (teamBDead) {
                    this.gameOver = true;
                    this.winner = 'A';
                } else {
                    // If game not over, advance turn again (skip eliminated player)
                    this.advanceTurn();
                }
            }
        }
    }

    // ---------- Load state from Firebase ----------
    loadState(boardArr, turn, ownershipObj, eliminatedObj) {
        this.board = JSON.parse(JSON.stringify(boardArr));
        this.currentTurn = turn;
        this.ownership = { ...ownershipObj };
        this.eliminated = { ...eliminatedObj };
        // Recompute gameOver
        const teamA = ['white', 'gold'];
        const teamB = ['black', 'silver'];
        const teamADead = teamA.every(p => this.eliminated[p]);
        const teamBDead = teamB.every(p => this.eliminated[p]);
        if (teamADead) {
            this.gameOver = true;
            this.winner = 'B';
        } else if (teamBDead) {
            this.gameOver = true;
            this.winner = 'A';
        } else {
            this.gameOver = false;
            this.winner = null;
        }
    }

    // ---------- For chessboard.js ----------
    getBoardPosition() {
        const pos = {};
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece) {
                    const sq = this.indicesToSquare(r, c);
                    pos[sq] = (piece.color === 'w' ? 'w' : 'b') + piece.type.toUpperCase();
                }
            }
        }
        return pos;
    }

    getMoveList() {
        return this.moveHistory.map((m, i) =>
            `${i+1}. ${m.player}: ${m.from}-${m.to}${m.captured ? 'x' : ''}`
        );
    }
}

// ============================================
// GLOBAL VARIABLES & UI SETUP
// ============================================
var board = null;
var game = new MultiKingChess();
var myPlayerId = null;
var myRole = null;          // 'white','gold','black','silver'
var roomID = null;
var highlightEnabled = true;
var currentMoveIndex = -1;
var gameHistory = [];
var isGameOver = false;

// ---------- UI Helpers ----------
function removeGreyDots() { $('#board .square-55d63 .dot').remove(); }
function greyDot(sq) { $('#board .square-' + sq).append('<span class="dot"></span>'); }

function onMouseoverSquare(sq, piece) {
    if (!piece || isGameOver) return;
    if (game.ownership[sq] !== myRole) return;
    if (game.currentTurn !== myRole) return;
    if (game.eliminated[myRole]) return;
    const moves = game.getPseudoMoves(sq);
    for (let m of moves) greyDot(m);
}
function onMouseoutSquare() { removeGreyDots(); }

function onDragStart(source, piece, position, orientation) {
    if (isGameOver) return false;
    if (currentMoveIndex !== gameHistory.length - 1) return false;
    if (game.ownership[source] !== myRole) return false;
    if (game.currentTurn !== myRole) return false;
    if (game.eliminated[myRole]) return false;
    return true;
}

function onDrop(source, target) {
    const gameRef = database.ref('rooms/' + roomID + '/game');
    gameRef.transaction((current) => {
        if (!current) return current;
        const temp = new MultiKingChess();
        temp.loadState(current.board, current.turn, current.ownership, current.eliminated);
        if (temp.currentTurn !== myRole) return; // not my turn
        const move = { from: source, to: target };
        if (!temp.makeMove(move, myRole)) return; // illegal
        return {
            board: temp.board,
            turn: temp.currentTurn,
            ownership: temp.ownership,
            eliminated: temp.eliminated,
            history: temp.moveHistory
        };
    }, (error, committed) => {
        if (!committed || error) {
            board.position(game.getBoardPosition()); // revert
        }
    });
    return 'snapback'; // immediate visual feedback
}
function onSnapEnd() { /* board updated by listener */ }

// Initialize board
var config = {
    draggable: true,
    position: 'start',
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    onMouseoverSquare: onMouseoverSquare,
    onMouseoutSquare: onMouseoutSquare
};
board = Chessboard('board', config);

// ---------- Navigation & Controls ----------
function prevMove() {
    if (currentMoveIndex > 0) {
        currentMoveIndex--;
        const state = gameHistory[currentMoveIndex];
        game.loadState(state.board, state.turn, state.ownership, state.eliminated);
        board.position(game.getBoardPosition());
        updateGameState();
    }
}
function nextMove() {
    if (currentMoveIndex < gameHistory.length - 1) {
        currentMoveIndex++;
        const state = gameHistory[currentMoveIndex];
        game.loadState(state.board, state.turn, state.ownership, state.eliminated);
        board.position(game.getBoardPosition());
        updateGameState();
    }
}
function flipBoard() { board.flip(); }
function resignGame() {
    if (!roomID || isGameOver) return;
    if (confirm("Resign the game?")) {
        database.ref('rooms/' + roomID + '/status').set({ type: 'resign', by: myRole });
    }
}
function offerDraw() {
    if (!roomID || isGameOver) return;
    database.ref('rooms/' + roomID + '/status').set({ type: 'drawOffer', by: myRole });
    alert("Draw offer sent.");
}
function handleDraw(accepted) {
    document.getElementById('draw-offer-area').style.display = 'none';
    if (accepted) {
        database.ref('rooms/' + roomID + '/status').set({ type: 'drawAccepted' });
    } else {
        database.ref('rooms/' + roomID + '/status').set({ type: 'drawDeclined', by: myRole });
    }
}

// ---------- Game State Update ----------
function updateGameState() {
    $('.square-55d63').removeClass('highlight-check');
    if (highlightEnabled) {
        ['white','gold','black','silver'].forEach(p => {
            if (!game.eliminated[p] && game.isPlayerInCheck(p)) {
                const color = (p === 'white' || p === 'gold') ? 'w' : 'b';
                const kings = game.findKings(color);
                kings.forEach(k => {
                    if (game.ownership[k] === p) {
                        $('.square-' + k).addClass('highlight-check');
                    }
                });
            }
        });
    }
    if (game.gameOver) showGameOver('checkmate', game.winner);
    updateMoveList();

    // Save history
    const state = {
        board: JSON.parse(JSON.stringify(game.board)),
        turn: game.currentTurn,
        ownership: { ...game.ownership },
        eliminated: { ...game.eliminated }
    };
    if (gameHistory.length === 0 ||
        JSON.stringify(gameHistory[gameHistory.length-1].board) !== JSON.stringify(game.board)) {
        gameHistory.push(state);
        currentMoveIndex = gameHistory.length - 1;
    }

    // Update status line
    const status = document.getElementById('status');
    const names = { white: 'White', gold: 'Gold', black: 'Black', silver: 'Silver' };
    status.innerHTML = `Turn: ${names[game.currentTurn]}`;
}

function updateMoveList() {
    const list = document.getElementById('move-list');
    list.innerHTML = '';
    game.getMoveList().forEach(m => {
        const div = document.createElement('div');
        div.innerText = m;
        list.appendChild(div);
    });
    list.scrollTop = list.scrollHeight;
}

function showGameOver(type, winner) {
    isGameOver = true;
    let winText = "Draw", reason = "Game ended.";
    if (type === 'resign') {
        winText = (winner === 'A' ? "Team A Wins!" : "Team B Wins!");
        reason = "Opponent resigned.";
    } else if (type === 'draw') {
        reason = "Draw by agreement.";
    } else if (type === 'checkmate') {
        winText = (winner === 'A' ? "Team A Wins!" : "Team B Wins!");
        reason = "All enemy kings captured!";
    }
    document.getElementById('winner-text').innerText = winText;
    document.getElementById('reason-text').innerText = reason;
    document.getElementById('game-over-modal').style.display = 'block';
}
function closeModal() { document.getElementById('game-over-modal').style.display = 'none'; }
function toggleHighlight() {
    highlightEnabled = !highlightEnabled;
    document.getElementById('highlight-toggle').innerText = highlightEnabled ? "🎯 King Highlight: ON" : "🎯 King Highlight: OFF";
    updateGameState();
}
function toggleTheme() { document.body.classList.toggle('dark-mode'); }

// ---------- Room & Chat ----------
function joinRoom(requestedColor) {
    roomID = document.getElementById('roomInput').value;
    if (!roomID) return alert("Enter Room ID");

    myPlayerId = database.ref().push().key;
    const playersRef = database.ref('rooms/' + roomID + '/players');

    playersRef.once('value', (snap) => {
        const players = snap.val() || {};
        let assigned = null;
        if (requestedColor === 'w') {
            if (!players.white) assigned = 'white';
            else if (!players.gold) assigned = 'gold';
            else { alert("White team full (White & Gold taken)."); return; }
        } else {
            if (!players.black) assigned = 'black';
            else if (!players.silver) assigned = 'silver';
            else { alert("Black team full (Black & Silver taken)."); return; }
        }

        const roleRef = database.ref('rooms/' + roomID + '/players/' + assigned);
        roleRef.transaction((current) => {
            if (current) return; // taken
            return myPlayerId;
        }, (error, committed) => {
            if (error || !committed) {
                alert("Failed to join. Try again.");
                return;
            }
            myRole = assigned;
            document.getElementById('setup-section').style.display = 'none';
            if (myRole === 'black' || myRole === 'silver') board.orientation('black');

            // Initialize game if first player
            const gameRef = database.ref('rooms/' + roomID + '/game');
            gameRef.once('value', (gsnap) => {
                if (!gsnap.exists()) {
                    const initial = new MultiKingChess();
                    gameRef.set({
                        board: initial.board,
                        turn: initial.currentTurn,
                        ownership: initial.ownership,
                        eliminated: initial.eliminated,
                        history: []
                    });
                }
            });

            // Listeners
            gameRef.on('value', (snap) => {
                const data = snap.val();
                if (data) {
                    game.loadState(data.board, data.turn, data.ownership, data.eliminated);
                    board.position(game.getBoardPosition());
                    updateGameState();
                }
            });

            playersRef.on('value', (snap) => {
                const p = snap.val() || {};
                const status = document.getElementById('status');
                status.innerHTML = `White:${p.white?'●':'○'} Gold:${p.gold?'●':'○'} | Black:${p.black?'●':'○'} Silver:${p.silver?'●':'○'} – Turn: ...`;
            });

            database.ref('rooms/' + roomID + '/status').on('value', (snap) => {
                const data = snap.val();
                if (!data) return;
                if (data.type === 'resign') showGameOver('resign', (data.by === 'white'||data.by==='gold') ? 'B' : 'A');
                if (data.type === 'drawOffer' && data.by !== myRole) {
                    document.getElementById('draw-offer-area').style.display = 'block';
                }
                if (data.type === 'drawAccepted') showGameOver('draw');
                if (data.type === 'drawDeclined' && data.by !== myRole) alert("Draw declined.");
            });

            // Public chat
            database.ref('rooms/' + roomID + '/chat').on('child_added', (snap) => {
                const msg = snap.val();
                displayMessage(msg.user, msg.text, 'public');
            });

            // Team chat
            const team = (myRole === 'white' || myRole === 'gold') ? 'teamA' : 'teamB';
            database.ref('rooms/' + roomID + '/teamChat/' + team).on('child_added', (snap) => {
                const msg = snap.val();
                displayMessage(msg.user, msg.text, 'team');
            });

            roleRef.onDisconnect().remove();
        });
    });
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input.value.trim() || !roomID) return;
    database.ref('rooms/' + roomID + '/chat').push({
        user: myRole,
        text: input.value
    });
    input.value = '';
}

function sendTeamMessage() {
    const input = document.getElementById('teamChatInput');
    if (!input.value.trim() || !roomID) return;
    const team = (myRole === 'white' || myRole === 'gold') ? 'teamA' : 'teamB';
    database.ref('rooms/' + roomID + '/teamChat/' + team).push({
        user: myRole,
        text: input.value
    });
    input.value = '';
}

function displayMessage(user, text, type) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const prefix = (type === 'team') ? '🔒 ' : '';
    div.innerHTML = `<b>${prefix}${user}:</b> ${text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// Enter key handlers
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
document.getElementById('teamChatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTeamMessage();
});
