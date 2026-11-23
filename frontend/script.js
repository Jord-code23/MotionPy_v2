// ===== CONFIGURAÇÃO DO TEACHABLE MACHINE =====
let teachableMachineModel = null;
let isModelLoaded = false;
let mediaPipeHands = null;
let handCurrentlyDetected = false;
let lastHandFrameAt = 0;
let lastHandResults = null;
let wristMotionHistory = [];
let handMotionDetected = false;

// ===== ESTADO DA APLICAÇÃO =====
const appState = {
    currentPage: 'home',
    user: null,
    categories: [],
    signs: [],
    currentSign: null,
    videoStream: null,
    isCameraActive: false,
    isDarkMode: false
};

const AppConfig = {
    useLocalStorage: true,
    modelPath: './modelo_js/', 
    assetsPath: './imagens/'
};
// ===== SISTEMA DE ARMAZENAMENTO =====

// ===== SISTEMA DE ARMAZENAMENTO =====
const StorageManager = {
    saveUserProgress: function(userId, progressData) {
        const userData = {
            userId: userId,
            progress: progressData,
            lastUpdate: new Date().toISOString(),
            completedSigns: progressData.completedSigns || [],
            accuracy: progressData.accuracy || 0,
            practiceTime: progressData.practiceTime || 0
        };
        
        localStorage.setItem(`motionpy_user_${userId}`, JSON.stringify(userData));
        console.log('Progresso salvo localmente');
    },
    
    loadUserProgress: function(userId) {
        const localData = localStorage.getItem(`motionpy_user_${userId}`);
        if (localData) {
            return JSON.parse(localData);
        }
        return this.getDefaultProgress();
    },
    
    getDefaultProgress: function() {
        return {
            completedSigns: [],
            accuracy: 0,
            practiceTime: 0,
            lastSession: null
        };
    }
};

// ===== DADOS DE EXEMPLO =====
const sampleData = {
    categories: [
        { 
            id: 1, 
            name: 'Vogais', 
            icon: 'ℹ️', 
            description: 'As cinco vogais do alfabeto (A, E, I, O, U)',
            isLocked: false 
        },
        { 
            id: 2, 
            name: 'Início das Consoantes',
            icon: '📘', 
            description: 'Pratique as primeiras consoantes: B e C',
            isLocked: false 
        },
        { 
            id: 3, 
            name: 'Saudações',
            icon: '💬', 
            description: 'Sinais básicos para dizer "olá" e "tchau".',
            isLocked: false 
        },
        { 
            id: 4, 
            name: 'Números', 
            icon: '🔢', 
            description: 'Números de 0 a 9.',
            isLocked: true,
            lockReason: 'Desbloqueie o módulo a seguir para continuar',
        },
        { 
            id: 5, 
            name: 'Alfabeto Completo',
            icon: '🔤', 
            description: 'Todas as letras (A-Z) da datilologia para soletrar.',
            isLocked: true,
        },
        { 
            id: 6, 
            name: 'Cores', 
            icon: '🌈', 
            description: 'Sinais para as cores: Vermelho, Azul, Amarelo e mais.',
            isLocked: true,
        }
    ],
    signs: [
        { id: 1, name: 'Letra A', category_id: 1, description: 'Sinal para a letra A em Libras', image: 'imagens/letra_a.png' },
        { id: 2, name: 'Letra E', category_id: 1, description: 'Sinal para a letra E em Libras', image: 'imagens/letra_e.png' },
        { id: 3, name: 'Letra I', category_id: 1, description: 'Sinal para a letra I em Libras', image: 'imagens/letra_i.png' },
        { id: 4, name: 'Letra O', category_id: 1, description: 'Sinal para a letra O em Libras', image: 'imagens/letra_o.png' },
        { id: 5, name: 'Letra U', category_id: 1, description: 'Sinal para a letra U em Libras', image: 'imagens/img_letra_U..png'},
        { id: 6, name: 'Letra B', category_id: 2, description: 'Sinal para a letra B em Libras', image: 'imagens/letra_b.png' },
        { id: 7, name: 'Letra C', category_id: 2, description: 'Sinal para a letra C em Libras',image: 'imagens/letra_c.png' },
        { id: 8, name: 'Tchau', category_id: 3, description: 'Sinal de despedida em Libras', image: 'imagens/sinal_tchau.png'},
        { id: 9, name: 'Olá', category_id: 3, description: 'Sinal de cumprimento em Libras', image: 'imagens/sinal_oi.png' },
    ],
    history: [
        { id: 1, date: '2025-10-15', sign: 'Letra A', category: 'Vogais', correct: 5, total: 5, status: 'completed' },
        { id: 2, date: '2025-10-14', sign: 'Letra B', category: 'Início das Consoantes', correct: 2, total: 2, status: 'completed' },
        { id: 3, date: '2025-10-13', sign: 'Olá', category: 'Saudações', correct: 1, total: 2, status: 'practice' }
    ]
};


// ===== dany-CHATBOT GEMINI IA (CORRIGIDO) =====
class ChatbotGemini {
    constructor() {
        this.isOpen = false;
        this.chatHistory = [];
        // RECOMENDAÇÃO: Substitua por variável de ambiente ou backend seguro
        this.apiKey = window.GEMINI_API_KEY || "";
        this.model = 'gemini-1.5-flash';
        this.systemInstruction = `Você é um assistente virtual especializado em LIBRAS (Língua Brasileira de Sinais) e na plataforma MotionPy. 

Sobre a plataforma MotionPy:
- É uma plataforma de ensino de LIBRAS com reconhecimento de gestos
- Tem páginas: Início, Tutoriais, Praticar, Histórico
- Usa câmera para detectar sinais em tempo real
- Oferece tutoriais com vídeos e imagens
- Tem sistema de progresso e histórico

Seu papel:
1. Responder perguntas sobre LIBRAS e sinais específicos
2. Explicar como usar a plataforma MotionPy
3. Dar dicas sobre prática com câmera
4. Ajudar com problemas técnicos
5. Ser amigável e encorajador

Responda em Português do Brasil de forma clara e útil.`;

        this.init();
    }

    init() {
        this.bindEvents();
        console.log('🤖 Chatbot Gemini inicializado');
    }

