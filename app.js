// script.js

// 1. INICIALIZAR ICONOS
lucide.createIcons();

// 2. TEXTO ROTATIVO (CORREGIDO Y PROBADO)
const words = [
    "CALMA", "FUERZA", "EQUILIBRIO", "CONEXIÓN",
    "MOVIMIENTO", "SANACIÓN", "YOGA", "ARMONÍA",
    "BIENESTAR", "RESPIRACIÓN", "PAZ", "MEDITACIÓN"
];

let wordIndex = 0;
const textElement = document.getElementById("dynamic-text");

function changeWord() {
    if (!textElement) return;

    // 1. Desvanecer
    textElement.style.opacity = "0";
    textElement.style.transform = "translateY(10px)"; // Pequeño movimiento hacia abajo

    // 2. Cambiar texto y reaparecer después de 500ms
    setTimeout(() => {
        wordIndex = (wordIndex + 1) % words.length;
        textElement.innerText = words[wordIndex];

        // Reaparecer
        textElement.style.opacity = "1";
        textElement.style.transform = "translateY(0)";
    }, 500);
}

// Iniciar intervalo cada 3 segundos
if (textElement) {
    setInterval(changeWord, 3000);
}


// 3. SISTEMA DE MODALES (Gestión de apertura/cierre)
const modalOverlay = document.getElementById('modal-overlay');
const modalContents = document.querySelectorAll('.modal-content');

window.openModal = function (modalId) {
    // Resetear
    modalContents.forEach(el => el.classList.add('hidden'));

    const target = document.getElementById(`modal-${modalId}`);
    if (target) {
        target.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');

        // Pequeño delay para permitir transición CSS
        setTimeout(() => {
            modalOverlay.classList.remove('opacity-0');
        }, 10);
    }
}

window.closeModal = function () {
    modalOverlay.classList.add('opacity-0');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        modalContents.forEach(el => el.classList.add('hidden'));
    }, 300);
}

// Cerrar con tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Cerrar click fuera
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}