import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "canteen-menu-cd0c4.firebaseapp.com",
  projectId: "canteen-menu-cd0c4",
  storageBucket: "canteen-menu-cd0c4.firebasestorage.app",
  messagingSenderId: "781515846780",
  appId: "1:781515846780:web:aa0c81ed19c7c84bff85f9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;
let cart = [];
let currentCategory = 'biscuit';
let reportTargetId = null; 
let users = [];
let products = [];
let orders = [];
let reports = [];
let favorites = JSON.parse(localStorage.getItem('localFavs')) || [];

async function init() {
    onSnapshot(collection(db, "users"), (snap) => {
        users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(currentUser && currentUser.role === 'admin') renderAccounts();
    });
    onSnapshot(collection(db, "products"), (snap) => {
        products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMenu();
    });
    onSnapshot(collection(db, "orders"), (snap) => {
        orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(currentUser) {
            renderStudentOrders();
            renderQueue();
            renderHistory();
        }
    });
    onSnapshot(collection(db, "reports"), (snap) => {
        reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(currentUser && currentUser.role === 'admin') renderReportsLog();
    });
    
    document.getElementById('login-view').classList.remove('hidden');
}
init();

async function registerStudent() {
    const given = document.getElementById('reg-given').value.trim();
    const last = document.getElementById('reg-last').value.trim();
    const lrn = document.getElementById('reg-lrn').value.trim();
    const section = document.getElementById('reg-section').value.trim();
    const adviser = document.getElementById('reg-adviser').value.trim();

    if(!given || !last || !lrn || !section || !adviser) return alert("Please fill in ALL fields.");
    if (lrn.length !== 12) return alert("Error: LRN must be exactly 12 digits.");
    if(users.some(u => u.lrn === lrn)) return alert("Account with this LRN already exists.");

    const fullName = `${given} ${last}`;

    await addDoc(collection(db, "users"), { 
        lrn: lrn, 
        name: fullName,       
        lastname: last,       
        given_name: given,    
        section: section, 
        adviser: adviser,     
        role: "student", 
        status: "Pending"     
    });

    document.getElementById('register-modal').classList.add('hidden');
    alert("Registration Sent! Please wait for Admin approval.");
}

document.getElementById('login-btn').addEventListener('click', handleLogin);

function handleLogin() {
    const idInput = document.getElementById('login-id').value.trim();
    const passInput = document.getElementById('login-pass').value.trim();
    const user = users.find(u => u.lrn === idInput);

    if (!user) return alert("User not found!");
    
    if (user.status === "Banned") return alert("ACCOUNT SUSPENDED.");
    if (user.status === "Pending") return alert("ACCOUNT PENDING APPROVAL.\nPlease contact the Admin.");

    if ((user.role === 'admin' && passInput === 'admin') || (user.role === 'staff' && passInput === '1234')) {
        loginSuccess(user);
        return;
    }

    const last4 = user.lrn.slice(-4);
    const expectedPass = user.lastname + last4;
    if (passInput === expectedPass) loginSuccess(user);
    else alert("Incorrect Password.");
}

function loginSuccess(user) {
    currentUser = user;
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    document.getElementById('profile-name').innerText = user.name;
    document.getElementById('profile-initials').innerText = user.name.charAt(0);
    document.getElementById('profile-role').innerText = user.role.toUpperCase();
    document.getElementById('profile-role').className = "role-badge " + user.role;
    
    if(user.role === 'student') {
        document.getElementById('profile-display-lrn').innerText = user.lrn;
        document.getElementById('profile-display-lrn').classList.remove('hidden');
        document.querySelector('.info-grid').classList.remove('hidden');
        document.getElementById('profile-section').innerText = user.section;
        document.getElementById('profile-adviser').innerText = user.adviser || "N/A";
    } else {
        document.getElementById('profile-display-lrn').classList.add('hidden');
        document.querySelector('.info-grid').classList.add('hidden');
    }

    updateUIForRole();
}

document.getElementById('logout-btn').onclick = logout;
document.getElementById('search-bar').onkeyup = searchProducts;
document.getElementById('account-search').onkeyup = renderAccounts;
document.getElementById('history-search').onkeyup = renderHistory;
document.getElementById('save-product-btn').onclick = saveProduct;
document.getElementById('save-user-btn').onclick = addNewUser;
document.getElementById('submit-report-btn').onclick = submitReport;
document.getElementById('qr-btn').onclick = openQRModal;
document.getElementById('add-user-btn').onclick = () => openModal('add-user-modal');
document.getElementById('checkout-btn').onclick = checkout;