    bindEvents() {
        const chatToggleBtn = document.getElementById('chatToggleBtn');
        const closeChatBtn = document.getElementById('closeChatBtn');
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        const suggestionBtns = document.querySelectorAll('.suggestion-btn');

        if (!chatToggleBtn || !sendBtn || !chatInput) {
            console.warn('⚠️ Alguns elementos do DOM do chatbot não foram encontrados.');
            return;
        }

        chatToggleBtn.addEventListener('click', () => this.toggleChat());
        if (closeChatBtn) closeChatBtn.addEventListener('click', () => this.closeChat());
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                chatInput.value = question;
                this.sendMessage();
            });
        });

        document.addEventListener('click', (e) => {
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer && chatToggleBtn && !chatContainer.contains(e.target) && !chatToggleBtn.contains(e.target) && this.isOpen) {
                this.closeChat();
            }
        });

        chatToggleBtn.addEventListener('click', () => {
            if (this.isOpen) {
                setTimeout(() => chatInput.focus(), 300);
            }
        });
    }
    
    toggleChat() {
        const chatContainer = document.getElementById('chatContainer');
        const chatIcon = document.getElementById('chatIcon');
        const chatTipBubble = document.querySelector('.chat-tip-bubble');
        
        this.isOpen = !this.isOpen;
        
        if (chatContainer) chatContainer.classList.toggle('open', this.isOpen);
        if (chatIcon) chatIcon.className = this.isOpen ? 'fas fa-times' : 'fas fa-comments';
        if (chatTipBubble) chatTipBubble.style.display = this.isOpen ? 'none' : 'block';
    }

    closeChat() {
        const chatContainer = document.getElementById('chatContainer');
        const chatIcon = document.getElementById('chatIcon');
        const chatTipBubble = document.querySelector('.chat-tip-bubble');
        
        this.isOpen = false;
        if (chatContainer) chatContainer.classList.remove('open');
        if (chatIcon) chatIcon.className = 'fas fa-comments';
        if (chatTipBubble) chatTipBubble.style.display = 'block';
    }

    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        chatInput.value = '';
        if (sendBtn) sendBtn.disabled = true;
        chatInput.disabled = true;

        this.addMessage(message, 'user');
        this.chatHistory.push({ role: "user", parts: [{ text: message }] });
        this.showTypingIndicator();

        try {
            const response = await this.callGeminiAPI(message);
            this.hideTypingIndicator();
            this.addMessage(response, 'assistant');
            this.chatHistory.push({ role: "model", parts: [{ text: response }] });
        } catch (error) {
            console.error('Erro detalhado no chatbot:', error);
            this.hideTypingIndicator();
            const fallback = this.getFallbackResponse(message);
            this.addMessage(fallback + '\n\n*(Modo offline/fallback ativado devido a erro na API)*', 'assistant');
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    async callGeminiAPI(userMessage) {
        // Verifica se a chave não existe ou está vazia
        if (!this.apiKey || this.apiKey.trim() === "") {
            return this.getFallbackResponse(userMessage);
        }

    const payload = {
        contents: this.chatHistory,
        systemInstruction: {
            parts: [{ text: this.systemInstruction }]
        }
    };

    // Usa this.model e this.apiKey de forma dinâmica
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];

    if (!candidate || !candidate.content?.parts?.[0]?.text) {
        throw new Error("Resposta da IA vazia ou formatada incorretamente");
    }

    return candidate.content.parts[0].text;
}

    getFallbackResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        if (message.includes('câmera') || message.includes('camera')) {
            return `Para usar a câmera no MotionPy:\n\n1. **Vá para "Praticar"** - Selecione uma categoria e um sinal\n2. **Ative a câmera** - Clique em "Ativar Câmera"\n3. **Posicione a mão** - Mantenha dentro da área circular\n4. **Verifique o sinal** - Clique no botão para análise\n\n*Dica: Use boa iluminação e fundo neutro para melhor detecção!*`;
        } else if (message.includes('progresso') || message.includes('histórico')) {
            return `**Acompanhe seu progresso:**\n\n📊 **Histórico** - Veja todos os sinais praticados\n⭐ **Taxa de acerto** - Sua precisão em cada sinal\n⏱️ **Tempo de prática** - Total de tempo dedicado\n🎯 **Sinais concluídos** - Módulos finalizados\n\n*Na página "Histórico" você pode filtrar por data e categoria!*`;
        } else if (message.includes('sinal') || message.includes('aprender')) {
            return `**Sinais disponíveis no MotionPy:**\n\n🔤 **Vogais** - A, E, I, O, U\n📘 **Consoantes Iniciais** - B, C\n💬 **Saudações** - Olá, Tchau\n\n*Comece pelos tutoriais para aprender cada sinal passo a passo!*`;
        } else {
            return `Obrigado pela sua pergunta! Posso te ajudar com:\n\n• Prática com câmera e reconhecimento de gestos\n• Tutoriais de sinais de LIBRAS\n• Acompanhamento de progresso\n• Dúvidas sobre a plataforma MotionPy`;
        }
    }

    addMessage(text, sender) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.innerHTML = this.formatMessage(text);

        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    formatMessage(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/• (.*?)(<br>|$)/g, '• <strong>$1</strong>$2');
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant-message';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}

// Instanciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.chatbotInstance = new ChatbotGemini();
});
// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadCategories();
    loadUserStats();
});


function initializeApp() {
    const savedTheme = localStorage.getItem('motionpy_theme');
    if (savedTheme === 'dark') {
        enableDarkMode();
    }
    
    const savedUser = localStorage.getItem('motionpy_user');
    if (savedUser) {
        appState.user = JSON.parse(savedUser);
    }
    
    setupProfilePage();
    setupLogout();
    updateAuthButtons();
    loadUserStats();
}

