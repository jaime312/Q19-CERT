// script.js

// --- CONFIGURACIÓN SUPABASE ---
const SUPA_URL = 'https://jkjifmrrlyncuwpjhxvk.supabase.co';
const SUPA_KEY = 'sb_publishable_xnIELom1ouXaBDJNYaWDAQ_VJNjlnIK';
const client = window.supabase?.createClient ? window.supabase.createClient(SUPA_URL, SUPA_KEY) : null;

document.addEventListener('DOMContentLoaded', () => {
    // Platform detection (simplificado)
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;
    const isAndroid = /android/.test(ua);
    document.body.classList.add(isIOS ? 'platform-ios' : (isAndroid ? 'platform-android' : 'platform-web'));

    if (!isIOS && !isAndroid) {
        const cursor = document.createElement('div');
        cursor.classList.add('wink-cursor');
        cursor.innerText = '🧘🏼';
        document.body.appendChild(cursor);

        const cursorGlow = document.createElement('div');
        cursorGlow.classList.add('cursor-glow');
        document.body.appendChild(cursorGlow);
        
        const parallaxBg = document.getElementById('parallax-bg');

        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';

            // Glow softly trails the cursor
            cursorGlow.style.left = e.clientX + 'px';
            cursorGlow.style.top = e.clientY + 'px';

            if (parallaxBg) {
                const x = (e.clientX / window.innerWidth - 0.5) * 40;
                const y = (e.clientY / window.innerHeight - 0.5) * 40;
                parallaxBg.style.transform = `translate(${x}px, ${y}px)`;
            }
        });

        document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
        document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
        document.addEventListener('mouseout', (e) => { 
            if (!e.relatedTarget) {
                cursor.style.display = 'none'; 
                cursorGlow.style.display = 'none';
            }
        });
        document.addEventListener('mouseover', () => {
            cursor.style.display = 'block';
            cursorGlow.style.display = 'block';
        });
    }

    fetchClasesLanding();
    fetchProfesionalesLanding();
});

// 2. SISTEMA DE MODALES
const modalOverlay = document.getElementById('modal-overlay');
const modalContents = document.querySelectorAll('.modal-content');

window.openModal = function (modalId) {
    modalContents.forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`modal-${modalId}`);
    if (target) {
        target.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');
        setTimeout(() => modalOverlay.classList.remove('opacity-0'), 10);
        history.pushState({ modalOpen: true }, "", `#${modalId}`);
    }
}

window.closeModal = function () {
    modalOverlay.classList.add('opacity-0');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        modalContents.forEach(el => el.classList.add('hidden'));
    }, 300);
    if (window.location.hash) history.replaceState(null, "", " ");
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

window.addEventListener('popstate', () => {
    if (!modalOverlay.classList.contains('hidden')) {
        modalOverlay.classList.add('opacity-0');
        setTimeout(() => {
            modalOverlay.classList.add('hidden');
            modalContents.forEach(el => el.classList.add('hidden'));
        }, 300);
    }
});

if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}



// 4. HOVER IMAGES (solo escritorio)
window.showHoverImage = function (side, imgName) {
    const container = document.getElementById('center-hover-image-container');
    const symbolsContent = document.getElementById('central-symbols');
    
    if (container && symbolsContent) {
        const images = container.querySelectorAll('img');
        images.forEach(img => img.classList.add('hidden'));

        // Show specific image
        const targetImg = document.getElementById(`img-${imgName}`);
        if (targetImg) {
            targetImg.classList.remove('hidden');
        }

        // Add active class to image container to trigger animation
        container.classList.add('active');
        
        // Fade out symbols
        symbolsContent.classList.remove('opacity-100', 'scale-100');
        symbolsContent.classList.add('opacity-0', 'scale-95');
    }
}

window.hideHoverImage = function (side) {
    const container = document.getElementById('center-hover-image-container');
    const symbolsContent = document.getElementById('central-symbols');
    
    if (container && symbolsContent) {
        container.classList.remove('active');
        
        symbolsContent.classList.remove('opacity-0', 'scale-95');
        symbolsContent.classList.add('opacity-100', 'scale-100');
    }
}

