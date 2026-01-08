/**
 * LAB LISTRIK PRO - FINAL ENGINE FIXED
 */
const CONFIG = {
    snapSize: 100,
    threshold: 60,
    touchTolerance: 105 // Jarak maksimal komponen dianggap bersentuhan
};

// State: Drag & Drop Handlers
const allowDrop = (e) => e.preventDefault();
const drag = (e) => e.dataTransfer.setData("type", e.target.getAttribute("data-type"));

function drop(e) {
    e.preventDefault();
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const type = e.dataTransfer.getData("type");
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    createComponent(type, x, y);
}

/**
 * KOMPONEN BUILDER
 */
function createComponent(type, x, y) {
    const id = `comp_${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'placed-comp';
    div.id = id;
    div.dataset.type = type;
    div.dataset.state = (type === 'switch') ? 'off' : 'on';
    div.dataset.rotation = 0;

    const icons = { battery: '🔋', bulb: '💡', switch: '🔌', wire: '➖' };
    
    div.innerHTML = `
        <div class="rotate-handle"></div>
        <div class="comp-icon">${icons[type]}</div>
        <div class="comp-label">${type.toUpperCase()}</div>
        ${type === 'switch' ? `<button class="switch-btn" onclick="toggleSwitch('${id}')">OFF</button>` : ''}
    `;

    document.getElementById('canvas').appendChild(div);
    div.style.left = `${x - 50}px`;
    div.style.top = `${y - 50}px`;

    initDraggable(div);
    initRotatable(div);
    updatePhysics(); // Cek arus setiap ada benda baru
}

/**
 * LOGIKA INTERAKSI & GERAK
 */
window.toggleSwitch = (id) => {
    const el = document.getElementById(id);
    const btn = el.querySelector('.switch-btn');
    const newState = el.dataset.state === 'off' ? 'on' : 'off';
    el.dataset.state = newState;
    btn.innerText = newState.toUpperCase();
    btn.classList.toggle('switch-on', newState === 'on');
    updatePhysics();
};

function initDraggable(el) {
    el.onmousedown = function(e) {
        if (e.target.closest('.switch-btn') || e.target.closest('.rotate-handle')) return;
        el.style.zIndex = 1000;
        const shiftX = e.clientX - el.getBoundingClientRect().left;
        const shiftY = e.clientY - el.getBoundingClientRect().top;

        function move(e) {
            const canvas = document.getElementById('canvas');
            const cRect = canvas.getBoundingClientRect();
            let nX = e.clientX - shiftX - cRect.left;
            let nY = e.clientY - shiftY - cRect.top;

            // Snapping logic
            const others = document.querySelectorAll('.placed-comp');
            el.classList.remove('snapped');
            others.forEach(other => {
                if (other === el) return;
                const ox = parseInt(other.style.left);
                const oy = parseInt(other.style.top);
                if (Math.abs(nX - ox) < CONFIG.threshold && Math.abs(nY - oy) < 30) {
                    nY = oy; nX = (nX > ox) ? ox + CONFIG.snapSize : ox - CONFIG.snapSize;
                    el.classList.add('snapped');
                } else if (Math.abs(nY - oy) < CONFIG.threshold && Math.abs(nX - ox) < 30) {
                    nX = ox; nY = (nY > oy) ? oy + CONFIG.snapSize : oy - CONFIG.snapSize;
                    el.classList.add('snapped');
                }
            });
            el.style.left = `${nX}px`; el.style.top = `${nY}px`;
        }

        document.addEventListener('mousemove', move);
        document.onmouseup = () => {
            document.removeEventListener('mousemove', move);
            el.style.zIndex = 5;
            updatePhysics();
            document.onmouseup = null;
        };
    };
    // Hapus dengan klik kanan
    el.oncontextmenu = (e) => { e.preventDefault(); el.remove(); updatePhysics(); };
}

function initRotatable(el) {
    const handle = el.querySelector('.rotate-handle');
    handle.onmousedown = (e) => {
        e.stopPropagation();
        const onRotate = (ev) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const rad = Math.atan2(ev.clientX - cx, -(ev.clientY - cy));
            const deg = Math.round(rad * (180 / Math.PI));
            el.style.transform = `rotate(${deg}deg)`;
            el.dataset.rotation = deg;
        };
        document.addEventListener('mousemove', onRotate);
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onRotate);
            updatePhysics();
        }, { once: true });
    };
}

/**
 * PHYSICS ENGINE: LOGIKA KONEKSI KETAT
 */
function updatePhysics() {
    const allComps = Array.from(document.querySelectorAll('.placed-comp'));
    
    // 1. Reset Semua Lampu (Matikan Dulu)
    allComps.forEach(c => {
        if(c.dataset.type === 'bulb') c.classList.remove('bulb-on');
    });

    const batteries = allComps.filter(c => c.dataset.type === 'battery');
    if (batteries.length === 0) return setStatusUI(false);

    // 2. Breadth-First Search (BFS) dari sumber Baterai
    let energized = new Set();
    let queue = [...batteries];
    
    // Tandai baterai sebagai sumber energi awal
    batteries.forEach(b => energized.add(b.id));

    while (queue.length > 0) {
        let current = queue.shift();
        
        allComps.forEach(target => {
            // Jika target belum dialiri DAN target menyentuh komponen yang sedang dicek
            if (!energized.has(target.id) && checkCollision(current, target)) {
                
                // Cek hambatan (Saklar OFF)
                if (target.dataset.type === 'switch' && target.dataset.state === 'off') {
                    // Listrik berhenti di sini, jangan masukkan ke queue
                } else {
                    energized.add(target.id);
                    queue.push(target);
                }
            }
        });
    }

    // 3. Visualisasikan Hasil
    let isAnyBulbOn = false;
    energized.forEach(id => {
        const comp = document.getElementById(id);
        if (comp && comp.dataset.type === 'bulb') {
            comp.classList.add('bulb-on');
            isAnyBulbOn = true;
        }
    });

    setStatusUI(isAnyBulbOn);
}

// Fungsi deteksi sentuhan antar komponen
function checkCollision(el1, el2) {
    const x1 = parseInt(el1.style.left);
    const y1 = parseInt(el1.style.top);
    const x2 = parseInt(el2.style.left);
    const y2 = parseInt(el2.style.top);

    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);

    // Komponen dianggap tersambung jika jaraknya pas (snapped) atau bersentuhan tipis
    // Horizontal (Seri) atau Vertikal (Paralel)
    const isTouchingX = dx <= CONFIG.touchTolerance && dy < 10;
    const isTouchingY = dy <= CONFIG.touchTolerance && dx < 10;

    return isTouchingX || isTouchingY;
}

function setStatusUI(active) {
    const info = document.getElementById('flow-status');
    if (info) {
        info.innerText = active ? "AKTIF ⚡" : "TERPUTUS";
        info.style.color = active ? "#00ff88" : "#ff4757";
    }
}