async function loadTeachableMachineModel() {
    try {
        console.log("🔄 Carregando modelo do Teachable Machine...");
        
        const modelURL = './modelo_js/model.json';
        const metadataURL = './modelo_js/metadata.json';
        
        console.log("📁 Procurando modelo em:", modelURL);
        
        if (typeof tmImage === 'undefined') {
            throw new Error('Biblioteca Teachable Machine não carregada. Verifique sua conexão com a internet.');
        }
        teachableMachineModel = await tmImage.load(modelURL, metadataURL);
        isModelLoaded = true;
        
        console.log(" Modelo carregado com sucesso!");
        console.log("Classes detectadas:", teachableMachineModel.getClassLabels());
        return true;
    } catch (error) {
        console.error(" Erro ao carregar modelo:", error);
        showFeedback(`Erro ao carregar o modelo de IA: ${error.message}`, 'error');
        return false;
    }
}
// ===== RECONHECIMENTO CONTÍNUO: RASTREAMENTO + CLASSIFICAÇÃO =====
let predictionLoopRunning = false;
let lastPredictionAt = 0;
let lastLiveClass = '';
let stablePredictionCount = 0;
let lastRecordedSign = null;
const LIVE_PREDICTION_INTERVAL = 250;
const HAND_TRACKING_INTERVAL = 80;
const MIN_CONFIDENCE = 0.70;

const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12], [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
];

function setVisionStatus(message) {
    const el = document.getElementById('vision-status');
    if (el) el.textContent = message;
}

function initializeHandTracker() {
    if (mediaPipeHands) return mediaPipeHands;
    if (typeof Hands === 'undefined') {
        throw new Error('MediaPipe Hands não carregou. Verifique sua conexão com a internet e atualize a página.');
    }
    mediaPipeHands = new Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });
    mediaPipeHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.60
    });
    mediaPipeHands.onResults(results => {
        lastHandResults = results;
        handCurrentlyDetected = !!(results.multiHandLandmarks && results.multiHandLandmarks.length);
        drawHandLandmarks(results);
        if (handCurrentlyDetected) {
            const count = results.multiHandLandmarks.length;
            const wrist = results.multiHandLandmarks[0][0];
            wristMotionHistory.push({ x: wrist.x, y: wrist.y, t: performance.now() });
            if (wristMotionHistory.length > 8) wristMotionHistory.shift();
            if (wristMotionHistory.length >= 2) {
                const first = wristMotionHistory[0];
                const last = wristMotionHistory[wristMotionHistory.length - 1];
                handMotionDetected = Math.hypot(last.x - first.x, last.y - first.y) > 0.035;
            }
            setVisionStatus(`${count} mão(s) detectada(s) • ${handMotionDetected ? 'movimento detectado' : 'mão rastreada'} • análise ao vivo`);
        } else if (appState.isCameraActive) {
            wristMotionHistory = [];
            handMotionDetected = false;
            setVisionStatus('Câmera ativa • posicione uma ou duas mãos no enquadramento');
        }
    });
    return mediaPipeHands;
}

function drawHandLandmarks(results) {
    const canvas = document.getElementById('canvas');
    const video = document.getElementById('video');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !video) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hands = results?.multiHandLandmarks || [];
    hands.forEach((landmarks, handIndex) => {
        ctx.lineWidth = Math.max(2, canvas.width / 320);
        ctx.strokeStyle = '#00e676';
        ctx.fillStyle = '#ffeb3b';
        HAND_CONNECTIONS.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height);
            ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height);
            ctx.stroke();
        });
        landmarks.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x * canvas.width, point.y * canvas.height, Math.max(3, canvas.width / 180), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#00e676';
        ctx.font = `bold ${Math.max(16, canvas.width / 35)}px Arial`;
        ctx.fillText(`Mão ${handIndex + 1}`, 14, 28 + handIndex * 25);
    });
}

function normalizeLabel(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function targetLabelForSign(sign) {
    const name = normalizeLabel(sign?.name);
    const aliases = {
        'letraa': ['a'], 'letrae': ['e'], 'letrai': ['i'],
        'letrao': ['o'], 'letrau': ['u'], 'letrab': ['b'],
        'letrac': ['c'], 'ola': ['oi', 'ola'], 'oi': ['oi', 'ola'],
        'tchau': ['tchau'], 'casa': ['casa']
    };
    return aliases[name] || [name];
}

function getBestPrediction(predictions) {
    if (!Array.isArray(predictions) || !predictions.length) return null;
    return predictions.reduce((best, item) =>
        !best || item.probability > best.probability ? item : best, null);
}

function updateLiveRecognition(prediction) {
    const feedbackBox = document.getElementById('feedback');
    const feedback = document.getElementById('feedback-text');
    if (feedbackBox) feedbackBox.classList.remove('hidden');
    if (!handCurrentlyDetected) {
        lastLiveClass = '';
        stablePredictionCount = 0;
        if (feedback) feedback.textContent = 'Nenhuma mão detectada. Posicione sua mão diante da câmera.';
        return;
    }
    if (!prediction || prediction.probability < MIN_CONFIDENCE) {
        lastLiveClass = '';
        stablePredictionCount = 0;
        if (feedback) feedback.textContent = 'Mão detectada! Faça uma configuração de mão do conjunto treinado.';
        return;
    }
    const label = String(prediction.className);
    if (label === lastLiveClass) stablePredictionCount++;
    else { lastLiveClass = label; stablePredictionCount = 1; }
    if (feedback) feedback.textContent = `Sinal provável: ${label} — ${Math.round(prediction.probability * 100)}% de confiança`;

    if (!appState.currentSign) return;
    const accepted = targetLabelForSign(appState.currentSign)
        .some(alias => normalizeLabel(label) === alias);
    if (accepted && stablePredictionCount >= 4 && lastRecordedSign !== appState.currentSign.id) {
        lastRecordedSign = appState.currentSign.id;
        showFeedback(`Sinal ${appState.currentSign.name} reconhecido! (${Math.round(prediction.probability * 100)}%)`, 'success');
        updateUserProgress(appState.currentSign.id);
    } else if (!accepted && stablePredictionCount >= 4 && feedback) {
        feedback.textContent = `Detectado: "${label}". Exercício selecionado: "${appState.currentSign.name}".`;
    }
}

async function checkSign() {
    if (!appState.isCameraActive) {
        showFeedback('Ative a câmera para iniciar a análise ao vivo.', 'error');
        return;
    }
    showFeedback(handCurrentlyDetected ? 'Mão localizada; a análise está acontecendo continuamente.' : 'Ainda não localizei uma mão. Ajuste o enquadramento.', handCurrentlyDetected ? 'success' : 'error');
}

async function startCamera() {
    const video = document.getElementById('video');
    const overlay = document.getElementById('video-overlay');
    const startButton = document.getElementById('enable-camera-btn');
    if (!navigator.mediaDevices?.getUserMedia) {
        showFeedback('Seu navegador não permite câmera. Use http://localhost ou HTTPS.', 'error');
        return;
    }
    try {
        if (startButton) startButton.disabled = true;
        setVisionStatus('Carregando modelo de sinais e detector de mãos...');
        const loaded = await loadTeachableMachineModel();
        if (!loaded) throw new Error('Não foi possível carregar o modelo de classificação.');
        const tracker = initializeHandTracker();
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        appState.videoStream = stream;
        video.srcObject = stream;
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = () => reject(new Error('Não foi possível carregar o vídeo da câmera.'));
        });
        await video.play();
        appState.isCameraActive = true;
        predictionLoopRunning = false;
        lastRecordedSign = null;
        wristMotionHistory = [];
        handMotionDetected = false;
        lastPredictionAt = 0;
        if (overlay) overlay.classList.add('hidden');
        const checkButton = document.getElementById('check-sign-btn');
        if (checkButton) {
            checkButton.disabled = false;
            checkButton.innerHTML = '<i class="fas fa-eye"></i> Análise ao vivo ativa';
        }
        setVisionStatus('Câmera ativa • procurando mãos...');
        showFeedback('Câmera ativa. Posicione sua mão dentro do enquadramento.', 'success');
        processVideoFrames(tracker);
    } catch (error) {
        console.error('Falha ao iniciar câmera/reconhecimento:', error);
        if (appState.videoStream) appState.videoStream.getTracks().forEach(track => track.stop());
        appState.videoStream = null;
        appState.isCameraActive = false;
        if (overlay) overlay.classList.remove('hidden');
        setVisionStatus('Falha ao iniciar detector');
        showFeedback(error.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera nas configurações do navegador.'
            : `Falha no reconhecimento: ${error.message}`, 'error');
    } finally {
        if (startButton) startButton.disabled = false;
    }
}