// 4.5. FEEDBACK DE NAVEGACIÓN
window.handleNavClick = function (btn, url) {
    // Añadir feedback visual
    if (btn.classList.contains('btn-nav-mobile')) {
        // En móvil, forzamos que se quede pulsado y cambiamos fondo
        btn.classList.add('scale-95', 'bg-white/40', 'border-white/60');
        // Cambiar icono a spinner
        const icon = btn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'loader-2');
            icon.classList.add('animate-spin');
            if (window.lucide) window.lucide.createIcons();
        }
    } else {
        // En escritorio, bajamos opacidad y escalamos el texto
        const span = btn.querySelector('.nav-link-strike');
        if (span) {
            span.style.transition = 'all 0.3s ease';
            span.style.opacity = '0.5';
            span.style.transform = 'scale(0.95)';
        } else {
            // Feedback genérico para otros botones (como Reservar)
            btn.style.transition = 'all 0.2s ease';
            btn.style.opacity = '0.6';
            btn.style.transform = 'scale(0.95)';
        }
    }
    
    // Retardo pequeño para asegurar que se percibe el feedback antes de navegar
    setTimeout(() => {
        location.href = url;
    }, 150);
}

// 5. DATOS DINÁMICOS (Supabase)

let allClasesLandingCache = [];

function escapeHtmlPublic(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function truncateText(text, max = 150) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max).trim()}...`;
}

window.mostrarFuncionEnPruebasPublica = function () {
    alert('Esta función está en periodo de pruebas y aún no está disponible.');
};

async function fetchClasesLanding() {
    const container = document.getElementById('landing-clases-container');
    if (!container) return;
    if (!client) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-2 opacity-60">
            <p class="text-center text-cocoa text-sm">No se pudieron cargar las sesiones en este momento.</p>
        </div>`;
        return;
    }

    console.log("Fetching classes (no date filter on DB)...");

    // Traemos solo clases desde hoy - 2 horas para optimizar
    const now = new Date();
    now.setHours(now.getHours() - 2);
    const nowIso = now.toISOString();

    const { data: clases, error } = await client
        .from('clases')
        .select('*, profesionales(*)')
        .gte('fecha_inicio', nowIso)
        .order('fecha_inicio', { ascending: true })
        .limit(50);

    if (error) {
        console.error('Error fetching classes:', error);
        container.innerHTML = `<div class="p-4 bg-red-50 border border-red-100 rounded-lg text-red-800 text-center">
            <p class="font-bold">No se pudieron cargar las clases</p>
        </div>`;
        return;
    }

    if (!clases || clases.length === 0) {
        // Si llega aquí sin error, es que la tabla está vacía O RLS está bloqueando la lectura pública
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-2 opacity-60">
            <i data-lucide="calendar-x" class="w-8 h-8 text-cocoa"></i>
            <p class="text-center text-cocoa text-sm">No hay clases programadas en este momento.</p>
        </div>`;
        lucide.createIcons();
        return;
    }

    // Filtrar en cliente: Solo futuras (o de hoy)
    // Usamos el 'now' ya declarado arriba

    const clasesFuturas = clases.filter(c => {
        const fecha = new Date(c.fecha_inicio);
        return fecha >= now;
    });

    if (clasesFuturas.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-2 opacity-60">
            <i data-lucide="calendar-x" class="w-8 h-8 text-cocoa"></i>
            <p class="text-center text-cocoa text-sm">No hay clases próximas.</p>
        </div>`;
        lucide.createIcons();
        return;
    }

    allClasesLandingCache = clasesFuturas;
    filtrarClasesLanding('todos');
}

