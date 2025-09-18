// استيراد مكتبات Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue, set, get, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAXiTvVK16h_nJF3439sOhOHJpnhzq-Qkk",
    authDomain: "game-3-36b40.firebaseapp.com",
    databaseURL: "https://game-3-36b40-default-rtdb.firebaseio.com",
    projectId: "game-3-36b40",
    storageBucket: "game-3-36b40.firebasestorage.app",
    messagingSenderId: "1076417556414",
    appId: "1:1076417556414:web:ef9215865b24a5b1f013ef"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// عناصر HTML (لصفحة المشرف)
const startTournamentBtn = document.getElementById('startTournamentBtn');
const resetGameBtn = document.getElementById('resetGameBtn');
const waitingCountDisplay = document.getElementById('waitingCount');
const playingCountDisplay = document.getElementById('playingCount');
const liveLeaderboardTableBody = document.querySelector('#liveLeaderboardTable tbody');
const playersUl = document.getElementById('players-ul');

// مراجع Firebase
const playersRef = ref(database, 'players');
const matchmakingQueueRef = ref(database, 'matchmakingQueue');
const gameStatusRef = ref(database, 'gameStatus');

// ----------------------------------------------------
// منطق صفحة المشرف
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupAdminPage();
});

function setupAdminPage() {
    handlePlayerListUpdate();
    listenToGameStatusForAdmin();
    handleAdminButtons();
    listenForPlayerDeletions();
    setupLiveLeaderboard();
}

function handlePlayerListUpdate() {
    onValue(matchmakingQueueRef, (snapshot) => {
        const queue = snapshot.val() || {};
        const playerNames = Object.keys(queue);
        if (waitingCountDisplay) waitingCountDisplay.textContent = playerNames.length;
        
        if (playersUl) {
            playersUl.innerHTML = '';
            playerNames.forEach(name => {
                const li = document.createElement('li');
                li.innerHTML = `${name} <button class="delete-btn" data-player-name="${name}">حذف اللاعب</button>`;
                playersUl.appendChild(li);
            });
        }
    });
}

function listenToGameStatusForAdmin() {
    onValue(gameStatusRef, (snapshot) => {
        const status = snapshot.val() || { status: 'waiting' };
        if (startTournamentBtn) {
            if (status.status === 'starting') {
                startTournamentBtn.disabled = true;
                resetGameBtn.disabled = false;
            } else {
                startTournamentBtn.disabled = false;
                resetGameBtn.disabled = false;
            }
        }
    });
}

function setupLiveLeaderboard() {
    onValue(playersRef, (snapshot) => {
        const allPlayers = snapshot.val() || {};
        const sortedPlayers = Object.values(allPlayers).sort((a, b) => (b.score || 0) - (a.score || 0));
        
        if (playingCountDisplay) playingCountDisplay.textContent = sortedPlayers.length;

        if (liveLeaderboardTableBody) {
            liveLeaderboardTableBody.innerHTML = '';
            if (sortedPlayers.length > 0) {
                sortedPlayers.forEach(player => {
                    const row = document.createElement('tr');
                    const correct = player.correctAnswers || 0;
                    const incorrect = player.incorrectAnswers || 0;
                    row.innerHTML = `
                        <td>${player.name}</td>
                        <td>${player.score || 0}</td>
                        <td>${correct}</td>
                        <td>${incorrect}</td>
                        <td>${player.status === 'finished' ? 'انتهى' : player.status === 'playing' ? 'يلعب' : 'في الانتظار'}</td>
                        <td><button class="delete-btn" data-player-name="${player.name}">حذف</button></td>
                    `;
                    liveLeaderboardTableBody.appendChild(row);
                });
            } else {
                liveLeaderboardTableBody.innerHTML = '<tr><td colspan="6">لا يوجد لاعبون حالياً.</td></tr>';
            }
        }
    });
}

function handleAdminButtons() {
    if (startTournamentBtn) {
        startTournamentBtn.addEventListener('click', async () => {
            const matchmakingSnapshot = await get(matchmakingQueueRef);
            const playerCount = Object.keys(matchmakingSnapshot.val() || {}).length;
            if (playerCount > 0) {
                await set(gameStatusRef, { status: 'starting', round: 1 });
                alert('تم إرسال إشارة بدء البطولة إلى اللاعبين.');
            } else {
                alert('لا يوجد لاعبون في قائمة الانتظار.');
            }
        });
    }

    if (resetGameBtn) {
        resetGameBtn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من إعادة تعيين اللعبة بالكامل؟ سيتم حذف جميع اللاعبين ونتائجهم.')) {
                await set(playersRef, null);
                await set(matchmakingQueueRef, null);
                await set(gameStatusRef, { status: 'waiting', round: 0 });
                alert('تم إعادة تعيين اللعبة بنجاح.');
            }
        });
    }
}

function listenForPlayerDeletions() {
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.classList.contains('delete-btn')) {
            const playerName = e.target.dataset.playerName;
            if (confirm(`هل أنت متأكد من حذف اللاعب ${playerName}؟`)) {
                await remove(ref(database, 'players/' + playerName));
                await remove(ref(database, 'matchmakingQueue/' + playerName));
                alert(`تم حذف اللاعب ${playerName}.`);
            }
        }
    });
                                      }