function stopCamera() {
    appState.isCameraActive = false;
    predictionLoopRunning = false;
    if (appState.videoStream) appState.videoStream.getTracks().forEach(track => track.stop());
    appState.videoStream = null;
    const video = document.getElementById('video');
    if (video) video.srcObject = null;
    const canvas = document.getElementById('canvas');
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    const overlay = document.getElementById('video-overlay');
    if (overlay) overlay.classList.remove('hidden');
    const checkButton = document.getElementById('check-sign-btn');
    if (checkButton) {
        checkButton.disabled = true;
        checkButton.innerHTML = '<i class="fas fa-check"></i> Verificar Sinal';
    }
    setVisionStatus('Câmera desligada');
}

async function processVideoFrames(tracker) {
    if (predictionLoopRunning) return;
    predictionLoopRunning = true;
    const video = document.getElementById('video');
    try {
        while (appState.isCameraActive && video) {
            if (video.readyState >= 2 && video.videoWidth > 0) {
                const now = performance.now();
                if (now - lastHandFrameAt >= HAND_TRACKING_INTERVAL) {
                    lastHandFrameAt = now;
                    await tracker.send({ image: video });
                }
                if (handCurrentlyDetected && isModelLoaded && now - lastPredictionAt >= LIVE_PREDICTION_INTERVAL) {
                    lastPredictionAt = now;
                    try {
                        const predictions = await teachableMachineModel.predict(video, false);
                        updateLiveRecognition(getBestPrediction(predictions));
                    } catch (error) {
                        console.error('Erro na classificação ao vivo:', error);
                        setVisionStatus('Mão localizada • erro na classificação (veja o console)');
                    }
                } else if (!handCurrentlyDetected) {
                    updateLiveRecognition(null);
                }
            }
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    } catch (error) {
        console.error('Erro no processamento dos quadros:', error);
        showFeedback(`Erro durante a análise ao vivo: ${error.message}`, 'error');
        setVisionStatus('Erro no processamento de vídeo');
    } finally {
        predictionLoopRunning = false;
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.getAttribute('data-page');
            showPage(page);
        });
    });

    document.getElementById('login-btn').addEventListener('click', () => showModal('login-modal'));
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('login-modal');
        showModal('register-modal');
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('register-modal');
        showModal('login-modal');
    });

    document.getElementById('close-login-modal').addEventListener('click', () => hideModal('login-modal'));
    document.getElementById('close-register-modal').addEventListener('click', () => hideModal('register-modal'));

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    document.getElementById('start-learning-btn').addEventListener('click', () => showPage('practice'));
    document.getElementById('enable-camera-btn').addEventListener('click', startCamera);
    document.getElementById('check-sign-btn').addEventListener('click', checkSign);
    document.getElementById('back-home-btn').addEventListener('click', () => showPage('home'));
    document.getElementById('back-from-history').addEventListener('click', () => showPage('home'));
    document.getElementById('back-from-tutorial').addEventListener('click', () => showPage('home'));

    document.getElementById('category-select').addEventListener('change', loadSignsByCategory);
    document.getElementById('sign-select').addEventListener('change', selectSign);
    document.getElementById('dark-mode-toggle').addEventListener('change', toggleDarkMode);

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal.id);
        });
    });
}

// ===== FUNÇÕES DE PÁGINA =====
function showPage(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${pageName}"]`);
    if (activeLink) activeLink.classList.add('active');

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const activePage = document.getElementById(`${pageName}-page`);
    if (activePage) activePage.classList.add('active');
    
    appState.currentPage = pageName;

    if (pageName === 'practice') {
        loadPracticeCategories();
        stopCamera();
    } else if (pageName === 'history') {
        loadHistory();
    } else if (pageName === 'tutorial') {
        loadTutorials();
    } else if (pageName === 'profile') {
        loadProfileData();
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// ===== AUTENTICAÇÃO =====
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    appState.user = { id: 1, name: 'Usuário Teste', email: email };
    localStorage.setItem('motionpy_user', JSON.stringify(appState.user));
    updateAuthButtons();
    hideModal('login-modal');
    loadUserStats();
    showFeedback('Login realizado com sucesso!', 'success');
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
        showFeedback('As senhas não coincidem!', 'error');
        return;
    }
// Função para calcular se o usuário é maior de idade (18 anos ou mais)
function isAdult(dateString) {
    if (!dateString) return false;

    const today = new Date();
    const dob = new Date(dateString);
    const age = today.getFullYear() - dob.getFullYear();
    const monthDifference = today.getMonth() - dob.getMonth();
    const dayDifference = today.getDate() - dob.getDate();

    // Ajusta a idade se o aniversário ainda não passou este ano
    if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
        return age - 1 >= 15;
    }
    
    return age >= 15;
}
// Adicione no handleRegister
function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

   
    localStorage.setItem('motionpy_user', JSON.stringify(appState.user));
    updateAuthButtons();
    hideModal('register-modal');
    loadUserStats();
    showFeedback('Cadastro realizado com sucesso!', 'success');
}

    showFeedback('Cadastro realizado com sucesso! Faça login para continuar.', 'success');
    hideModal('register-modal');
    showModal('login-modal');
}

