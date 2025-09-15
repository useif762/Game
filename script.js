// استيراد مكتبات Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue, set, get, remove, runTransaction, onDisconnect } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

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

// المتغيرات
let playerName = '';
let myScore = 0;
let correctAnswersCount = 0;
let incorrectAnswersCount = 0;
let currentQuestionIndex = 0;
let timerInterval;
let questionSet = [];
let hasAnswered = false;
const TOTAL_QUESTIONS = 20;

// عناصر HTML
const loadingScreen = document.getElementById('loading-screen');
const registerScreen = document.getElementById('register-screen');
const waitingScreen = document.getElementById('waiting-screen');
const matchScreen = document.getElementById('match-screen');
const resultsScreen = document.getElementById('results-screen');
const playerNameInput = document.getElementById('playerNameInput');
const registerBtn = document.getElementById('registerBtn');
const playersUl = document.getElementById('players-ul'); // إعادة العنصر
const playerOneNameDisplay = document.getElementById('player-one-name');
const timerDisplay = document.getElementById('timer');
const questionCountDisplay = document.getElementById('question-count');
const questionText = document.getElementById('question-text');
const answersContainer = document.getElementById('answers-container');
const matchResultMessage = document.getElementById('match-result-message');
const winnerNameDisplay = document.getElementById('winner-name');
const trophyImage = document.getElementById('trophy-image');
const leaderboardTable = document.getElementById('leaderboard-table');
const finalMessageDisplay = document.getElementById('final-message');

// ثابتات اللعبة
const TIME_PER_QUESTION = 15;
const POINTS_PER_CORRECT_ANSWER = 3;
const POINTS_PER_INCORRECT_ANSWER = -2;

// منطق اللعبة باستخدام Firebase
const playersRef = ref(database, 'players');
const matchmakingQueueRef = ref(database, 'matchmakingQueue');
const gameStatusRef = ref(database, 'gameStatus');

// بداية اللعبة
document.addEventListener('DOMContentLoaded', () => {
    switchScreen(registerScreen);
    handlePlayerListUpdate(); // إعادة الدالة
    listenToGameStatus();
});

// التعامل مع تسجيل اللاعب
registerBtn.addEventListener('click', async () => {
    registerBtn.disabled = true;
    playerName = playerNameInput.value.trim();

    if (playerName && playerName.length > 2) {
        const playersSnapshot = await get(playersRef);
        const players = playersSnapshot.val() || {};
        if (Object.keys(players).some(key => players[key].name === playerName) || Object.keys(await get(matchmakingQueueRef)).some(name => name === playerName)) {
            alert('الاسم مستخدم بالفعل. الرجاء اختيار اسم آخر.');
            registerBtn.disabled = false;
            return;
        }

        await set(ref(database, 'players/' + playerName), {
            name: playerName,
            score: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            status: 'waiting'
        });

        await set(ref(database, 'matchmakingQueue/' + playerName), true);
        
        onDisconnect(ref(database, 'players/' + playerName)).remove();
        onDisconnect(ref(database, 'matchmakingQueue/' + playerName)).remove();

        switchScreen(waitingScreen);
        registerBtn.disabled = false;
    } else {
        registerBtn.disabled = false;
    }
});

// دالة جديدة للاستماع لأوامر لوحة التحكم
function listenToGameStatus() {
    onValue(gameStatusRef, (snapshot) => {
        const status = snapshot.val();
        if (status === 'starting') {
            switchScreen(matchScreen);
            playerOneNameDisplay.textContent = playerName;
            currentQuestionIndex = 0;
            myScore = 0;
            correctAnswersCount = 0;
            incorrectAnswersCount = 0;
            loadQuestions().then(() => startQuestion());

            set(ref(database, 'players/' + playerName + '/status'), 'playing');
            remove(ref(database, 'matchmakingQueue/' + playerName));
        }
    });
}

// تحديث قائمة اللاعبين في قائمة الانتظار
function handlePlayerListUpdate() {
    onValue(matchmakingQueueRef, (snapshot) => {
        const queue = snapshot.val() || {};
        const playerNames = Object.keys(queue);
        playersUl.innerHTML = '';
        playerNames.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            playersUl.appendChild(li);
        });
    });
}

// منطق المباراة
async function loadQuestions() {
    const response = await fetch('questions.json');
    const data = await response.json();
    questionSet = data.sort(() => 0.5 - Math.random()).slice(0, TOTAL_QUESTIONS);
}

