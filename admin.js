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

// عناصر HTML
const startTournamentBtn = document.getElementById('startTournamentBtn');
const resetGameBtn = document.getElementById('resetGameBtn');
const waitingCountDisplay = document.getElementById('waitingCount');
const playingCountDisplay = document.getElementById('playingCount');
const waitingPlayersList = document.getElementById('waitingPlayersList');
const liveLeaderboardTableBody = document.querySelector('#liveLeaderboardTable tbody');

// مراجع Firebase
const playersRef = ref(database, 'players');
const matchmakingQueueRef = ref(database, 'matchmakingQueue');
const gameStatusRef = ref(database, 'gameStatus');

// ----------------------------------------------------
// 1. مراقبة البيانات في الوقت الفعلي
// ----------------------------------------------------

// مراقبة قائمة الانتظار
onValue(matchmakingQueueRef, (snapshot) => {
    const queue = snapshot.val() || {};
    const playerNames = Object.keys(queue);
    waitingCountDisplay.textContent = playerNames.length;
    
    waitingPlayersList.innerHTML = '';
    if (playerNames.length > 0) {
        playerNames.forEach(name => {
            const li = document.createElement('li');
            li.innerHTML = `${name} <button class="delete-btn" data-player-name="${name}">حذف اللاعب</button>`;
            waitingPlayersList.appendChild(li);
        });
    } else {
        waitingPlayersList.innerHTML = '<li>لا يوجد لاعبون في قائمة الانتظار.</li>';
    }
});

// مراقبة جميع اللاعبين وحالتهم
onValue(playersRef, (snapshot) => {
    const allPlayers = snapshot.val() || {};
    const sortedPlayers = Object.values(allPlayers).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    const playingCount = sortedPlayers.filter(p => p.status === 'playing' || p.status === 'waiting').length;
    playingCountDisplay.textContent = playingCount;

    liveLeaderboardTableBody.innerHTML = '';
    if (sortedPlayers.length > 0) {
        sortedPlayers.forEach(player => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${player.name}</td>
                <td>${player.score || 0}</td>
                <td>${player.correctAnswers || 0}</td>
                <td>${player.incorrectAnswers || 0}</td>
                <td>${player.status === 'finished' ? 'انتهى' : player.status === 'playing' ? 'يلعب' : 'في الانتظار'}</td>
                <td><button class="delete-btn" data-player-name="${player.name}">حذف</button></td>
            `;
            liveLeaderboardTableBody.appendChild(row);
        });
    } else {
        liveLeaderboardTableBody.innerHTML = '<tr><td colspan="6">لا يوجد لاعبون حالياً.</td></tr>';
    }
});

// ----------------------------------------------------
// 2. التحكم في اللعبة
// ----------------------------------------------------

// زر "ابدأ البطولة"
startTournamentBtn.addEventListener('click', async () => {
    const matchmakingSnapshot = await get(matchmakingQueueRef);
    const playerCount = Object.keys(matchmakingSnapshot.val() || {}).length;

    if (playerCount > 0) {
        await set(gameStatusRef, { status: 'starting', round: 1 });
        startTournamentBtn.disabled = true;
        resetGameBtn.disabled = false;
        alert('تم إرسال إشارة بدء البطولة إلى اللاعبين.');
    } else {
        alert('لا يوجد لاعبون في قائمة الانتظار.');
    }
});

// زر "إعادة تعيين اللعبة"
resetGameBtn.addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من إعادة تعيين اللعبة بالكامل؟ سيتم حذف جميع اللاعبين ونتائجهم.')) {
        startTournamentBtn.disabled = true;
        resetGameBtn.disabled = false;
        // حذف جميع بيانات اللاعبين في Firebase
        await set(playersRef, null);
        await set(matchmakingQueueRef, null);
        // إعادة حالة اللعبة إلى وضع الانتظار
        await set(gameStatusRef, { status: 'waiting', round: 0 });
        startTournamentBtn.disabled = false;
        resetGameBtn.disabled = false;
        alert('تم إعادة تعيين اللعبة بنجاح.');
    }
});

// ----------------------------------------------------
// 3. حذف لاعب معين
// ----------------------------------------------------

document.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('delete-btn')) {
        const playerName = e.target.dataset.playerName;
        if (confirm(`هل أنت متأكد من حذف اللاعب ${playerName}؟`)) {
            // حذف بيانات اللاعب من Firebase
            await remove(ref(database, 'players/' + playerName));
            await remove(ref(database, 'matchmakingQueue/' + playerName));
            alert(`تم حذف اللاعب ${playerName}.`);
        }
    }
});

// مراقبة حالة اللعبة لتحديث زر البدء
onValue(gameStatusRef, (snapshot) => {
    const status = snapshot.val() || { status: 'waiting' };
    if (status.status === 'starting') {
        startTournamentBtn.disabled = true;
        resetGameBtn.disabled = false;
    } else {
        startTournamentBtn.disabled = false;
        resetGameBtn.disabled = false;
    }
});