const navMap = {
    'nav-menu': ['menu', 0], 'nav-cart': ['cart', 1], 'nav-orders': ['orders', 2],
    'nav-fav': ['favorite', 3], 'nav-queue': ['queue', 4], 'nav-history': ['history', 5],
    'nav-accounts': ['accounts', 6], 'nav-reports': ['reports', 7], 'nav-profile': ['profile', 8]
};

for (const [id, [view, idx]] of Object.entries(navMap)) {
    document.getElementById(id).onclick = function() { nav(view, this); };
}

document.querySelectorAll('.tab').forEach(t => {
    t.onclick = function() {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        currentCategory = this.getAttribute('data-cat');
        renderMenu();
    };
});

function logout() {
    if(confirm("Log out?")) window.location.reload();
}

function updateUIForRole() {
    const adminBar = document.getElementById('admin-bar');
    const adminActions = document.getElementById('admin-actions');
    const topControls = document.getElementById('top-controls');

    document.querySelectorAll('.student-only, .staff-only, .admin-only').forEach(e => e.classList.add('hidden'));

    if (currentUser.role === 'student') {
        adminBar.style.display = 'none';
        document.querySelectorAll('.student-only').forEach(e => e.classList.remove('hidden'));
        topControls.classList.remove('hidden'); 
        nav('menu', document.getElementById('nav-menu'));
    } 
    else {
        adminBar.style.display = 'flex';
        document.getElementById('admin-role-display').innerText = currentUser.role.toUpperCase() + " DASHBOARD";
        
        if (currentUser.role === 'staff') {
            document.querySelectorAll('.staff-only').forEach(e => e.classList.remove('hidden'));
            topControls.classList.add('hidden');
            nav('queue', document.getElementById('nav-queue')); 
        } 
        else if (currentUser.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('hidden'));
            adminActions.innerHTML = `<button class="btn btn-primary" style="padding:5px 10px; font-size:11px;" onclick="document.getElementById('add-product-modal').classList.remove('hidden')">+ Add Item</button>`;
            topControls.classList.remove('hidden'); 
            nav('accounts', document.getElementById('nav-accounts')); 
        }
    }
}

function nav(target, el) {
    document.querySelectorAll('.footer-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');

    document.querySelectorAll('.main-scroll > div').forEach(v => v.classList.add('hidden'));
    
    const topControls = document.getElementById('top-controls');
    if (target === 'menu' && (currentUser.role === 'student' || currentUser.role === 'admin')) {
        topControls.classList.remove('hidden');
    } else {
        topControls.classList.add('hidden');
    }

    document.getElementById('view-' + target).classList.remove('hidden');
    
    if (target === 'menu') renderMenu();
    if (target === 'cart') renderCart();
    if (target === 'orders') renderStudentOrders();
    if (target === 'favorite') renderFavorites();
    if (target === 'queue') renderQueue();
    if (target === 'history') renderHistory();
    if (target === 'accounts') renderAccounts();
    if (target === 'reports') renderReportsLog();
}

function renderReportsLog() {
    const container = document.getElementById('reports-log-container');
    if(reports.length === 0) return container.innerHTML = "<p style='text-align:center;color:#999'>No incidents.</p>";
    
    container.innerHTML = reports.slice().reverse().map(r => {
        const linkId = `lnk-${r.id}`;
        setTimeout(() => { document.getElementById(linkId).onclick = () => jumpToUser(r.lrn); }, 0);
        return `<div class="report-card"><div style="display:flex;justify-content:space-between"><strong id="${linkId}" style="color:#1565C0;cursor:pointer;text-decoration:underline">${r.student}</strong><small>${r.date}</small></div><div style="color:#D32F2F;font-weight:bold;margin-top:5px">${r.reason}</div><small>Filed by: ${r.reportedBy}</small></div>`;
    }).join('');
}

function jumpToUser(lrn) {
    document.getElementById('account-search').value = lrn;
    nav('accounts', document.getElementById('nav-accounts'));
    renderAccounts();
}

