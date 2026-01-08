/**
 * LAB LISTRIK PRO - ENGINE FINAL OPTIMIZED
 * Fitur: Instant Magnet, 360 Rotation, BFS Pathfinding, Anti-Stuck Mouse
 */

const CONFIG = {
    snapSize: 100,      
    threshold: 60,     
    touchTolerance: 110 
};

// --- Fungsi Global Drag & Drop ---
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

// --- Builder Komponen ---
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
        <div class="rotate-handle" title="Putar 360°"></div>
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

// --- Logika Saklar ---
window.toggleSwitch = (id) => {
    const el = document.getElementById(id);
    const btn = el.querySelector('.switch-btn');
    const newState = el.dataset.state === 'off' ? 'on' : 'off';
    
    el.dataset.state = newState;
    btn.innerText = newState.toUpperCase();
    btn.classList.toggle('switch-on', newState === 'on');
    
    updatePhysics();
};

// --- Logika Gerak (Drag) dengan Optimasi Magnet Anti-Delay ---
function initDraggable(el) {
    el.onmousedown = function(e) {
        if (e.target.closest('.switch-btn') || e.target.closest('.rotate-handle')) return;
        
        el.style.zIndex = 1000;
        const canvas = document.getElementById('canvas');
        const cRect = canvas.getBoundingClientRect();
        const shiftX = e.clientX - el.getBoundingClientRect().left;
        const shiftY = e.clientY - el.getBoundingClientRect().top;

        function onMouseMove(e) {
            // 1. Kalkulasi posisi dasar
            let nX = e.clientX - shiftX - cRect.left;
            let nY = e.clientY - shiftY - cRect.top;

            // 2. Optimasi Magnet (Loop Cepat)
            const others = document.querySelectorAll('.placed-comp');
            el.classList.remove('snapped');
            
            for (let i = 0; i < others.length; i++) {
                const other = others[i];
                if (other === el) continue;

                const ox = parseFloat(other.style.left);
                const oy = parseFloat(other.style.top);

                const dx = Math.abs(nX - ox);
                const dy = Math.abs(nY - oy);

                // Snap Logic
                if (dx < CONFIG.threshold && dy < 25) {
                    nY = oy; 
                    nX = (nX > ox) ? ox + CONFIG.snapSize : ox - CONFIG.snapSize;
                    el.classList.add('snapped');
                    break; 
                } else if (dy < CONFIG.threshold && dx < 25) {
                    nX = ox; 
                    nY = (nY > oy) ? oy + CONFIG.snapSize : oy - CONFIG.snapSize;
                    el.classList.add('snapped');
                    break;
                }
            }

            // 3. Terapkan posisi secara instan
            el.style.left = `${nX}px`;
            el.style.top = `${nY}px`;
            
            // 4. Gunakan requestAnimationFrame untuk update fisika agar tidak lag
            requestAnimationFrame(updatePhysics);
        }

        document.addEventListener('mousemove', onMouseMove);

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            el.style.zIndex = 5;
            updatePhysics();
        }
        document.addEventListener('mouseup', onMouseUp);
    };

    el.ondragstart = () => false;
    el.oncontextmenu = (e) => { 
        e.preventDefault(); 
        el.remove(); 
        updatePhysics(); 
    };
}

// --- Logika Rotasi ---
function initRotatable(el) {
    const handle = el.querySelector('.rotate-handle');
    handle.onmousedown = (e) => {
        e.stopPropagation();
        
        function onRotate(ev) {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            
            const rad = Math.atan2(ev.clientX - cx, -(ev.clientY - cy));
            const deg = Math.round(rad * (180 / Math.PI));
            
            el.style.transform = `rotate(${deg}deg)`;
            el.dataset.rotation = deg;
            requestAnimationFrame(updatePhysics);
        }

        document.addEventListener('mousemove', onRotate);
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onRotate);
            updatePhysics();
        }, { once: true });
    };
}

// --- Logika Fisika (Penelusuran Arus Berdasarkan Jarak Visual) ---
function updatePhysics() {
    const comps = Array.from(document.querySelectorAll('.placed-comp'));
    
    // Reset visual lampu
    comps.forEach(c => { if(c.dataset.type === 'bulb') c.classList.remove('bulb-on'); });

    const batteries = comps.filter(c => c.dataset.type === 'battery');
    if (batteries.length === 0) return setStatusUI(false);

    // BFS Pathfinding dari Baterai
    let energized = new Set();
    let queue = [...batteries];
    batteries.forEach(b => energized.add(b.id));

    while (queue.length > 0) {
        let current = queue.shift();
        
        for (let i = 0; i < comps.length; i++) {
            let target = comps[i];
            if (!energized.has(target.id)) {
                // Gunakan deteksi jarak pusat-ke-pusat yang presisi
                if (isLinked(current, target)) {
                    if (target.dataset.type === 'switch' && target.dataset.state === 'off') {
                        // Terhenti di saklar OFF
                    } else {
                        energized.add(target.id);
                        queue.push(target);
                    }
                }
            }
        }
    }

    let lightActive = false;
    energized.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.type === 'bulb') {
            el.classList.add('bulb-on');
            lightActive = true;
        }
    });

    setStatusUI(lightActive);
}

function isLinked(el1, el2) {
    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();
    
    const center1 = { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 };
    const center2 = { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };

    const distance = Math.sqrt(
        Math.pow(center1.x - center2.x, 2) + 
        Math.pow(center1.y - center2.y, 2)
    );

    return distance < CONFIG.touchTolerance;
}

function setStatusUI(active) {
    const info = document.getElementById('flow-status');
    if (!info) return;
    info.innerText = active ? "AKTIF ⚡" : "TERPUTUS";
    info.style.color = active ? "#00ff88" : "#ff4757";
}
