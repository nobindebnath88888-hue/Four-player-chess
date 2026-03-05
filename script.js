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
var isGameOver = false;

const customStartPos = "krrp2prr/qpn2npq/pnb2bnp/8/8/PNB2BNP/QPN2NPQ/KRRP2PRR w - - 0 1";

function onDragStart (source, piece, position, orientation) {
    if (isGameOver) return false;
    if (myColor !== turnOrder[currentTurnIndex]) return false;
    if (myTeam === 'A' && piece.search(/^b/) !== -1) return false;
    if (myTeam === 'B' && piece.search(/^w/) !== -1) return false;
}

function onDrop (source, target) {
    const targetPiece = game.get(target);
    if (targetPiece) {
        const targetIsWhiteSide = targetPiece.color === 'w';
        if (myTeam === 'A' && targetIsWhiteSide) return 'snapback';
        if (myTeam === 'B' && !targetIsWhiteSide) return 'snapback';
    }

    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    currentTurnIndex = (currentTurnIndex + 1) % 4;

    database.ref('rooms/' + roomID + '/game').set({
        fen: game.fen(),
        turnIndex: currentTurnIndex
    });
}

function onSnapEnd () { board.position(game.fen()); }

function joinRoom(color) {
    roomID = document.getElementById('roomInput').value;
    if (!roomID) return alert("Enter Room ID");
    myColor = color;
    myTeam = (color === 'w' || color === 'g') ? 'A' : 'B';
    document.getElementById('setup-section').style.display = 'none';
    if(myTeam === 'B') board.flip();

    database.ref('rooms/' + roomID + '/game').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            game.load(data.fen);
            currentTurnIndex = data.turnIndex;
            board.position(data.fen);
            document.getElementById('status').innerText = `Current Turn: ${getPlayerName(turnOrder[currentTurnIndex])}`;
        } else {
            database.ref('rooms/' + roomID + '/game').set({ fen: customStartPos, turnIndex: 0 });
        }
    });

    database.ref('rooms/' + roomID + '/chat/global').on('child_added', (snapshot) => {
        displayMessage('chat-messages', snapshot.val().user, snapshot.val().text);
    });

    database.ref('rooms/' + roomID + '/chat/team_' + myTeam).on('child_added', (snapshot) => {
        displayMessage('team-messages', "Partner", snapshot.val().text);
    });
}

function sendMessage(type) {
    const input = document.getElementById(type === 'global' ? 'chatInput' : 'teamInput');
    if (!input.value.trim() || !roomID) return;
    const path = type === 'global' ? 'global' : 'team_' + myTeam;
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

var config = {
    draggable: true,
    position: customStartPos,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};
board = Chessboard('board', config);