function renderAccounts() {
    const container = document.getElementById('accounts-container');
    const term = document.getElementById('account-search').value.toLowerCase();
    
    const pending = users.filter(u => u.status === 'Pending');
    const others = users.filter(u => u.status !== 'Pending' && (u.name.toLowerCase().includes(term) || u.lrn.includes(term)));

    let html = "";

    if (pending.length > 0) {
        html += `<h4 style="color:#d32f2f; margin:10px 0;">⚠️ Pending Requests (${pending.length})</h4>`;
        html += pending.map(u => {
            const accId = `acc-${u.id}`;
            const rejId = `rej-${u.id}`;
            setTimeout(() => {
                document.getElementById(accId).onclick = async () => {
                    if(confirm("Accept this student?")) await updateDoc(doc(db, "users", u.id), { status: "Active" });
                };
                document.getElementById(rejId).onclick = async () => {
                    if(confirm("Reject and Delete?")) await deleteDoc(doc(db, "users", u.id));
                };
            }, 0);
            
            return `
            <div class="account-card" style="border-left:4px solid orange; background:#fff3e0;">
                <div>
                    <strong>${u.name}</strong><br>
                    <small style="color:#555">LRN: ${u.lrn}</small><br>
                    <small>Sec: ${u.section}</small>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn" id="${accId}" style="background:green; color:white; padding:5px 10px;">✔</button>
                    <button class="btn" id="${rejId}" style="background:red; color:white; padding:5px 10px;">✖</button>
                </div>
            </div>`;
        }).join('');
        html += `<hr style="border:0; border-top:1px solid #ddd; margin:15px 0;">`;
    }

    html += others.map(u => {
        const banId = `ban-${u.id}`;
        const delId = `del-${u.id}`;
        const isBanned = u.status === 'Banned';
        
        setTimeout(() => {
            if(document.getElementById(banId)) document.getElementById(banId).onclick = async () => {
                await updateDoc(doc(db, "users", u.id), { status: isBanned ? 'Active' : 'Banned' });
            };
            if(document.getElementById(delId)) document.getElementById(delId).onclick = async () => {
                if(confirm("Delete user?")) await deleteDoc(doc(db, "users", u.id));
            };
        }, 0);

        return `
        <div class="account-card">
            <div>
                <strong>${u.name}</strong><br>
                <small style="color:#555; font-size:11px;">LRN: ${u.lrn}</small><br>
                <span class="role-tag ${u.role}">${u.role.toUpperCase()}</span> ${isBanned?'<span class="ban-badge">BANNED</span>':''}
            </div>
            ${u.role==='student'?`<div style="display:flex;flex-direction:column;gap:5px"><button class="btn ${isBanned?'btn-primary':'btn-danger'}" id="${banId}" style="padding:2px 5px;font-size:10px">${isBanned?'Unban':'Ban'}</button><button class="btn btn-outline" id="${delId}" style="padding:2px 5px;font-size:10px">Del</button></div>`:''}
        </div>`;
    }).join('');

    container.innerHTML = html;
}

// --- UPDATED ADD USER (STAFF vs STUDENT) ---
async function addNewUser() {
    const role = document.getElementById('new-user-role').value;
    const name = document.getElementById('new-user-name').value.trim();
    const lrn = document.getElementById('new-user-lrn').value.trim();
    
    let section = document.getElementById('new-user-section').value.trim();
    let adviser = document.getElementById('new-user-adviser').value.trim();

    if(!name || !lrn) return alert("Please fill in Name and ID.");

    if(users.some(u => u.lrn === lrn)) return alert("Error: This ID/LRN already exists!");

    if(role === 'staff') {
        section = "Kitchen";
        adviser = "N/A";
    } else {
        if(!section || !adviser) return alert("Students need a Section and Adviser.");
    }

    const lastname = name.split(" ").pop();

    await addDoc(collection(db, "users"), { 
        lrn: lrn, 
        name: name, 
        lastname: lastname, 
        section: section, 
        adviser: adviser, 
        role: role, 
        status: "Active" 
    });
    
    document.getElementById('add-user-modal').classList.add('hidden');
    
    if(role === 'staff') {
        alert(`Staff Created!\nUser: ${lrn}\nPass: 1234`); 
    } else {
        alert(`Student Created!\nUser: ${lrn}\nPass: ${lastname + lrn.slice(-4)}`);
    }
}

