// استيراد مكتبات Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue, set, get, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

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
const TOTAL_QUESTIONS = 15;

// عناصر HTML
const loadingScreen = document.getElementById('loading-screen');
const registerScreen = document.getElementById('register-screen');
const waitingScreen = document.getElementById('waiting-screen');
const matchScreen = document.getElementById('match-screen');
const resultsScreen = document.getElementById('results-screen');
const playerNameInput = document.getElementById('playerNameInput');
const registerBtn = document.getElementById('registerBtn');
const playersUl = document.getElementById('players-ul');
const playerOneNameDisplay = document.getElementById('player-one-name');

// عناصر واجهة اللعبة
const timerDisplay = document.getElementById('timer');
const questionCountDisplay = document.getElementById('question-count');
const questionText = document.getElementById('question-text');
const answersContainer = document.getElementById('answers-container');
const matchResultMessage = document.getElementById('match-result-message');
const cluesList = document.getElementById('clues-list');
const answerInput = document.getElementById('answerInput');
const submitBtn = document.getElementById('submitBtn');

// عناصر النتائج المشتركة
const winnerNameDisplay = document.getElementById('winner-name');
const trophyImage = document.getElementById('trophy-image');
const leaderboardTable = document.getElementById('leaderboard-table');
const finalMessageDisplay = document.getElementById('final-message');

// ثابتات اللعبة
const QUIZ_POINTS_CORRECT = 3;
const QUIZ_POINTS_INCORRECT = -2;
const ANA_MEEN_POINTS_CORRECT = 5;
const SPIRITUAL_POINTS_CORRECT = 5; // نقاط الأسئلة الروحانية

// منطق اللعبة باستخدام Firebase
const playersRef = ref(database, 'players');
const matchmakingQueueRef = ref(database, 'matchmakingQueue');
const gameStatusRef = ref(database, 'gameStatus');

// متغير لتخزين مرجع مراقب اللاعب
let playerRemovalListener = null;

// بداية اللعبة
document.addEventListener('DOMContentLoaded', () => {
    switchScreen(registerScreen);
    handlePlayerListUpdate();
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
            status: 'waiting'
        });

        await set(ref(database, 'matchmakingQueue/' + playerName), true);
        
        // إعداد مراقب لحذف اللاعب من قبل الأدمن
        listenToPlayerRemoval();

        switchScreen(waitingScreen);
        registerBtn.disabled = false;
    } else {
        registerBtn.disabled = false;
    }
});

// دالة لمراقبة بيانات اللاعب الخاصة
function listenToPlayerRemoval() {
    // إزالة المراقب القديم إذا كان موجوداً
    if (playerRemovalListener) {
        playerRemovalListener();
    }
    
    // إعداد مراقب جديد على بيانات اللاعب الحالية
    const playerNodeRef = ref(database, 'players/' + playerName);
    playerRemovalListener = onValue(playerNodeRef, (snapshot) => {
        const playerData = snapshot.val();
        // إذا كانت البيانات null، هذا يعني أنه تم حذف اللاعب
        if (playerData === null) {
            alert('تم حذف حسابك من اللعبة بواسطة القائد.');
            resetGameClientSide();
            // لإجبار إعادة التحميل وضمان مسح كل البيانات
            window.location.reload();
        }
    });
}

// دالة لتصفير بيانات اللعبة في المتصفح وإعادة التوجيه
function resetGameClientSide() {
    clearInterval(timerInterval);
    playerName = '';
    myScore = 0;
    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    incorrectAnswersCount = 0;
    questionSet = [];
    hasAnswered = false;
    
    // إزالة المراقب الخاص باللاعب الحالي لمنع تفعيله مرة أخرى
    if (playerRemovalListener) {
        playerRemovalListener();
        playerRemovalListener = null;
    }
    
    switchScreen(registerScreen);
}