function startQuestion() {
    if (currentQuestionIndex >= TOTAL_QUESTIONS) {
        endGame();
        return;
    }

    hasAnswered = false;
    const question = questionSet[currentQuestionIndex];
    questionText.textContent = question.question;
    answersContainer.innerHTML = '';
    matchResultMessage.classList.add('hidden');
    questionCountDisplay.textContent = `الأسئلة: ${currentQuestionIndex + 1}/${TOTAL_QUESTIONS}`;
    
    const shuffledAnswers = question.answers.sort(() => 0.5 - Math.random());
    
    shuffledAnswers.forEach(answer => {
        const button = document.createElement('button');
        button.classList.add('answer-btn');
        button.textContent = answer.text;
        button.addEventListener('click', () => handleAnswerClick(button, answer.correct));
        answersContainer.appendChild(button);
    });

    startTimer();
}

function handleAnswerClick(selectedButton, isCorrect) {
    if (hasAnswered) return;
    hasAnswered = true;
    selectAnswer(selectedButton, isCorrect);
}

function startTimer() {
    let timeLeft = TIME_PER_QUESTION;
    timerDisplay.textContent = `الوقت المتبقي: ${timeLeft}`;
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `الوقت المتبقي: ${timeLeft}`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (!hasAnswered) {
                selectAnswer(null, false);
            }
        }
    }, 1000);
}

function selectAnswer(selectedButton, isCorrect) {
    clearInterval(timerInterval);
    disableAnswerButtons();

    if (isCorrect) {
        myScore += POINTS_PER_CORRECT_ANSWER;
        correctAnswersCount++;
        matchResultMessage.textContent = "إجابة صحيحة! +3 نقاط";
    } else {
        myScore += POINTS_PER_INCORRECT_ANSWER;
        incorrectAnswersCount++;
        matchResultMessage.textContent = selectedButton ? "إجابة خاطئة. -2 نقطة" : "انتهى الوقت! -2 نقطة";
    }

    matchResultMessage.classList.remove('hidden');

    const question = questionSet[currentQuestionIndex];
    document.querySelectorAll('.answer-btn').forEach(btn => {
        if (question.answers.find(a => a.correct).text === btn.textContent) {
            btn.classList.add('correct');
        }
        if (selectedButton && selectedButton === btn) {
            btn.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
    });
    
    setTimeout(() => {
        currentQuestionIndex++;
        startQuestion();
    }, 2000);
}

function disableAnswerButtons() {
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = true;
    });
}

// دالة إنهاء اللعبة وتخزين النتائج
async function endGame() {
    const playerRef = ref(database, 'players/' + playerName);
    await set(playerRef, {
        name: playerName,
        score: myScore,
        correctAnswers: correctAnswersCount,
        incorrectAnswers: incorrectAnswersCount,
        status: 'finished'
    });

    displayResults();
}

// عرض شاشة النتائج النهائية
async function displayResults() {
    switchScreen(resultsScreen);

    onValue(playersRef, (snapshot) => {
        const allPlayers = snapshot.val() || {};
        
        const sortedPlayers = Object.values(allPlayers).sort((a, b) => (b.score || 0) - (a.score || 0));
        
        const finalWinner = sortedPlayers[0] || null;

        if (finalWinner && finalWinner.score > 0) {
            winnerNameDisplay.textContent = `فاز بالبطولة: ${finalWinner.name}`;
            trophyImage.classList.remove('hidden');
        } else {
            winnerNameDisplay.textContent = `لا يوجد فائز بعد.`;
            trophyImage.classList.add('hidden');
        }

        leaderboardTable.innerHTML = `
            <thead>
                <tr>
                    <th>الترتيب</th>
                    <th>اسم اللاعب</th>
                    <th>النقاط</th>
                    <th>إجابات صحيحة</th>
                    <th>إجابات خاطئة</th>
                    <th>الحالة</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPlayers.map((player, index) => {
                    const statusText = player.status === 'finished' ? 'انتهى' : 'في اللعب';
                    const score = player.score || 0;
                    const correct = player.correctAnswers || 0;
                    const incorrect = player.incorrectAnswers || 0;
                    return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${player.name} ${player.name === playerName ? '(أنت)' : ''} ${index === 0 ? '(حامل اللقب)' : ''}</td>
                            <td>${score}</td>
                            <td>${correct}</td>
                            <td>${incorrect}</td>
                            <td>${statusText}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;
    });
}

// دالة مساعدة لتغيير الشاشة
function switchScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}