function handleLogout() {
    appState.user = null;
    localStorage.removeItem('motionpy_user');
    updateAuthButtons();
    showPage('home');
    showFeedback('Logout realizado com sucesso!', 'success');
}

function updateAuthButtons() {
    const loginBtn = document.getElementById('login-btn');
    if (appState.user) {
        loginBtn.innerHTML = `<i class="fas fa-user"></i> ${appState.user.name}`;
        loginBtn.onclick = () => handleLogout();
    } else {
        loginBtn.innerHTML = `<i class="fas fa-user"></i> Entrar`;
        loginBtn.onclick = () => showModal('login-modal');
    }
}

// ===== CATEGORIAS E SINAIS =====
function loadCategories() {
    appState.categories = sampleData.categories;
    renderCategories();
}

function renderCategories() {
    const categoriesGrid = document.getElementById('categories-grid');
    categoriesGrid.innerHTML = '';

    appState.categories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = `category-card card ${category.isLocked ? 'locked' : ''}`;
        categoryCard.innerHTML = `
            <div class="category-icon">${category.icon}</div>
            <h3 class="category-name">${category.name}</h3>
            <p class="category-description">${category.description}</p>
            ${category.isLocked ? 
                `<div class="locked-overlay">
                    <i class="fas fa-lock"></i>
                    <p>${category.lockReason || 'Categoria bloqueada'}</p>
                </div>` : 
                ''
            }
        `;
        
        if (!category.isLocked) {
            categoryCard.addEventListener('click', () => {
                showPage('tutorial');
                setTimeout(() => {
                    document.getElementById('category-select').value = category.id;
                    loadSignsByCategory();
                }, 100);
            });
        }
        
        categoriesGrid.appendChild(categoryCard);
    });
}

function loadPracticeCategories() {
    const categorySelect = document.getElementById('category-select');
    categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    
    appState.categories.forEach(category => {
        if (!category.isLocked) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        }
    });
}

function loadSignsByCategory() {
    const categoryId = document.getElementById('category-select').value;
    const signSelect = document.getElementById('sign-select');
    
    if (!categoryId) {
        signSelect.innerHTML = '<option value="">Selecione um sinal</option>';
        signSelect.disabled = true;
        document.getElementById('current-sign-info').style.display = 'none';
        return;
    }

    appState.signs = sampleData.signs.filter(sign => sign.category_id == categoryId);
    renderSignsSelect();
}

function renderSignsSelect() {
    const signSelect = document.getElementById('sign-select');
    signSelect.innerHTML = '<option value="">Selecione um sinal</option>';
    
    appState.signs.forEach(sign => {
        const option = document.createElement('option');
        option.value = sign.id;
        option.textContent = sign.name;
        signSelect.appendChild(option);
    });
    
    signSelect.disabled = false;
}
// ===== DADOS DOS TUTORIAIS =====
const signTutorials = {
    // Vogais
    1: { // Letra A
        name: 'Letra A',
        description: 'Sinal para a letra A em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Feche a mão em forma de punho, com o polegar sobre os dedos'
            },
            {
                title: 'Movimento',
                description: 'Mantenha a mão estática na posição do punho fechado'
            },
            {
                title: 'Orientação',
                description: 'A palma da mão deve estar voltada para frente'
            }
        ]
    },
    2: { // Letra E
        name: 'Letra E',
        description: 'Sinal para a letra E em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Feche a mão com os dedos curvados para dentro, tocando a ponta dos dedos na base da palma'
            },
            {
                title: 'Movimento',
                description: 'Mantenha a mão estática na posição descrita'
            },
            {
                title: 'Orientação',
                description: 'A parte de trás da mão deve estar voltada para frente'
            }
        ]
    },
    3: { // Letra I
        name: 'Letra I',
        description: 'Sinal para a letra I em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Estenda o dedo mínimo (mindinho) e feche os outros dedos com o polegar sobre eles'
            },
            {
                title: 'Movimento',
                description: 'Mantenha a mão estática com o dedo mínimo estendido'
            },
            {
                title: 'Orientação',
                description: 'A palma da mão deve estar voltada para o seu corpo'
            }
        ]
    },
    4: { // Letra O
        name: 'Letra O',
        description: 'Sinal para a letra O em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Forme um círculo com o polegar e o indicador, mantendo os outros dedos estendidos ou levemente curvados'
            },
            {
                title: 'Movimento',
                description: 'Mantenha a forma do círculo sem movimento adicional'
            },
            {
                title: 'Orientação',
                description: 'A palma da mão deve estar voltada para frente'
            }
        ]
    },
    5: { // Letra U
        name: 'Letra U',
        description: 'Sinal para a letra U em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Estenda os dedos indicador e médio juntos, fechando os outros dedos com o polegar sobre eles'
            },
            {
                title: 'Movimento',
                description: 'Mantenha a mão estática com os dois dedos estendidos'
            },
            {
                title: 'Orientação',
                description: 'A palma da mão deve estar voltada para frente'
            }
        ]
    },
    // Consoantes
    6: { // Letra B
        name: 'Letra B',
        description: 'Sinal para a letra B em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Mantenha todos os dedos estendidos e juntos, com o polegar dobrado sobre a palma'
            },
            {
                title: 'Movimento',
                description: 'Mantenha a mão estática com os dedos estendidos'
            },
            {
                title: 'Orientação',
                description: 'A palma da mão deve estar voltada para frente'
            }
        ]
    },
    7: { // Letra C
        name: 'Letra C',
        description: 'Sinal para a letra C em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Forme a letra C curvando os dedos como se estivesse segurando um copo'
            },
            {
                title: 'Movimento',
                description: 'Mantenha a forma da letra C sem movimento adicional'
            },
            {
                title: 'Orientação',
                description: 'A abertura da letra C deve estar voltada para o lado'
            }
        ]
    },
    // Saudações
    8: { // Tchau
        name: 'Tchau',
        description: 'Sinal de despedida em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Abra a mão com todos os dedos estendidos e juntos'
            },
            {
                title: 'Movimento',
                description: 'Balance a mão de um lado para o outro, como se estivesse acenando'
            },
            {
                title: 'Expressão facial',
                description: 'Mantenha um sorriso para demonstrar cordialidade'
            }
        ]
    },
    9: { // Olá
        name: 'Olá',
        description: 'Sinal de cumprimento em Libras',
        steps: [
            {
                title: 'Posição inicial',
                description: 'Mantenha a mão relaxada ao lado do corpo'
            },
            {
                title: 'Forma da mão',
                description: 'Abra a mão com todos os dedos estendidos e juntos'
            },
            {
                title: 'Movimento',
                description: 'Levante a mão até a altura do ombro e balance levemente de um lado para o outro'
            },
            {
                title: 'Expressão facial',
                description: 'Acene com a cabeça levemente e mantenha um sorriso'
            }
        ]
    }
};
function selectSign() {
    const signSelect = document.getElementById('sign-select');
    
    if (!signSelect) {
        console.error('Elemento sign-select não encontrado');
        return;
    }
    
    const signId = signSelect.value;
    appState.currentSign = appState.signs.find(sign => sign.id == signId);
    lastRecordedSign = null;
    lastLiveClass = '';
    stablePredictionCount = 0;
    
    const currentSignInfo = document.getElementById('current-sign-info');
    const checkSignBtn = document.getElementById('check-sign-btn');
    
    if (appState.currentSign) {
        if (currentSignInfo) {
            currentSignInfo.style.display = 'block';
            document.getElementById('current-sign-name').textContent = appState.currentSign.name;
            document.getElementById('current-sign-description').textContent = appState.currentSign.description;
            
            // ATUALIZAR A IMAGEM DO SINAL
            const signImage = document.getElementById('sign-image');
            if (signImage && appState.currentSign.image) {
                signImage.src = appState.currentSign.image;
                signImage.alt = `Demonstração do sinal ${appState.currentSign.name}`;
            }
        }
        
        if (checkSignBtn) {
            checkSignBtn.disabled = !appState.isCameraActive;
        }
        
        correctionSystem.hideCorrectionInterface();
        
        console.log(`✅ Sinal selecionado: ${appState.currentSign.name}`);
    } else {
        if (currentSignInfo) {
            currentSignInfo.style.display = 'none';
        }
        
        if (checkSignBtn) {
            checkSignBtn.disabled = true;
        }
    }
}
// ===== FEEDBACK E PROGRESSO =====
function showFeedback(message, type) {
    const feedback = document.getElementById('feedback');
    const feedbackText = document.getElementById('feedback-text');
    
    feedbackText.textContent = message;
    feedback.className = `feedback ${type}`;
    feedback.classList.remove('hidden');
    
    const icon = feedback.querySelector('i');
    icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    
    setTimeout(() => feedback.classList.add('hidden'), 4000);
}