function renderFavorites() {
    const container = document.getElementById('fav-container');
    if(favorites.length === 0) return container.innerHTML = "<p style='text-align:center;color:#999'>No saved items.</p>";
    
    const favProds = favorites.map(id => products.find(p => p.id === id)).filter(Boolean);
    container.innerHTML = favProds.map(p => {
        const addId = `fav-add-${p.id}`;
        const remId = `fav-rem-${p.id}`;
        const qtyId = `fav-qty-${p.id}`;
        const canAdd = p.stock > 0;
        
        setTimeout(() => {
            document.getElementById(remId).onclick = () => toggleFav(p.id);
            if(canAdd) document.getElementById(addId).onclick = () => addToCart(p.id, qtyId);
        }, 0);

        return `
        <div class="product-card">
            <img src="${p.img}" class="product-img" onerror="this.src='https://placehold.co/70'">
            <div class="product-info">
                <h4>${p.name}</h4>
                <p>₱${p.price}</p>
                ${!canAdd ? '<span class="stock-badge out">Sold Out</span>' : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                 ${canAdd ? `<input type="number" id="${qtyId}" value="1" class="qty-input" style="width:40px;margin-bottom:5px"><button class="btn btn-primary" id="${addId}" style="font-size:10px;padding:5px">Add</button>` : ''}
                 <button class="btn btn-outline" id="${remId}" style="font-size:10px;padding:5px;color:red;border:none">Remove</button>
            </div>
        </div>`;
    }).join('');
}

function addToCartFromFav(id) {
    const p = products.find(x => x.id === id);
    if(p.stock < 1) return alert("Out of stock");
    const existing = cart.find(x => x.id === id);
    if(existing) {
        if(existing.qty + 1 > p.stock) return alert("Limit reached");
        existing.qty++;
    } else {
        cart.push({...p, qty: 1});
    }
    alert("Added 1 to Cart");
}

function renderMenu(term = "") {
    const container = document.getElementById('menu-container');
    container.innerHTML = "";
    
    if(!term) term = document.getElementById('search-bar') ? document.getElementById('search-bar').value.toLowerCase() : "";
    
    const filtered = products.filter(p => (p.category === currentCategory) && (p.name.toLowerCase().includes(term)));
    if (filtered.length === 0) { container.innerHTML = "<div style='text-align:center; padding:40px; color:#999'>No items.</div>"; return; }

    filtered.forEach(p => {
        let controls = "";
        let isFav = favorites.includes(p.id);

        if (currentUser.role === 'admin') {
            const deleteBtnId = `del-${p.id}`;
            const inputId = `stock-${p.id}`;
            controls = `<div style="display:flex; gap:5px; margin-top:10px;"><input type="number" id="${inputId}" value="${p.stock}" class="qty-input" style="width:60px"><button class="btn btn-outline" style="padding:5px 10px; font-size:10px" id="${deleteBtnId}">Del</button></div>`;
            setTimeout(() => {
                document.getElementById(deleteBtnId).onclick = () => deleteProduct(p.id);
                document.getElementById(inputId).onchange = (e) => updateStock(p.id, e.target.value);
            }, 0);
        } else if (currentUser.role === 'student') {
            const favBtnId = `fav-${p.id}`;
            const addBtnId = `add-${p.id}`;
            const qtyId = `qty-${p.id}`;
            if (p.stock > 0) {
                controls = `<div class="qty-wrapper"><button class="fav-btn ${isFav ? 'active' : ''}" id="${favBtnId}">❤</button><input type="number" id="${qtyId}" class="qty-input" value="1" min="1" max="${p.stock}"><button class="btn btn-primary" id="${addBtnId}" style="flex:1">Add</button></div>`;
                setTimeout(() => {
                    document.getElementById(favBtnId).onclick = () => toggleFav(p.id);
                    document.getElementById(addBtnId).onclick = () => addToCart(p.id, qtyId);
                }, 0);
            } else {
                controls = `<button class="btn" disabled style="width:100%; margin-top:5px; background:#ddd; color:#888;">Out of Stock</button>`;
            }
        }
        container.innerHTML += `<div class="product-card" style="opacity:${p.stock > 0 ? 1 : 0.6}"><img src="${p.img}" class="product-img" onerror="this.src='https://placehold.co/70'"><div class="product-info"><div style="display:flex; justify-content:space-between"><h4 class="product-name">${p.name}</h4><span class="stock-badge ${p.stock>0?'good':'out'}">${p.stock>0?`Qty: ${p.stock}`:'SOLD OUT'}</span></div><p class="product-price">₱${p.price}</p>${controls}</div></div>`;
    });
}