window.filtrarClasesLanding = function(category) {
    const buttons = {
        todos: document.getElementById('btn-filtro-clases-todos'),
        yoga: document.getElementById('btn-filtro-clases-yoga'),
        psicologia: document.getElementById('btn-filtro-clases-psicologia'),
        nutricion: document.getElementById('btn-filtro-clases-nutricion')
    };

    // Reset button styles
    Object.keys(buttons).forEach(key => {
        const btn = buttons[key];
        if (btn) {
            btn.className = "px-5 py-2.5 text-xs uppercase tracking-wider font-bold rounded-full bg-white/20 text-white hover:bg-white/30 transition border border-white/10 hover:scale-105 active:scale-95";
        }
    });

    // Set active button style
    const activeBtn = buttons[category];
    if (activeBtn) {
        activeBtn.className = "px-5 py-2.5 text-xs uppercase tracking-wider font-bold rounded-full bg-white text-cocoa transition border border-white/20 shadow-sm hover:scale-105 active:scale-95";
    }

    let filtrados = allClasesLandingCache;
    if (category === 'yoga') {
        filtrados = allClasesLandingCache.filter(c => c.tipo_clase === 'yoga' || !c.tipo_clase);
    } else if (category === 'psicologia') {
        // Consultas: psicología + nutrición
        filtrados = allClasesLandingCache.filter(c => c.tipo_clase === 'psicologia' || c.tipo_clase === 'nutricion');
    } else if (category === 'nutricion') {
        // Talleres: taller
        filtrados = allClasesLandingCache.filter(c => c.tipo_clase === 'taller');
    }

    renderClassesLanding(filtrados.slice(0, 20));
}