function updateUserProgress(signId) {
    if (!appState.user) {
        console.log('Usuário não logado - progresso não salvo');
        return;
    }
    
    console.log('📊 Atualizando progresso para o sinal:', signId);
    
    const userProgress = StorageManager.loadUserProgress(appState.user.id);
    
    // Adicionar sinal aos concluídos se não existir
    if (!userProgress.completedSigns.includes(signId)) {
        userProgress.completedSigns.push(signId);
        console.log('✅ Novo sinal concluído:', signId);
    }
    
    // Calcular nova precisão (simulação)
    const totalAttempts = userProgress.completedSigns.length * 3 + 1;
    const correctAttempts = userProgress.completedSigns.length * 3;
    userProgress.accuracy = Math.round((correctAttempts / totalAttempts) * 100);
    
    // Atualizar tempo de prática
    userProgress.practiceTime = (userProgress.practiceTime || 0) + 0.1;
    
    // Salvar progresso
    StorageManager.saveUserProgress(appState.user.id, userProgress);
    
    // Atualizar estatísticas na tela
    loadUserStats();
    
    showFeedback(`Progresso salvo! ${userProgress.completedSigns.length} sinais concluídos.`, 'success');
}


function loadUserStats() {
    const totalSigns = 9; // Total de sinais disponíveis
    
    if (!appState.user) {
        // Dados para usuário não logado
        document.getElementById('total-signs').textContent = totalSigns;
        document.getElementById('completed-signs').textContent = '0';
        document.getElementById('accuracy-rate').textContent = '0%';
        document.getElementById('practice-time').textContent = '0h';
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('progress-text').textContent = '0/' + totalSigns;
        return;
    }

    // Carregar dados reais do usuário
    const userProgress = StorageManager.loadUserProgress(appState.user.id);
    const completedCount = userProgress.completedSigns.length;
    
    document.getElementById('total-signs').textContent = totalSigns;
    document.getElementById('completed-signs').textContent = completedCount;
    document.getElementById('accuracy-rate').textContent = userProgress.accuracy + '%';
    document.getElementById('practice-time').textContent = userProgress.practiceTime.toFixed(1) + 'h';
    
    const progressPercent = (completedCount / totalSigns) * 100;
    document.getElementById('progress-bar').style.width = progressPercent + '%';
    document.getElementById('progress-text').textContent = `${completedCount}/${totalSigns}`;
    
    console.log('📈 Estatísticas carregadas:', { completedCount, accuracy: userProgress.accuracy });
}

