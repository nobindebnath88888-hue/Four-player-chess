 const firebaseConfig = {
    apiKey: "AIzaSyC92VIzjNXjPHNQDC6JqblcNUcE0PJBIRk",
    authDomain: "four-player-chess.firebaseapp.com",
    projectId: "four-player-chess",
    storageBucket: "four-player-chess.firebasestorage.app",
    messagingSenderId: "643436972189",
    appId: "1:643436972189:web:1a035f62019b8302a5ac74",
    measurementId: "G-S1C4GPJFXT"
  };


firebase.initializeApp(firebaseConfig);
const database = firebase.database();

var board = null;
var game = new Chess();
var myColor = null; 
var myTeam = null;  
var roomID = null;
var turnOrder = ['w', 'b', 'g', 's']; 
var currentTurnIndex = 0;

// Mirrored Analytical Layout
const customStartPos = "krrp2prr/qpn2npq/pnb2bnp/8/8/PNB2BNP/QPN2NPQ/KRRP2PRR w - - 0 1";

// 2. GAME LOGIC
function onDragStart (source, piece, position, orientation) {
    if (game.game_over()) return false;
    
    // Check if it's the player's actual turn
    if (myColor !== turnOrder[currentTurnIndex]) return false;

    // Team piece check (White/Gold are Team A, Black/Silver are Team B)
    if (myTeam === 'A' && piece.search(/^b/) !== -1) return false;
    if (myTeam === 'B' && piece.search(/^w/) !== -1) return false;
}

function onDrop (source, target) {
    const targetPiece = game.get(target);
    if (targetPiece) {
        // Prevent teammate capture
        const targetIsWhiteSide = targetPiece.color === 'w';
        if (myTeam === 'A' && targetIsWhiteSide) return 'snapback';
        if (myTeam === 'B' && !targetIsWhiteSide) return 'snapback';
    }

    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    // Move turn index forward
    currentTurnIndex = (currentTurnIndex + 1) % 4;

    // Push to Firebase
    database.ref('rooms/' + roomID + '/game').set({
        fen: game.fen(),
        turnIndex: currentTurnIndex
    });
}

function onSnapEnd () { board.position(game.fen()); }

// 3. ROOM & COMMUNICATION
function joinRoom(color) {
    roomID = document.getElementById('roomInput').value;
    if (!roomID) return alert("Enter Room ID first!");

    myColor = color;
    myTeam = (color === 'w' || color === 'g') ? 'A' : 'B';
    document.getElementById('setup-section').style.display = 'none';
    if(myTeam === 'B') board.flip();

    // Database Connection
    database.ref('rooms/' + roomID + '/game').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            game.load(data.fen);
            currentTurnIndex = data.turnIndex;
            board.position(data.fen);
            document.getElementById('status').innerText = `Turn: ${getPlayerName(turnOrder[currentTurnIndex])}`;
        } else {
            // First person initializes
            database.ref('rooms/' + roomID + '/game').set({ fen: customStartPos, turnIndex: 0 });
        }
    });

    // Public Chat
    database.ref('rooms/' + roomID + '/chat/global').on('child_added', (snapshot) => {
        const msg = snapshot.val();
        displayMessage('chat-messages', msg.user, msg.text);
    });

    // Private Team Chat
    database.ref('rooms/' + roomID + '/chat/team_' + myTeam).on('child_added', (snapshot) => {
        const msg = snapshot.val();
        displayMessage('team-messages', "Partner", msg.text);
    });
}

function sendMessage(type) {
    const inputId = type === 'global' ? 'chatInput' : 'teamInput';
    const input = document.getElementById(inputId);
    const path = type === 'global' ? 'global' : 'team_' + myTeam;
    
    if (!input.value.trim() || !roomID) return;

    database.ref('rooms/' + roomID + '/chat/' + path).push({
        user: getPlayerName(myColor),
        text: input.value
    });
    input.value = '';
}

function getPlayerName(code) {
    return { 'w': 'White', 'b': 'Black', 'g': 'Gold', 's': 'Silver' }[code];
}

function displayMessage(containerId, user, text) {
    const chatBox = document.getElementById(containerId);
    const div = document.createElement('div');
    div.innerHTML = `<strong>${user}:</strong> ${text}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function toggleTheme() { document.body.classList.toggle('dark-mode'); }
function flipBoard() { board.flip(); }

// 4. INIT BOARD
var config = {
    draggable: true,
    position: customStartPos,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};
board = Chessboard('board', config);