// دالة للاستماع لأوامر لوحة التحكم
function listenToGameStatus() {
    onValue(gameStatusRef, async (snapshot) => {
        const status = snapshot.val() || { status: 'waiting' };
        console.log('Game status changed:', status.status); // للتأكد أن الكود يعمل

        if (status.status === 'starting') {
            if (playerName) { // تأكد أن اللاعب مسجل قبل بدء اللعب
                switchScreen(matchScreen);
                playerOneNameDisplay.textContent = playerName;
                currentQuestionIndex = 0;
                myScore = 0;
                correctAnswersCount = 0;
                incorrectAnswersCount = 0;
                await loadQuestions();
                
                startQuestion();
    
                set(ref(database, 'players/' + playerName + '/status'), 'playing');
                remove(ref(database, 'matchmakingQueue/' + playerName));
            } else {
                 // إذا لم يكن مسجلاً، أعده إلى شاشة التسجيل
                 switchScreen(registerScreen);
            }
        } else if (status.status === 'waiting' && playerName) {
            // إذا تم إعادة تعيين اللعبة من قبل المشرف
            alert('تم إعادة تعيين اللعبة من قبل القائد، يرجى التسجيل مرة أخرى.');
            resetGameClientSide();
            window.location.reload();
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

// ----------------------------------------------------
// منطق اختيار وتحميل الأسئلة
// ----------------------------------------------------
async function loadQuestions() {
    const response = await fetch('questions.json');
    const allQuestions = await response.json();

    // فصل الأسئلة الدينية عن باقي الأسئلة
    const religiousQuestions = allQuestions.filter(q => 
        q.type === 'spiritual' || 
        (q.type === 'quiz' && (q.question.includes('الروح القدس') || q.question.includes('المسيح') || q.question.includes('أسفار') || q.question.includes('العذراء') || q.question.includes('عقيدة') || q.question.includes('حظ')))
    );

    // فصل الأسئلة غير الدينية (بما فيها أسئلة أنا مين؟)
    const nonReligiousQuestions = allQuestions.filter(q => !religiousQuestions.includes(q));

    // اختيار الأسئلة الدينية الإجبارية
    const religiousQuizQuestions = religiousQuestions.filter(q => q.type === 'quiz');
    const spiritualQuestions = religiousQuestions.filter(q => q.type === 'spiritual');

    const selectedReligiousQuiz = selectRandomQuestions(religiousQuizQuestions, 2);
    const selectedSpiritual = selectRandomQuestions(spiritualQuestions, 1);
    
    // اختيار باقي الأسئلة من القائمة غير الدينية
    const remainingCount = TOTAL_QUESTIONS - selectedReligiousQuiz.length - selectedSpiritual.length;
    const selectedOthers = selectRandomQuestions(nonReligiousQuestions, remainingCount);

    // دمج وتوزيع الأسئلة
    questionSet = [...selectedReligiousQuiz, ...selectedSpiritual, ...selectedOthers];
    shuffleArray(questionSet);
}

function selectRandomQuestions(arr, count) {
    if (arr.length < count) {
        console.warn('Cannot select ' + count + ' questions from a pool of ' + arr.length + '. Returning all available questions.');
        return [...arr];
    }
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ----------------------------------------------------
// منطق اللعبة
// ----------------------------------------------------
function startQuestion() {
    if (currentQuestionIndex >= TOTAL_QUESTIONS) {
        endGame();
        return;
    }

    hasAnswered = false;
    const currentQuestion = questionSet[currentQuestionIndex];
    
    // إظهار وإخفاء العناصر حسب نوع السؤال
    matchResultMessage.classList.add('hidden');
    questionText.classList.remove('hidden');

    if (currentQuestion.type === 'quiz') {
        answersContainer.classList.remove('hidden');
        timerDisplay.classList.remove('hidden');
        cluesList.classList.add('hidden');
        answerInput.classList.add('hidden');
        submitBtn.classList.add('hidden');
        startQuizRound(currentQuestion);

    } else if (currentQuestion.type === 'ana_meen') {
        answersContainer.classList.add('hidden');
        timerDisplay.classList.add('hidden');
        cluesList.classList.remove('hidden');
        answerInput.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        startAnaMeenRound(currentQuestion);

    } else if (currentQuestion.type === 'spiritual') { // إضافة منطق الأسئلة الروحانية
        answersContainer.classList.add('hidden');
        timerDisplay.classList.add('hidden');
        cluesList.classList.remove('hidden');
        answerInput.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        startSpiritualRound(currentQuestion);
    }

    questionCountDisplay.textContent = `الأسئلة: ${currentQuestionIndex + 1}/${TOTAL_QUESTIONS}`;
}

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

// ----------------------------------------------------
// منطق لعبة الاختيارات
// ----------------------------------------------------
function startQuizRound(question) {
    questionText.textContent = question.question;
    answersContainer.innerHTML = '';
    
    const shuffledAnswers = question.answers.sort(() => 0.5 - Math.random());
    
    shuffledAnswers.forEach(answer => {
        const button = document.createElement('button');
        button.classList.add('answer-btn');
        button.textContent = answer.text;
        button.addEventListener('click', () => handleQuizAnswer(button, answer.correct));
        answersContainer.appendChild(button);
    });

    startTimer(question.time);
}

function startTimer(timeLeft) {
    timerDisplay.textContent = `الوقت المتبقي: ${timeLeft}`;
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `الوقت المتبقي: ${timeLeft}`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (!hasAnswered) {
                handleQuizAnswer(null, false);
            }
        }
    }, 1000);
}

function handleQuizAnswer(selectedButton, isCorrect) {
    if (hasAnswered) return;
    hasAnswered = true;
    clearInterval(timerInterval);
    disableQuizButtons();

    if (isCorrect) {
        myScore += QUIZ_POINTS_CORRECT;
        correctAnswersCount++;
        matchResultMessage.textContent = "إجابة صحيحة! +3 نقاط";
    } else {
        myScore += QUIZ_POINTS_INCORRECT;
        incorrectAnswersCount++;
        matchResultMessage.textContent = selectedButton ? "إجابة خاطئة. -2 نقطة" : "انتهى الوقت! -2 نقطة";
    }

    matchResultMessage.classList.remove('hidden');
    
    if (selectedButton) {
        const question = questionSet[currentQuestionIndex];
        document.querySelectorAll('.answer-btn').forEach(btn => {
            if (question.answers.find(a => a.correct).text === btn.textContent) {
                btn.classList.add('correct');
            }
            if (selectedButton === btn) {
                btn.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
        });
    }

    setTimeout(() => {
        currentQuestionIndex++;
        startQuestion();
    }, 2000);
}

function disableQuizButtons() {
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = true;
    });
}


// ----------------------------------------------------
// منطق لعبة "أنا مين؟"
// ----------------------------------------------------
function startAnaMeenRound(question) {
    cluesList.innerHTML = '';
    answerInput.value = '';
    submitBtn.disabled = false;
    answerInput.disabled = false; // تفعيل مربع الإدخال
    questionText.textContent = "تنبيه: أنت الآن في جولة 'أنا مين؟' - اكتب الإجابة ثم اضغط إرسال أو اضغط Enter";

    question.clues.forEach(clue => {
        const li = document.createElement('li');
        li.textContent = clue;
        cluesList.appendChild(li);
    });
}

// ----------------------------------------------------
// منطق لعبة "الأسئلة الروحانية"
// ----------------------------------------------------
function startSpiritualRound(question) {
    cluesList.innerHTML = '';
    answerInput.value = '';
    submitBtn.disabled = false;
    answerInput.disabled = false;
    questionText.textContent = "تنبيه: أنت الآن في جولة 'أسئلة روحانية' - اكتب الإجابة ثم اضغط إرسال أو اضغط Enter";

    question.clues.forEach(clue => {
        const li = document.createElement('li');
        li.textContent = clue;
        cluesList.appendChild(li);
    });
}

// دالة منفصلة للتعامل مع الإجابة
function handleAnswer(isCorrect, correctAnswer) {
    if (hasAnswered) return;
    hasAnswered = true;
    submitBtn.disabled = true;
    answerInput.disabled = true;

    if (isCorrect) {
        myScore += SPIRITUAL_POINTS_CORRECT;
        correctAnswersCount++;
        matchResultMessage.textContent = "إجابة صحيحة! +5 نقاط";
    } else {
        myScore += QUIZ_POINTS_INCORRECT;
        incorrectAnswersCount++;
        matchResultMessage.textContent = `إجابة خاطئة. الإجابة الصحيحة هي: ${correctAnswer}. -2 نقطة`;
    }

    matchResultMessage.classList.remove('hidden');
    
    setTimeout(() => {
        currentQuestionIndex++;
        startQuestion();
    }, 2000);
}

// زر الإرسال
submitBtn.addEventListener('click', () => {
    const currentQuestion = questionSet[currentQuestionIndex];
    if (currentQuestion.type === 'ana_meen') {
        handleAnswer(answerInput.value.trim().toLowerCase() === currentQuestion.answer.toLowerCase(), currentQuestion.answer);
    } else if (currentQuestion.type === 'spiritual') {
        handleAnswer(answerInput.value.trim().toLowerCase() === currentQuestion.answer.toLowerCase(), currentQuestion.answer);
    }
});


// الضغط على Enter
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const currentQuestion = questionSet[currentQuestionIndex];
        if (currentQuestion.type === 'ana_meen') {
            handleAnswer(answerInput.value.trim().toLowerCase() === currentQuestion.answer.toLowerCase(), currentQuestion.answer);
        } else if (currentQuestion.type === 'spiritual') {
            handleAnswer(answerInput.value.trim().toLowerCase() === currentQuestion.answer.toLowerCase(), currentQuestion.answer);
        }
    }
});


// ----------------------------------------------------
// عرض شاشة النتائج النهائية (مشترك)
// ----------------------------------------------------
async function displayResults() {
    switchScreen(resultsScreen);

    onValue(playersRef, (snapshot) => {
        const allPlayers = snapshot.val() || {};
        
        const sortedPlayers = Object.values(allPlayers).sort((a, b) => (b.score || 0) - (a.score || 0));
        
        const finalWinner = sortedPlayers[0] || null;

        // تم تعديل الشرط هنا ليعرض الفائز بغض النظر عن نقاطه
        if (finalWinner) {
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
                    <th>الإجابات الصحيحة</th>
                    <th>الإجابات الخاطئة</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPlayers.map((player, index) => {
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
        
