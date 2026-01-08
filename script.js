/**
 * LAB LISTRIK PRO - LOGIKA KONEKSI PRESISI
 */
const CONFIG = {
    snapSize: 100,
    threshold: 60,
    touchTolerance: 110 // Batas maksimal jarak antar pusat komponen
};

// Handlers untuk Drag and Drop
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

function createComponent(type, x, y) {
    const id = `comp_${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'placed-comp';
    div.id = id;
    div.dataset.type = type;
    div.dataset.state = (type === 'switch') ? 'off' : 'on';

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
    updatePhysics(); 
}

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

            // Magnet Snapping
            const others = document.querySelectorAll('.placed-comp');
            el.classList.remove('snapped');
            others.forEach(other => {
                if (other === el) return;
                const ox = parseFloat(other.style.left);
                const oy = parseFloat(other.style.top);
                if (Math.abs(nX - ox) < CONFIG.threshold && Math.abs(nY - oy) < 30) {
                    nY = oy; nX = (nX > ox) ? ox + CONFIG.snapSize : ox - CONFIG.snapSize;
                    el.classList.add('snapped');
                } else if (Math.abs(nY - oy) < CONFIG.threshold && Math.abs(nX - ox) < 30) {
                    nX = ox; nY = (nY > oy) ? oy + CONFIG.snapSize : oy - CONFIG.snapSize;
                    el.classList.add('snapped');
                }
            });
            el.style.left = `${nX}px`; el.style.top = `${nY}px`;
            updatePhysics(); // Cek arus real-time saat digeser
        }

        document.addEventListener('mousemove', move);
        document.onmouseup = () => {
            document.removeEventListener('mousemove', move);
            el.style.zIndex = 5;
            updatePhysics();
            document.onmouseup = null;
        };
    };
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
            updatePhysics();
        };
        document.addEventListener('mousemove', onRotate);
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onRotate);
            updatePhysics();
        }, { once: true });
    };
}

/**
 * LOGIKA FISIKA: BFS DENGAN CEK JARAK PUSAT (CENTER-TO-CENTER)
 */
function updatePhysics() {
    const comps = Array.from(document.querySelectorAll('.placed-comp'));
    
    // Matikan semua lampu dulu
    comps.forEach(c => { if(c.dataset.type === 'bulb') c.classList.remove('bulb-on'); });

    const batteries = comps.filter(c => c.dataset.type === 'battery');
    if (batteries.length === 0) return setStatusUI(false);

    let energized = new Set();
    let queue = [...batteries];
    batteries.forEach(b => energized.add(b.id));

    while (queue.length > 0) {
        let current = queue.shift();
        
        comps.forEach(target => {
            if (!energized.has(target.id)) {
                // Gunakan deteksi jarak Euclidean antar pusat komponen
                if (isConnectable(current, target)) {
                    if (target.dataset.type === 'switch' && target.dataset.state === 'off') {
                        // Aliran terhenti di saklar mati
                    } else {
                        energized.add(target.id);
                        queue.push(target);
                    }
                }
            }
        });
    }

    let lightOn = false;
    energized.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.type === 'bulb') {
            el.classList.add('bulb-on');
            lightOn = true;
        }
    });
    setStatusUI(lightOn);
}

function isConnectable(el1, el2) {
    // Ambil koordinat pusat (center) masing-masing elemen
    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();
    
    const center1 = { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 };
    const center2 = { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };

    // Hitung jarak antar pusat (Euclidean Distance)
    const distance = Math.sqrt(
        Math.pow(center1.x - center2.x, 2) + 
        Math.pow(center1.y - center2.y, 2)
    );

    // Jarak 100-110px berarti mereka menempel pas (karena ukuran komponen 100px)
    return distance < CONFIG.touchTolerance;
}

function setStatusUI(active) {
    const info = document.getElementById('flow-status');
    if (info) {
        info.innerText = active ? "AKTIF ⚡" : "TERPUTUS";
        info.style.color = active ? "#00ff88" : "#ff4757";
    }
}