// ===== HISTÓRICO =====
function loadHistory() {
    if (!appState.user) {
        const tableBody = document.getElementById('history-table-body');
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <p>Faça login para ver seu histórico</p>
                    <button class="btn btn-primary mt-2" onclick="showModal('login-modal')">
                        Fazer Login
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    const filter = document.getElementById('history-filter').value;
    let filteredHistory = sampleData.history;
    
    if (filter === 'completed') {
        filteredHistory = sampleData.history.filter(item => item.status === 'completed');
    } else if (filter === 'pending') {
        filteredHistory = sampleData.history.filter(item => item.status === 'pending');
    }
    
    renderHistoryTable(filteredHistory);
}

function renderHistoryTable(history) {
    const tableBody = document.getElementById('history-table-body');
    
    if (history.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum registro encontrado</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    history.forEach(item => {
        let statusClass = '', statusText = '';
        switch (item.status) {
            case 'completed': statusClass = 'status-completed'; statusText = 'Concluído'; break;
            case 'practice': statusClass = 'status-practice'; statusText = 'Em andamento'; break;
            case 'pending': statusClass = 'status-pending'; statusText = 'Pendente'; break;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${item.sign}</td>
            <td>${item.category}</td>
            <td>${item.correct}/${item.total}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

// ===== TUTORIAIS =====
function loadTutorials() {
    const tutorialsList = document.getElementById('tutorials-list');
    tutorialsList.innerHTML = '';
    
    const tutorialsByCategory = {};
    sampleData.signs.forEach(sign => {
        const category = appState.categories.find(cat => cat.id === sign.category_id);
        if (!tutorialsByCategory[category.name]) {
            tutorialsByCategory[category.name] = [];
        }
        tutorialsByCategory[category.name].push(sign);
    });
    
    for (const [categoryName, signs] of Object.entries(tutorialsByCategory)) {
        const categoryHeader = document.createElement('li');
        categoryHeader.innerHTML = `<strong>${categoryName}</strong>`;
        tutorialsList.appendChild(categoryHeader);
        
        signs.forEach(sign => {
            const tutorialItem = document.createElement('li');
            tutorialItem.innerHTML = `
                <a href="#" class="tutorial-link" data-sign-id="${sign.id}">
                    ${sign.name}
                </a>
            `;
            tutorialsList.appendChild(tutorialItem);
        });
    }
    
    document.querySelectorAll('.tutorial-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const signId = e.target.getAttribute('data-sign-id');
            loadTutorialDetail(signId);
            document.querySelectorAll('.tutorial-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

function loadTutorialDetail(signId) {
    const sign = sampleData.signs.find(s => s.id == signId);
    if (!sign) return;
    
    const tutorial = signTutorials[signId];
    
    document.getElementById('tutorial-placeholder').style.display = 'none';
    document.getElementById('tutorial-detail').style.display = 'block';
    document.getElementById('tutorial-title').textContent = sign.name;
    document.getElementById('tutorial-description').textContent = sign.description;
    
    // Atualizar a imagem do tutorial se disponível
    const tutorialVideo = document.getElementById('tutorial-video');
    if (sign.image) {
        // Substituir o vídeo por uma imagem estática
        tutorialVideo.style.display = 'none';
        
        // Criar ou atualizar elemento de imagem
        let tutorialImage = document.getElementById('tutorial-image');
        if (!tutorialImage) {
            tutorialImage = document.createElement('img');
            tutorialImage.id = 'tutorial-image';
            tutorialImage.className = 'tutorial-image';
            tutorialVideo.parentNode.insertBefore(tutorialImage, tutorialVideo);
        }
        tutorialImage.src = sign.image;
        tutorialImage.alt = `Demonstração do sinal ${sign.name}`;
        tutorialImage.style.display = 'block';
    }
    
    // Atualizar os passos do tutorial
    const tutorialSteps = document.querySelector('.tutorial-steps');
    if (tutorial && tutorial.steps) {
        tutorialSteps.innerHTML = '<h4>Passos para executar o sinal:</h4>';
        
        tutorial.steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'tutorial-step';
            stepElement.innerHTML = `
                <div class="step-number">${index + 1}</div>
                <div class="step-content">
                    <h4>${step.title}</h4>
                    <p>${step.description}</p>
                </div>
            `;
            tutorialSteps.appendChild(stepElement);
        });
    } else {
        // Tutorial padrão caso não have dados específicos
        tutorialSteps.innerHTML = `
            <h4>Passos para executar o sinal:</h4>
            <div class="tutorial-step">
                <div class="step-number">1</div>
                <div class="step-content">
                    <h4>Posição inicial</h4>
                    <p>Mantenha a mão relaxada ao lado do corpo</p>
                </div>
            </div>
            <div class="tutorial-step">
                <div class="step-number">2</div>
                <div class="step-content">
                    <h4>Forma da mão</h4>
                    <p>Feche a mão em forma de punho, com o polegar sobre os dedos</p>
                </div>
            </div>
            <div class="tutorial-step">
                <div class="step-number">3</div>
                <div class="step-content">
                    <h4>Movimento</h4>
                    <p>Levante a mão até a altura do peito, mantendo a forma</p>
                </div>
            </div>
        `;
    }
}

// ===== GERENCIAMENTO DE PERFIL =====
function setupProfilePage() {
    const profileForm = document.getElementById('profile-form');
    const backFromProfileBtn = document.getElementById('back-from-profile');
    
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    if (backFromProfileBtn) {
        backFromProfileBtn.addEventListener('click', () => showPage('home'));
    }
    
    // Máscara para CPF
    const cpfInput = document.getElementById('profile-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', formatCPF);
    }
    
    // Máscara para telefone
    const phoneInput = document.getElementById('profile-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhone);
    }
}

function formatCPF(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    
    e.target.value = value;
}

function formatCPF(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    
    e.target.value = value;
}

function formatPhone(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
    }
    
    e.target.value = value;
}

function loadProfileData() {
    if (!appState.user) return;
    
    const userData = JSON.parse(localStorage.getItem('motionpy_user_data') || '{}');
    const user = { ...appState.user, ...userData };
    
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-social-name').value = user.socialName || '';
    document.getElementById('profile-cpf').value = user.cpf || '';
    document.getElementById('profile-dob').value = user.dob || '';
    document.getElementById('profile-gender').value = user.gender || '';
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-email').value = user.email || '';
}


function handleProfileUpdate(e) {
    e.preventDefault();
    
    if (!appState.user) {
        showFeedback('Faça login para atualizar seu perfil', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    submitBtn.disabled = true;
    
    const formData = {
        name: document.getElementById('profile-name').value,
        socialName: document.getElementById('profile-social-name').value,
        cpf: document.getElementById('profile-cpf').value,
        dob: document.getElementById('profile-dob').value,
        gender: document.getElementById('profile-gender').value,
        phone: document.getElementById('profile-phone').value,
        email: document.getElementById('profile-email').value,
        updatedAt: new Date().toISOString()
    };
    
    setTimeout(() => {
        localStorage.setItem('motionpy_user_data', JSON.stringify(formData));
        appState.user = { ...appState.user, ...formData };
        localStorage.setItem('motionpy_user', JSON.stringify(appState.user));
        
        updateAuthButtons();
        showFeedback('Perfil atualizado com sucesso!', 'success');
        
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        showPage('home');
    }, 1000);
}

// ===== ATUALIZAÇÃO DA AUTENTICAÇÃO =====
function updateAuthButtons() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const profileNavLink = document.getElementById('profile-nav-link');
    
    if (appState.user) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'flex';
        if (profileNavLink) {
            profileNavLink.style.display = 'block';
            profileNavLink.innerHTML = `<i class="fas fa-user"></i> ${appState.user.name}`;
        }
    } else {
        loginBtn.style.display = 'flex';
        logoutBtn.style.display = 'none';
        if (profileNavLink) {
            profileNavLink.style.display = 'none';
        }
    }
}
// ===== LOGOUT =====
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

function handleLogout() {
    appState.user = null;
    localStorage.removeItem('motionpy_user');
    updateAuthButtons();
    showPage('home');
    showFeedback('Logout realizado com sucesso!', 'success');
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.getAttribute('data-page');
            showPage(page);
        });
    });

    document.getElementById('login-btn').addEventListener('click', () => showModal('login-modal'));
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('login-modal');
        showModal('register-modal');
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('register-modal');
        showModal('login-modal');
    });

    document.getElementById('close-login-modal').addEventListener('click', () => hideModal('login-modal'));
    document.getElementById('close-register-modal').addEventListener('click', () => hideModal('register-modal'));

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    document.getElementById('start-learning-btn').addEventListener('click', () => showPage('practice'));
    document.getElementById('enable-camera-btn').addEventListener('click', startCamera);
    document.getElementById('check-sign-btn').addEventListener('click', checkSign);
    document.getElementById('back-home-btn').addEventListener('click', () => showPage('home'));
    document.getElementById('back-from-history').addEventListener('click', () => showPage('home'));
    document.getElementById('back-from-tutorial').addEventListener('click', () => showPage('home'));

    document.getElementById('category-select').addEventListener('change', loadSignsByCategory);
    document.getElementById('sign-select').addEventListener('change', selectSign);
    document.getElementById('dark-mode-toggle').addEventListener('change', toggleDarkMode);

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal.id);
        });
    });
}

