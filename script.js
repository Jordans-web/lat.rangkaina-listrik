/**
 * CONFIGURATION
 */
const CONFIG = {
    snapThreshold: 60,
    compSize: 100, // Ukuran kotak komponen
    touchBuffer: 105 // Jarak maksimal antar komponen untuk dianggap terhubung
};

/**
 * CORE STATE
 */
const allowDrop = (ev) => ev.preventDefault();
const drag = (ev) => ev.dataTransfer.setData("type", ev.target.getAttribute("data-type"));

/**
 * INITIALIZATION
 */
function drop(ev) {
    ev.preventDefault();
    const type = ev.dataTransfer.getData("type");
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    
    // Posisi mouse relatif terhadap canvas
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
    div.dataset.state = (type === 'switch') ? 'off' : 'on';

    const icons = { battery: '🔋', bulb: '💡', switch: '🔌', wire: '➖' };
    
    div.innerHTML = `
        <div class="rotate-handle" title="Putar 360°"></div>
        <div class="comp-icon">${icons[type]}</div>
        <div class="comp-label">${type.toUpperCase()}</div>
        ${type === 'switch' ? `<button class="switch-btn" onclick="toggleSwitch('${id}')">OFF</button>` : ''}
    `;

    document.getElementById('canvas').appendChild(div);
    
    // Atur posisi agar tengah komponen di kursor
    div.style.left = `${x - CONFIG.compSize / 2}px`;
    div.style.top = `${y - CONFIG.compSize / 2}px`;

    initDrag(div);
    initRotation(div);
    
    // Hapus komponen dengan klik kanan
    div.oncontextmenu = (e) => {
        e.preventDefault();
        div.remove();
        checkCircuit();
    };

    checkCircuit();
}

/**
 * INTERACTION LOGIC
 */
window.toggleSwitch = (id) => {
    const el = document.getElementById(id);
    const btn = el.querySelector('.switch-btn');
    const isCurrentlyOff = el.dataset.state === "off";
    
    el.dataset.state = isCurrentlyOff ? "on" : "off";
    btn.innerText = isCurrentlyOff ? "ON" : "OFF";
    btn.classList.toggle('switch-on', isCurrentlyOff);
    
    checkCircuit();
};

function initDrag(el) {
    el.onmousedown = function(e) {
        if (e.target.closest('.switch-btn') || e.target.closest('.rotate-handle')) return;

        el.style.zIndex = 1000;
        const shiftX = e.clientX - el.getBoundingClientRect().left;
        const shiftY = e.clientY - el.getBoundingClientRect().top;

        function onMouseMove(e) {
            const canvas = document.getElementById('canvas');
            const cRect = canvas.getBoundingClientRect();
            
            let newX = e.clientX - shiftX - cRect.left;
            let newY = e.clientY - shiftY - cRect.top;

            // Logika Magnet (Snapping)
            const others = document.querySelectorAll('.placed-comp');
            el.classList.remove('snapped');

            others.forEach(other => {
                if (other === el) return;
                const ox = parseInt(other.style.left);
                const oy = parseInt(other.style.top);

                const dx = Math.abs(newX - ox);
                const dy = Math.abs(newY - oy);

                // Snap Horizontal (Seri)
                if (dx < CONFIG.snapThreshold && dy < 30) {
                    newY = oy;
                    newX = (newX > ox) ? ox + CONFIG.compSize : ox - CONFIG.compSize;
                    el.classList.add('snapped');
                } 
                // Snap Vertikal (Paralel)
                else if (dy < CONFIG.snapThreshold && dx < 30) {
                    newX = ox;
                    newY = (newY > oy) ? oy + CONFIG.compSize : oy - CONFIG.compSize;
                    el.classList.add('snapped');
                }
            });

            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
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

function initRotation(el) {
    const handle = el.querySelector('.rotate-handle');