function renderClassesLanding(clases) {
    const container = document.getElementById('landing-clases-container');
    container.innerHTML = '';

    if (!clases || clases.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 gap-2 opacity-60 w-full col-span-full">
                <i data-lucide="calendar-x" class="w-8 h-8 text-cocoa"></i>
                <p class="text-center text-cocoa text-sm">No hay clases programadas en este momento.</p>
            </div>
        `;
        if (window.lucide) {
            lucide.createIcons();
        }
        return;
    }

    clases.forEach(clase => {
        const fecha = new Date(clase.fecha_inicio);
        const horaStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const diaStr = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });

        const profName = clase.profesionales ? clase.profesionales.nombre : 'Staff';
        const tipo = (clase.tipo_clase || 'yoga').toLowerCase();
        const accionNoDisponible = tipo === 'psicologia' || tipo === 'nutricion' || tipo === 'taller';
        const botonTexto = tipo === 'taller' ? 'Ver talleres' : (tipo === 'psicologia' || tipo === 'nutricion' ? 'Reservar cita' : 'Reservar');
        const botonAccion = accionNoDisponible ? 'mostrarFuncionEnPruebasPublica()' : "handleNavClick(this, 'profile.html')";

        const card = document.createElement('div');
        card.className = "flex flex-col md:flex-row items-center justify-between p-8 border border-cocoa/10 hover:border-olive/50 hover:bg-cocoa/5 transition duration-300 group cursor-pointer";
        card.innerHTML = `
            <div class="flex items-center gap-8 w-full md:w-auto">
                <div class="flex flex-col items-center text-olive group-hover:text-cocoa transition min-w-[80px]">
                    <span class="text-3xl font-serif leading-none">${horaStr}</span>
                    <span class="text-xs uppercase tracking-widest opacity-60 mt-1 text-center">${diaStr}</span>
                </div>
                <div class="text-left">
                    <span class="block text-xl uppercase tracking-widest font-light text-cocoa">${clase.nombre}</span>
                    <span class="text-sm text-slate capitalize">Sala Aire • ${clase.duracion_min || 60} min</span>
                </div>
            </div>
            <div class="mt-4 md:mt-0 flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                <span class="text-lg font-serif italic text-cocoa/60 text-right md:text-left">con ${profName}</span>
                <button onclick="${botonAccion}" class="px-6 py-2 bg-terracotta text-ivory text-xs uppercase tracking-widest hover:bg-cocoa hover:text-white transition rounded-full text-center cursor-pointer inline-block">${botonTexto}</button>
            </div>
        `;
        container.appendChild(card);
    });
}

let allProfesionalesLanding = [];

async function fetchProfesionalesLanding() {
    const container = document.getElementById('landing-profesores-container');
    if (!container) return;
    if (!client) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-10 gap-2 opacity-60">
             <p class="text-center text-cocoa text-sm">No se pudieron cargar los profesionales en este momento.</p>
        </div>`;
        return;
    }

    const { data: profesionales, error } = await client
        .from('profesionales')
        .select('*')
        .order('nombre');

    if (error) {
        console.error('Error fetching professionals:', error);
        container.innerHTML = `<div class="col-span-full p-4 bg-red-50 border border-red-100 rounded-lg text-red-800 text-center">
            <p class="font-bold">No se pudieron cargar los profesionales</p>
        </div>`;
        return;
    }

    if (!profesionales || profesionales.length === 0) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-10 gap-2 opacity-60">
            <i data-lucide="users" class="w-8 h-8 text-cocoa"></i>
             <p class="text-center text-cocoa text-sm">No hay profesionales registrados en este momento.</p>
        </div>`;
        lucide.createIcons();
        return;
    }

    allProfesionalesLanding = profesionales;

    // Check query param 'cat'
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('cat') || 'todos';
    filtrarProfesionalesLanding(catParam);
}

window.filtrarProfesionalesLanding = function(category) {
    const selectedCategory = category === 'nutricion' ? 'talleres' : category;
    const buttons = {
        todos: document.getElementById('btn-filtro-prof-todos'),
        yoga: document.getElementById('btn-filtro-prof-yoga'),
        psicologia: document.getElementById('btn-filtro-prof-psicologia'),
        talleres: document.getElementById('btn-filtro-prof-talleres') || document.getElementById('btn-filtro-prof-nutricion')
    };

    // Reset button styles
    Object.keys(buttons).forEach(key => {
        const btn = buttons[key];
        if (btn) {
            btn.className = "px-5 py-2.5 text-xs uppercase tracking-wider font-bold rounded-full bg-white/20 text-white hover:bg-white/30 transition border border-white/10 hover:scale-105 active:scale-95";
        }
    });

    // Set active button style
    const activeBtn = buttons[selectedCategory];
    if (activeBtn) {
        activeBtn.className = "px-5 py-2.5 text-xs uppercase tracking-wider font-bold rounded-full bg-white text-cocoa transition border border-white/20 shadow-sm hover:scale-105 active:scale-95";
    }

    let filtrados = allProfesionalesLanding;
    if (selectedCategory === 'yoga') {
        filtrados = allProfesionalesLanding.filter(p => {
            const esp = (p.especialidad || '').toLowerCase();
            return esp.includes('yoga') || esp.includes('vinyasa') || esp.includes('hatha') || esp.includes('instructor') || esp.includes('clase');
        });
    } else if (selectedCategory === 'psicologia') {
        filtrados = allProfesionalesLanding.filter(p => {
            const esp = (p.especialidad || '').toLowerCase();
            return esp.includes('consulta') || esp.includes('psico') || esp.includes('terapia') || esp.includes('nutri') || esp.includes('diet') || esp.includes('alimen');
        });
    } else if (selectedCategory === 'talleres') {
        filtrados = allProfesionalesLanding.filter(p => {
            const esp = (p.especialidad || '').toLowerCase();
            return esp.includes('taller') || esp.includes('workshop');
        });
    }

    renderProfesionalesLanding(filtrados);
}

function parseBio(text) {
    const sections = {
        lugar: '',
        titulos: [],
        sobreMi: [],
        teAcompano: [],
        meDefine: ''
    };
    if (!text) return sections;

    const normalized = text.replace(/\r\n/g, '\n');
    const parts = normalized.split(/\n?(LUGAR DE NACIMIENTO|TITULACIONES|SOBRE MI|SOBRE MÍ|TE ACOMPAÑO|ME DEFINE):?\s*/i);
    
    for (let i = 1; i < parts.length; i += 2) {
        const header = parts[i].toUpperCase();
        const content = parts[i+1] ? parts[i+1].trim() : '';
        if (header.includes('LUGAR')) {
            sections.lugar = content.replace(/,$/, '').trim();
        } else if (header.includes('TITULACION')) {
            sections.titulos = content.split('\n').map(l => l.replace(/^[\s*\-•]+/g, '').trim()).filter(Boolean);
        } else if (header.includes('SOBRE')) {
            sections.sobreMi = content.split('\n').map(p => p.trim()).filter(Boolean);
        } else if (header.includes('ACOMPA')) {
            sections.teAcompano = content.split('\n').map(l => l.replace(/^[\s*\-•*]+/g, '').trim()).filter(Boolean);
        } else if (header.includes('DEFINE')) {
            sections.meDefine = content.replace(/^["'“”«»]+/g, '').replace(/["'“”«»]+$/g, '').trim();
        }
    }
    return sections;
}

function renderProfesionalDetalleLanding(prof, parsed) {
    const titulos = parsed.titulos.length
        ? `<div class="mt-4 space-y-2">
            ${parsed.titulos.map(t => `<p class="text-xs text-cocoa/60 flex items-start gap-2"><i class="ph ph-graduation-cap text-olive mt-0.5"></i><span>${escapeHtmlPublic(t)}</span></p>`).join('')}
           </div>`
        : '';

    const sobre = parsed.sobreMi.length
        ? parsed.sobreMi.map(p => `<p class="text-sm text-cocoa/70 leading-relaxed">${escapeHtmlPublic(p)}</p>`).join('')
        : `<p class="text-sm text-cocoa/70 leading-relaxed">${escapeHtmlPublic(prof.descripcion || prof.bio || 'Profesional de GEN Yoga.')}</p>`;

    const acompano = parsed.teAcompano.length
        ? `<div class="mt-4 grid gap-2">
            ${parsed.teAcompano.slice(0, 6).map(item => `<p class="text-xs text-cocoa/60 flex items-start gap-2"><span class="text-olive">•</span><span>${escapeHtmlPublic(item)}</span></p>`).join('')}
           </div>`
        : '';

    const define = parsed.meDefine
        ? `<p class="mt-4 text-sm italic text-cocoa/70 border-t border-cocoa/10 pt-4">${escapeHtmlPublic(parsed.meDefine)}</p>`
        : '';

    return `${titulos}<div class="mt-4 space-y-3">${sobre}</div>${acompano}${define}`;
}

function truncateTextLanding(text, max = 180) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max).trim()}...`;
}