// ===== ATUALIZAÇÃO DA FUNÇÃO SHOWPAGE =====
function showPage(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');
    appState.currentPage = pageName;

    if (pageName === 'practice') {
        loadPracticeCategories();
        stopCamera();
    } else if (pageName === 'history') {
        loadHistory();
    } else if (pageName === 'tutorial') {
        loadTutorials();
    } else if (pageName === 'profile') {
        loadProfileData(); // ← Carrega dados quando a página de perfil é aberta
    }
}

function formatCPF(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    
    e.target.value = value;
}

function formatPhone(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
    }
    
    e.target.value = value;
}

function openProfileModal() {
    loadProfileData();
    showModal('profile-modal');
}

function loadProfileData() {
    if (!appState.user) return;
    
    // Carrega dados do localStorage ou usa dados padrão
    const userData = JSON.parse(localStorage.getItem('motionpy_user_data') || '{}');
    const user = { ...appState.user, ...userData };
    
    // Preenche o formulário
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-social-name').value = user.socialName || '';
    document.getElementById('profile-cpf').value = user.cpf || '';
    document.getElementById('profile-dob').value = user.dob || '';
    document.getElementById('profile-gender').value = user.gender || '';
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-email').value = user.email || '';
}

function handleProfileUpdate(e) {
    e.preventDefault();
    
    if (!appState.user) {
        showFeedback('Faça login para atualizar seu perfil', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Mostra loading
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    submitBtn.disabled = true;
    
    // Coleta os dados do formulário
    const formData = {
        name: document.getElementById('profile-name').value,
        socialName: document.getElementById('profile-social-name').value,
        cpf: document.getElementById('profile-cpf').value,
        dob: document.getElementById('profile-dob').value,
        gender: document.getElementById('profile-gender').value,
        phone: document.getElementById('profile-phone').value,
        email: document.getElementById('profile-email').value,
        updatedAt: new Date().toISOString()
    };
    
    // Simula salvamento (substitua por API real)
    setTimeout(() => {
        // Salva no localStorage
        localStorage.setItem('motionpy_user_data', JSON.stringify(formData));
        
        // Atualiza o estado do app
        appState.user = { ...appState.user, ...formData };
        localStorage.setItem('motionpy_user', JSON.stringify(appState.user));
        
        // Atualiza a UI
        updateAuthButtons();
        
        // Feedback de sucesso
        showFeedback('Perfil atualizado com sucesso!', 'success');
        
        // Restaura o botão
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Fecha o modal
        hideModal('profile-modal');
    }, 1000);
}

// ===== TEMA ESCURO =====
function toggleDarkMode() {
    if (appState.isDarkMode) disableDarkMode();
    else enableDarkMode();
}

function enableDarkMode() {
    document.body.classList.add('dark-mode');
    appState.isDarkMode = true;
    localStorage.setItem('motionpy_theme', 'dark');
    document.getElementById('dark-mode-toggle').checked = true;
}

function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    appState.isDarkMode = false;
    localStorage.setItem('motionpy_theme', 'light');
    document.getElementById('dark-mode-toggle').checked = false;
}

// ===== UTILITÁRIOS =====
function formatDate(dateString) {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
}

// dúvidas frequentes//

document.addEventListener('DOMContentLoaded', function() {
  const questions = document.querySelectorAll('.faq-question');
  
  questions.forEach(question => {
    question.addEventListener('click', function() {
      // Fecha todas as respostas
      questions.forEach(q => {
        if (q !== question) {
          q.classList.remove('active');
          q.nextElementSibling.style.maxHeight = null;
        }
      });
      
      // Alterna estado atual
      this.classList.toggle('active');
      const answer = this.nextElementSibling;
      
      if (answer.style.maxHeight) {
        answer.style.maxHeight = null;
      } else {
        answer.style.maxHeight = answer.scrollHeight + "px";
      }

      
    });

  });
  
});