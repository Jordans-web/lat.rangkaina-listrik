/**
 * LAB LISTRIK PRO - ENGINE
 */
const LAB_CONFIG = {
    snapSize: 100,
    threshold: 60,
    touchTolerance: 105
};

// State Management
let components = [];

// Drag & Drop Handlers
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
    
    // Posisikan di tengah kursor
    div.style.left = `${x - 50}px`;
    div.style.top = `${y - 50}px`;

    initDraggable(div);
    initRotatable(div);
    
    // Hapus dengan klik kanan
    div.oncontextmenu = (e) => {
        e.preventDefault();
        div.remove();
        updatePhysics();
    };

    updatePhysics();
}

/**
 * LOGIKA INTERAKSI
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

            // Magnet Snapping Logic
            const others = document.querySelectorAll('.placed-comp');
            el.classList.remove('snapped');

            others.forEach(other => {
                if (other === el) return;
                const ox = parseInt(other.style.left);
                const oy = parseInt(other.style.top);

                if (Math.abs(nX - ox) < LAB_CONFIG.threshold && Math.abs(nY - oy) < 30) {
                    nY = oy;
                    nX = (nX > ox) ? ox + LAB_CONFIG.snapSize : ox - LAB_CONFIG.snapSize;
                    el.classList.add('snapped');
                } else if (Math.abs(nY - oy) < LAB_CONFIG.threshold && Math.abs(nX - ox) < 30) {
                    nX = ox;
                    nY = (nY > oy) ? oy + LAB_CONFIG.snapSize : oy - LAB_CONFIG.snapSize;
                    el.classList.add('snapped');
                }
            });

            el.style.left = `${nX}px`;
            el.style.top = `${nY}px`;
        }

        document.addEventListener('mousemove', move);
        document.onmouseup = () => {
            document.removeEventListener('mousemove', move);
            el.style.zIndex = 5;
            updatePhysics();
            document.onmouseup = null;
        };
    };
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
 * PHYSICS ENGINE (ALIRAN LISTRIK)
 */
function updatePhysics() {
    const comps = Array.from(document.querySelectorAll('.placed-comp'));
    
    // Reset visual
    comps.forEach(c => { if(c.dataset.type === 'bulb') c.classList.remove('bulb-on'); });

    const batteries = comps.filter(c => c.dataset.type === 'battery');
    if (batteries.length === 0) return setFlowInfo(false);

    // Algoritma Penjalaran Arus (Breadth-First Search)
    let powered = new Set();
    let queue = [...batteries];
    batteries.forEach(b => powered.add(b.id));

    while (queue.length > 0) {
        let curr = queue.shift();
        
        comps.forEach(next => {
            if (!powered.has(next.id) && areLinked(curr, next)) {
                // Arus hanya lewat jika komponen bukan saklar OFF
                if (next.dataset.type === 'switch' && next.dataset.state === 'off') {
                    // Blokir arus
                } else {
                    powered.add(next.id);
                    queue.push(next);
                }
            }
        });
    }

    let lightOn = false;
    powered.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.type === 'bulb') {
            el.classList.add('bulb-on');
            lightOn = true;
        }
    });

    setFlowInfo(lightOn);
}

function areLinked(a, b) {
    const ax = parseInt(a.style.left);
    const ay = parseInt(a.style.top);
    const bx = parseInt(b.style.left);
    const by = parseInt(b.style.top);

    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);

    // Cek kontak fisik berdasarkan ukuran snap
    return (dx <= LAB_CONFIG.touchTolerance && dy < 20) || 
           (dy <= LAB_CONFIG.touchTolerance && dx < 20);
}

function setFlowInfo(active) {
    const info = document.getElementById('flow-status');
    if (info) {
        info.innerText = active ? "AKTIF ⚡" : "MATI";
        info.style.color = active ? "#00ff88" : "#ff4757";
    }
}