window.toggleProfesorDetalle = function(cardId) {
    const detailsDiv = document.getElementById(`details-${cardId}`);
    const btnSpan = document.querySelector(`#btn-toggle-${cardId} span`);
    const btnIcon = document.getElementById(`icon-toggle-${cardId}`);
    
    if (detailsDiv) {
        const isHidden = detailsDiv.classList.contains('hidden');
        if (isHidden) {
            detailsDiv.classList.remove('hidden');
            if (btnSpan) btnSpan.textContent = 'Saber menos';
            if (btnIcon) {
                btnIcon.classList.remove('ph-caret-down');
                btnIcon.classList.add('ph-caret-up');
            }
        } else {
            detailsDiv.classList.add('hidden');
            if (btnSpan) btnSpan.textContent = 'Saber más';
            if (btnIcon) {
                btnIcon.classList.remove('ph-caret-up');
                btnIcon.classList.add('ph-caret-down');
            }
        }
    }
};

function renderProfesionalesLanding(profesionales) {
    const container = document.getElementById('landing-profesores-container');
    if (!container) return;
    container.innerHTML = '';

    if (profesionales.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-white/80 italic py-10">
            No hay profesionales registrados en esta categoría.
        </div>`;
        return;
    }

    const filtersDiv = container.previousElementSibling;
    if (filtersDiv && filtersDiv.tagName === 'DIV') {
        filtersDiv.style.display = 'flex';
    }

    container.className = "flex flex-wrap justify-center gap-8 w-full";

    profesionales.forEach((prof, index) => {
        const parsed = parseBio(prof.descripcion || prof.bio || '');
        const fotoUrl = prof.foto_url || null;
        const cardId = prof.id || `idx-${index}`;
        const nombre = `${prof.nombre || ''} ${prof.apellidos || ''}`.trim() || 'Profesional';
        const lugar = parsed.lugar
            ? `<span class="block text-xs uppercase tracking-widest text-sand/70 mt-1">${escapeHtmlPublic(parsed.lugar)}</span>`
            : '';

        const avatarHtml = fotoUrl
            ? `<img src="${escapeHtmlPublic(fotoUrl)}" alt="${escapeHtmlPublic(nombre)}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full bg-white/10 flex items-center justify-center text-white text-4xl font-serif">${escapeHtmlPublic(nombre.charAt(0))}</div>`;

        const fullBio = parsed.sobreMi.join(' ');
        const bioText = truncateTextLanding(fullBio || prof.descripcion || prof.bio || 'Profesional de GEN Yoga.', 180);

        const titulosParagraphs = parsed.titulos.length
            ? parsed.titulos.map(t => `<p class="flex items-start gap-1.5"><span class="text-sand text-sm font-bold leading-none">•</span><span>${escapeHtmlPublic(t)}</span></p>`).join('')
            : '';

        const acompanoParagraphs = parsed.teAcompano.length
            ? parsed.teAcompano.map(item => `<p class="flex items-start gap-1.5"><span class="text-sand text-sm font-bold leading-none">•</span><span>${escapeHtmlPublic(item)}</span></p>`).join('')
            : '';

        const defineText = parsed.meDefine ? `"${escapeHtmlPublic(parsed.meDefine)}"` : '';

        const card = document.createElement('div');
        card.className = "bg-transparent rounded-[32px] p-6 border border-white/10 text-center w-full sm:w-[320px] md:w-[340px] flex flex-col justify-between min-h-[460px] transition-all duration-300 hover:scale-[1.015]";
        card.innerHTML = `
            <div class="flex flex-col items-center flex-grow w-full">
                <!-- Elegant Square Image Frame (matching Silvia's 250x250 size) -->
                <div class="rounded-3xl overflow-hidden shadow-sm bg-white border-2 border-white mb-4 relative flex-shrink-0" style="width: 250px; height: 250px; outline: 1px solid rgba(255,255,255,0.15);">
                    ${avatarHtml}
                </div>
                <h3 class="text-3xl font-serif text-white leading-tight font-bold">${escapeHtmlPublic(nombre)}</h3>
                <p class="text-xs uppercase tracking-widest text-sand font-bold mt-1.5">${escapeHtmlPublic(prof.especialidad || 'Profesional')}</p>
                ${lugar}

                <!-- Bio Short -->
                <p class="text-sm md:text-[15px] text-white/90 leading-relaxed font-normal mt-4 text-center">
                    ${bioText}
                </p>

                <!-- Collapsible Details -->
                <div id="details-${cardId}" class="hidden w-full mt-4 pt-4 border-t border-white/10 text-left space-y-4">
                    <!-- Bio Completa (párrafos adicionales) -->
                    ${parsed.sobreMi.length > 1 ? `
                    <div class="space-y-2 text-sm text-white/80 font-normal leading-relaxed">
                        ${parsed.sobreMi.slice(1).map(p => `<p>${escapeHtmlPublic(p)}</p>`).join('')}
                    </div>` : ''}

                    <!-- Titulaciones -->
                    ${titulosParagraphs ? `
                    <div>
                        <h4 class="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 flex items-center gap-1">
                            <i class="ph-bold ph-graduation-cap text-sand"></i> Titulaciones
                        </h4>
                        <div class="space-y-1 text-sm text-white/80">
                            ${titulosParagraphs}
                        </div>
                    </div>` : ''}

                    <!-- Ámbitos de Sesión -->
                    ${acompanoParagraphs ? `
                    <div>
                        <h4 class="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 flex items-center gap-1">
                            <i class="ph-bold ph-heart text-sand"></i> Ámbitos de Sesión
                        </h4>
                        <div class="space-y-1 text-sm text-white/80">
                            ${acompanoParagraphs}
                        </div>
                    </div>` : ''}
                </div>

                <!-- Toggle Button -->
                <button onclick="toggleProfesorDetalle('${cardId}')" id="btn-toggle-${cardId}" class="mt-4 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition w-full flex items-center justify-center gap-1.5">
                    <span>Saber más</span>
                    <i id="icon-toggle-${cardId}" class="ph-bold ph-caret-down"></i>
                </button>
            </div>

            <!-- Quote / Define at the bottom -->
            ${defineText ? `
            <div class="w-full mt-6 pt-4 border-t border-white/10 text-sm italic text-white/70 text-center font-serif leading-relaxed">
                ${defineText}
            </div>` : ''}
        `;
        container.appendChild(card);
    });
}