async function updateStock(id, qty) { await updateDoc(doc(db, "products", id), { stock: parseInt(qty) }); }
async function deleteProduct(id) { if(confirm("Delete item?")) await deleteDoc(doc(db, "products", id)); }

function toggleFav(id) {
    const idx = favorites.indexOf(id);
    if(idx !== -1) favorites.splice(idx, 1);
    else favorites.push(id);
    localStorage.setItem('localFavs', JSON.stringify(favorites));
    if(!document.getElementById('view-favorite').classList.contains('hidden')) renderFavorites();
    else renderMenu();
}

function addToCart(id, qtyInputId) {
    const qtyEl = document.getElementById(qtyInputId);
    const qty = parseInt(qtyEl.value);
    const p = products.find(x => x.id === id);
    if (qty > p.stock) return alert(`Only ${p.stock} left.`);
    const existing = cart.find(x => x.id === id);
    if (existing) { if(existing.qty + qty > p.stock) return alert("Limit reached"); existing.qty += qty; } 
    else { cart.push({ ...p, qty: qty }); }
    alert("Added!"); qtyEl.value = 1;
}

function renderCart() {
    const container = document.getElementById('cart-container');
    const actions = document.getElementById('cart-actions');
    let total = 0;
    if (cart.length === 0) { container.innerHTML = "<p style='text-align:center;color:#999;margin-top:20px'>Tray Empty</p>"; actions.classList.add('hidden'); return; }
    container.innerHTML = cart.map((item, idx) => {
        total += item.price * item.qty;
        const removeId = `rem-${idx}`;
        setTimeout(() => { document.getElementById(removeId).onclick = () => { cart.splice(idx,1); renderCart(); }; }, 0);
        return `<div class="product-card"><div class="product-info"><h4>${item.name}</h4><small>₱${item.price} x ${item.qty}</small></div><div><strong style="color:#D32F2F">₱${item.price*item.qty}</strong><button style="color:red;border:none;background:none;margin-left:10px" id="${removeId}">×</button></div></div>`;
    }).join('');
    document.getElementById('cart-total').innerText = total;
    actions.classList.remove('hidden');
}

async function checkout() {
    if(!confirm("Confirm Order?")) return;
    const total = document.getElementById('cart-total').innerText;
    await addDoc(collection(db, "orders"), { 
        items: cart, 
        total: total, 
        status: 'Pending', 
        user: currentUser.name,
        lrn: currentUser.lrn || "N/A", 
        userId: currentUser.id, 
        date: new Date().toLocaleString(), 
        timestamp: Date.now() 
    });
    cart.forEach(async (c) => { const p = products.find(p => p.id === c.id); if(p) await updateDoc(doc(db, "products", c.id), { stock: p.stock - c.qty }); });
    cart = []; renderCart(); nav('orders', document.getElementById('nav-orders'));
}

function renderQueue() {
    const container = document.getElementById('queue-container');
    const activeOrders = orders.filter(o => o.status !== 'Picked Up' && o.status !== 'Completed');
    if (activeOrders.length === 0) return container.innerHTML = "<p style='text-align:center;color:#999'>No active orders.</p>";
    container.innerHTML = activeOrders.map(o => {
        const btnId = `act-${o.id}`; const repId = `rep-${o.id}`;
        let actionBtn = "";
        if (o.status === 'Pending') actionBtn = `<button class="btn btn-primary" style="width:100%" id="${btnId}">Start Preparing</button>`;
        else if (o.status === 'Preparing') actionBtn = `<button class="btn btn-blue" style="width:100%; background:#ff9800" id="${btnId}">Mark Ready</button>`;
        else if (o.status === 'Ready') actionBtn = `<button class="btn btn-blue" style="width:100%; background:#4caf50" id="${btnId}">Complete</button>`;
        setTimeout(() => {
            if(document.getElementById(btnId)) {
                let nextStat = o.status === 'Pending' ? 'Preparing' : (o.status === 'Preparing' ? 'Ready' : 'Completed');
                document.getElementById(btnId).onclick = () => updateOrder(o.id, nextStat);
            }
            document.getElementById(repId).onclick = () => openReportModal(o.userId);
        }, 0);
        return `
        <div class="order-card" style="display:block; border-left: 5px solid #ccc">
            <div style="display:flex; justify-content:space-between">
                <strong>#${o.id.slice(0,4)}</strong> 
                <div style="text-align:right">
                    <span style="color:#1565C0; font-weight:bold;">${o.user}</span><br>
                    <small style="color:#555; font-size:10px;">LRN: ${o.lrn || 'N/A'}</small>
                </div>
                <button id="${repId}" style="border:none;background:none">⚠️</button>
            </div>
            <p style="font-size:12px;color:#666; margin-top:5px;">${o.items.map(i=>`${i.name} x${i.qty}`).join(', ')}</p>
            <div style="margin-bottom:5px;">Status: <b>${o.status}</b></div>
            ${actionBtn}
        </div>`;
    }).join('');
}

