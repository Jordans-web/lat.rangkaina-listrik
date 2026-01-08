/** * KONFIGURASI 
 */
const CONFIG = {
    snapThreshold: 60,
    compSize: 100
};

/**
 * UTILITY FUNCTIONS
 */
const allowDrop = (ev) => ev.preventDefault();
const drag = (ev) => ev.dataTransfer.setData("type", ev.target.getAttribute("data-type"));

/**
 * CORE LOGIC
 */
function drop(ev) {
    ev.preventDefault();
    const type = ev.dataTransfer.getData("type");
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    
    createComponent(type, x, y);
}

function createComponent(type, x, y) {
    const id = `comp-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'placed-comp';
    div.id = id;
    div.dataset.type = type;
    div.dataset.rotation = 0;
    div.dataset.state = "off";

    const icons = { battery: '🔋', bulb: '💡', switch: '🔌', wire: '➖' };
    
    div.innerHTML = `
        <div class="rotate-handle"></div>
        <div class="comp-icon">${icons[type]}</div>
        <div class="comp-label">${type.toUpperCase()}</div>
        ${type === 'switch' ? `<button class="switch-btn" onclick="toggleSwitch('${id}')">OFF</button>` : ''}
    `;

    document.getElementById('canvas').appendChild(div);
    
    // Set posisi awal (tengah komponen tepat di kursor)
    div.style.left = `${x - CONFIG.compSize / 2}px`;
    div.style.top = `${y - CONFIG.compSize / 2}px`;

    // Pasang Event Listeners
    initDrag(div);
    initRotation(div);
    
    // Hapus dengan klik kanan
    div.oncontextmenu = (e) => {
        e.preventDefault();
        div.remove();
        checkCircuit();
    };

    checkCircuit();
}

/**
 * LOGIKA SAKLAR
 */
window.toggleSwitch = (id) => {
    const el = document.getElementById(id);
    const btn = el.querySelector('.switch-btn');
    const isOff = el.dataset.state === "off";
    
    el.dataset.state = isOff ? "on" : "off";
    btn.innerText = isOff ? "ON" : "OFF";
    btn.classList.toggle('switch-on', isOff);
    
    checkCircuit();
};

/**
 * LOGIKA GERAK (DRAG)
 */
function initDrag(el) {
    el.onmousedown = function(e) {
        // Abaikan jika klik tombol saklar atau gagang putar
        if (e.target.closest('.switch-btn') || e.target.closest('.rotate-handle')) return;

        el.style.zIndex = 1000;
        const rect = el.getBoundingClientRect();
        const shiftX = e.clientX - rect.left;
        const shiftY = e.clientY - rect.top;

        function moveAt(pageX, pageY) {
            const canvas = document.getElementById('canvas');
            const cRect = canvas.getBoundingClientRect();
            
            let newX = pageX - shiftX - cRect.left;
            let newY = pageY - shiftY - cRect.top;

            // Logika Magnet
            const others = document.querySelectorAll('.placed-comp');
            el.classList.remove('snapped');

            others.forEach(other => {
                if (other === el) return;
                const ox = parseInt(other.style.left);
                const oy = parseInt(other.style.top);

                const dx = Math.abs(newX - ox);
                const dy = Math.abs(newY - oy);

                // Snap Horizontal
                if (dx < CONFIG.snapThreshold && dy < 30) {
                    newY = oy;
                    newX = (newX > ox) ? ox + CONFIG.compSize : ox - CONFIG.compSize;
                    el.classList.add('snapped');
                } 
                // Snap Vertikal
                else if (dy < CONFIG.snapThreshold && dx < 30) {
                    newX = ox;
                    newY = (newY > oy) ? oy + CONFIG.compSize : oy - CONFIG.compSize;
                    el.classList.add('snapped');
                }
            });

            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
        }

        function onMouseMove(e) {
            moveAt(e.clientX, e.clientY);
        }

        document.addEventListener('mousemove', onMouseMove);

        document.onmouseup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            el.style.zIndex = 5;
            checkCircuit();
            document.onmouseup = null;
        };
    };

    el.ondragstart = () => false;
}

/**
 * LOGIKA PUTAR (ROTATION)
 */
function initRotation(el) {
    const handle = el.querySelector('.rotate-handle');
    
    handle.onmousedown = function(e) {
        e.stopPropagation();
        
        function onRotate(moveEvent) {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const radians = Math.atan2(moveEvent.clientX - centerX, -(moveEvent.clientY - centerY));
            const degrees = Math.round(radians * (180 / Math.PI));
            
            el.dataset.rotation = degrees;
            el.style.transform = `rotate(${degrees}deg)`;
        }

        document.addEventListener('mousemove', onRotate);
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onRotate);
            checkCircuit();
        }, { once: true });
    };
}

/**
 * LOGIKA ARUS LISTRIK
 */
function checkCircuit() {
    const comps = document.querySelectorAll('.placed-comp');
    const statusEl = document.getElementById('flow-status');
    
    const hasBattery = Array.from(comps).some(c => c.dataset.type === 'battery');
    const switches = Array.from(comps).filter(c => c.dataset.type === 'switch');
    
    // Syarat sederhana: Semua saklar yang ada di canvas harus ON
    const allSwitchesOn = switches.every(s => s.dataset.state === 'on');
    
    // Arus mengalir jika ada baterai dan saklar oke
    const isFlowing = hasBattery && allSwitchesOn && comps.length > 1;

    comps.forEach(c => {
        if (c.dataset.type === 'bulb') {
            c.classList.toggle('bulb-on', isFlowing);
        }
    });

    statusEl.innerText = isFlowing ? "Mengalir ⚡" : "Terputus";
    statusEl.style.color = isFlowing ? "#00ff88" : "#ff4757";
}