async function updateOrder(id, status) { await updateDoc(doc(db, "orders", id), { status: status }); }

function renderHistory() { 
    const container = document.getElementById('history-container'); 
    const term = document.getElementById('history-search').value.toLowerCase(); 
    const logs = orders.filter(o => (o.status === 'Completed') && (o.user.toLowerCase().includes(term))); 
    container.innerHTML = logs.map(o => `
    <div class="order-card" style="display:block; opacity:0.7">
        <div>
            <strong>${o.user}</strong> <br>
            <small>LRN: ${o.lrn || 'N/A'}</small>
            <span style="font-size:10px; float:right">${o.date}</span>
        </div>
        <p style="font-size:12px">${o.items.map(i=>i.name).join(', ')}</p>
        <p style="text-align:right; font-weight:bold">₱${o.total}</p>
    </div>`).join(''); 
}

function renderStudentOrders() { const container = document.getElementById('student-orders-container'); const myOrders = orders.filter(o => o.userId === currentUser.id); container.innerHTML = myOrders.map(o => `<div class="order-card" style="display:block"><div style="display:flex;justify-content:space-between"><strong>#${o.id.slice(0,4)}</strong><span style="color:${o.status==='Ready'?'green':'orange'}">${o.status}</span></div><p style="font-size:12px;color:#666">${o.items.map(i=>i.name).join(', ')}</p><p style="text-align:right;margin:0;font-weight:bold">₱${o.total}</p></div>`).join('') || "<p style='text-align:center;color:#999'>No orders.</p>"; }
async function saveProduct() { const n = document.getElementById('new-p-name').value, p = document.getElementById('new-p-price').value, s = document.getElementById('new-p-stock').value, c = document.getElementById('new-p-cat').value, i = document.getElementById('new-p-img').value; if(n&&p) { await addDoc(collection(db, "products"), { name:n, price:parseInt(p), stock:parseInt(s), category:c, img:i||'https://placehold.co/70' }); document.getElementById('add-product-modal').classList.add('hidden'); } }
function openReportModal(uid) { reportTargetId = uid; document.getElementById('report-modal').classList.remove('hidden'); }
async function submitReport() { const reason = document.getElementById('report-reason').value; const u = users.find(x => x.id === reportTargetId); if(reason && u) { await addDoc(collection(db, "reports"), { student: u.name, lrn: u.lrn, reason, reportedBy: currentUser.name, date: new Date().toLocaleDateString() }); alert("Reported"); document.getElementById('report-modal').classList.add('hidden'); } }
function openQRModal() { document.getElementById('real-qr-code').src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`; document.getElementById('qr-modal').classList.remove('hidden'); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }

function searchProducts() { 
    const term = document.getElementById('search-bar').value.toLowerCase();
    renderMenu(term);
}

window.handleLogin = handleLogin;
window.logout = logout;
window.searchProducts = searchProducts;
window.renderAccounts = renderAccounts;
window.renderHistory = renderHistory;
window.saveProduct = saveProduct;
window.addNewUser = addNewUser;
window.submitReport = submitReport;
window.openQRModal = openQRModal;
window.openModal = openModal;
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); };
window.checkout = checkout;
window.filterMenu = function(el, cat) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    currentCategory = cat;
    renderMenu();
};
window.nav = nav;
window.addToCartFromFav = addToCartFromFav;
window.toggleFav = toggleFav;
window.deleteProduct = deleteProduct;
window.updateStock = updateStock;
window.registerStudent = registerStudent;