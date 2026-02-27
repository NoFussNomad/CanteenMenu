import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBJm2gDRCvcgg0vpcE7t3Q7NbVJaav7Ez4",
    authDomain: "canteen-menu-cd0c4.firebaseapp.com",
    projectId: "canteen-menu-cd0c4",
    storageBucket: "canteen-menu-cd0c4.firebasestorage.app",
    messagingSenderId: "781515846780",
    appId: "1:781515846780:web:aa0c81ed19c7c84bff85f9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- GLOBAL STATE & PERSISTENT MEMORY ---
let currentUser = JSON.parse(localStorage.getItem('canteenUser')) || null;
let selectedCanteen = localStorage.getItem('selectedCanteen') || null; 

// THE FIX: Persistent Cart and Favorites linked to User ID
let cart = currentUser ? (JSON.parse(localStorage.getItem(`cart_${currentUser.id}`)) || []) : [];
let favorites = currentUser ? (JSON.parse(localStorage.getItem(`favs_${currentUser.id}`)) || []) : [];

let currentCategory = 'biscuit';
let users = [];
let products = [];
let orders = [];
let reports = []; 

// --- INITIALIZATION ---
async function init() {
    onSnapshot(collection(db, "users"), (snap) => {
        users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Security Auto-Kicker
        if (currentUser && users.length > 0) {
            const freshUser = users.find(u => u.id === currentUser.id);
            if (!freshUser) {
                alert("Your account has been removed by the Admin.");
                window.handleLogout(true); 
                return;
            }
            
            let isBanned = false;
            if (freshUser.banUntil === 'indefinite') isBanned = true;
            else if (freshUser.banUntil && freshUser.banUntil > Date.now()) isBanned = true;

            if (isBanned) {
                alert("Your account has been suspended by the Admin. You are being logged out.");
                window.handleLogout(true); 
                return;
            }

            currentUser = freshUser;
            localStorage.setItem('canteenUser', JSON.stringify(freshUser));
            
            if(currentUser.role === 'admin') renderAccounts();
        }
    });

    onSnapshot(collection(db, "products"), (snap) => {
        products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(currentUser && selectedCanteen) {
            renderMenu();
            if (!document.getElementById('view-favorite').classList.contains('hidden')) {
                renderFavorites();
            }
        }
    });

    onSnapshot(collection(db, "orders"), (snap) => {
        orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => b.timestamp - a.timestamp);
        if(currentUser) {
            if(currentUser.role === 'student' || currentUser.role === 'teacher') renderStudentOrders();
            if(currentUser.role === 'staff') {
                renderQueue();
                renderTransactions();
            }
        }
    });

    onSnapshot(collection(db, "reports"), (snap) => {
        reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => b.timestamp - a.timestamp);
        if(currentUser && currentUser.role === 'admin') renderReports();
    });

    // PAGE REFRESH HANDLER
    if (currentUser) {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        populateUserProfile(currentUser); 
        updateUIForRole(); 
    } else {
        document.getElementById('login-view').classList.remove('hidden');
    }
}
init();

// --- UI POPULATOR ---
function populateUserProfile(user) {
    document.getElementById('profile-name').innerText = `${user.firstname} ${user.lastname}`;
    document.getElementById('profile-initials').innerText = (user.firstname.charAt(0) || "-").toUpperCase();
    document.getElementById('profile-role').innerText = user.role.toUpperCase();
    document.getElementById('profile-display-lrn').innerText = user.lrn;
    
    const extras = document.getElementById('profile-extras');
    extras.classList.remove('hidden');
    
    if(user.role === 'student') {
        extras.innerHTML = `<div><span>Section:</span> <strong>${user.section || "N/A"}</strong></div><div><span>Adviser:</span> <strong>${user.adviser || "N/A"}</strong></div>`;
    } else if (user.role === 'teacher') {
        extras.innerHTML = `<div><span>Advisory:</span> <strong>Grade ${user.grade || "N/A"}</strong></div><div><span>Cluster:</span> <strong>${user.cluster || "N/A"}</strong></div>`;
    } else if (user.role === 'staff') {
        extras.innerHTML = `<div><span>Location:</span> <strong>Canteen ${user.canteen || '1'}</strong></div>`;
    } else {
        extras.classList.add('hidden');
    }

    let showNote = false;
    let noteMsg = "";

    if (user.noteUntil === 'indefinite') {
        showNote = true;
        noteMsg = "This notice will remain active until removed by the Admin.";
    } else if (user.noteUntil && user.noteUntil > Date.now()) {
        showNote = true;
        let daysLeft = Math.ceil((user.noteUntil - Date.now()) / (1000 * 60 * 60 * 24));
        noteMsg = `This notice will disappear in ${daysLeft} day(s).`;
    }

    if (showNote && user.adminMessage) {
        document.getElementById('student-warning-message').innerText = user.adminMessage;
        document.getElementById('student-warning-duration').innerText = noteMsg;
        document.getElementById('student-warning-modal').classList.remove('hidden');
    }
}

// --- AUTHENTICATION & LOGIN GATEKEEPER ---
window.handleLogin = function() {
    const id = document.getElementById('login-id').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const user = users.find(u => u.lrn === id && u.password === pass);

    if (!user) return alert("User not found or Wrong Password!");
    
    let isBanned = false;
    let banMsg = "";
    
    if (user.banUntil === 'indefinite') {
        isBanned = true;
        banMsg = "Banned indefinitely by Admin.";
    } else if (user.banUntil && user.banUntil > Date.now()) {
        isBanned = true;
        let daysLeft = Math.ceil((user.banUntil - Date.now()) / (1000 * 60 * 60 * 24));
        banMsg = `Account suspended. You will be unbanned in ${daysLeft} day(s).`;
    }

    if (isBanned) {
        return alert(`⛔ LOGIN BLOCKED\n\n${banMsg}\nNote from Admin: ${user.adminMessage || "No reason provided."}`);
    }

    currentUser = user;
    localStorage.setItem('canteenUser', JSON.stringify(user));
    
    // Load their specific Cart and Favorites
    favorites = JSON.parse(localStorage.getItem(`favs_${currentUser.id}`)) || [];
    cart = JSON.parse(localStorage.getItem(`cart_${currentUser.id}`)) || [];
    
    selectedCanteen = null; 
    localStorage.removeItem('selectedCanteen');

    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    populateUserProfile(currentUser);
    updateUIForRole();
}

window.handleLogout = function(force = false) {
    if(force === true || confirm("Log out?")) {
        localStorage.removeItem('canteenUser');
        localStorage.removeItem('selectedCanteen');
        selectedCanteen = null;
        currentUser = null;
        cart = [];
        window.location.reload();
    }
}


// --- NAVIGATION & CANTEEN ROUTING ---
function updateUIForRole() {
    const adminBar = document.getElementById('admin-bar');
    const adminActions = document.getElementById('admin-actions');
    const topControls = document.getElementById('top-controls');
    const canteenBanner = document.getElementById('canteen-banner');

    document.querySelectorAll('.student-only, .staff-only, .admin-only, .teacher-only').forEach(e => e.classList.add('hidden'));

    if (currentUser.role === 'student' || currentUser.role === 'teacher') {
        adminBar.style.display = 'none';
        
        if(currentUser.role === 'student') document.querySelectorAll('.student-only').forEach(e => e.classList.remove('hidden'));
        if(currentUser.role === 'teacher') document.querySelectorAll('.teacher-only').forEach(e => e.classList.remove('hidden'));

        if (selectedCanteen) {
            canteenBanner.classList.remove('hidden');
            document.getElementById('canteen-banner-text').innerText = `📍 Viewing Canteen ${selectedCanteen}`;
            document.getElementById('switch-canteen-btn').classList.remove('hidden');
            topControls.classList.remove('hidden');
            window.nav('menu', document.getElementById('nav-menu'));
        } else {
            topControls.classList.add('hidden'); 
            canteenBanner.classList.add('hidden'); 
            window.nav('canteen-select', null);
        }
    } 
    else {
        adminBar.style.display = 'flex';
        document.getElementById('admin-role-display').innerText = currentUser.role.toUpperCase() + " DASHBOARD";
        
        if (currentUser.role === 'staff') {
            selectedCanteen = currentUser.canteen || "1";
            document.querySelectorAll('.staff-only').forEach(e => e.classList.remove('hidden'));
            topControls.classList.remove('hidden'); 
            adminActions.innerHTML = `<button class="btn btn-primary" onclick="window.openAddProduct()">+ Add Item</button>`;
            
            canteenBanner.classList.remove('hidden');
            document.getElementById('canteen-banner-text').innerText = `👨‍🍳 Managing Canteen ${selectedCanteen}`;
            document.getElementById('switch-canteen-btn').classList.add('hidden');
            
            window.nav('menu', document.getElementById('nav-menu')); 
        } 
        else if (currentUser.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('hidden'));
            topControls.classList.add('hidden'); 
            canteenBanner.classList.add('hidden'); 
            adminActions.innerHTML = "";
            window.nav('reports', document.getElementById('nav-reports')); 
        }
    }
}

window.nav = function(target, el) {
    if (target === 'menu' && !selectedCanteen && (currentUser.role === 'student' || currentUser.role === 'teacher')) {
        target = 'canteen-select';
    }

    if(el) {
        document.querySelectorAll('.footer-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
    }
    
    document.querySelectorAll('.main-scroll > div').forEach(v => v.classList.add('hidden'));
    
    const topControls = document.getElementById('top-controls');
    const footer = document.querySelector('.footer');
    
    if (target === 'canteen-select') {
        footer.classList.add('hidden');
        topControls.classList.add('hidden');
    } else {
        footer.classList.remove('hidden');
        if (target === 'menu' && currentUser.role !== 'admin') {
            topControls.classList.remove('hidden');
        } else {
            topControls.classList.add('hidden');
        }
    }

    document.getElementById('view-' + target).classList.remove('hidden');
    
    if (target === 'menu') renderMenu();
    if (target === 'cart') renderCart();
    if (target === 'orders') renderStudentOrders();
    if (target === 'queue') renderQueue();
    if (target === 'transactions') renderTransactions(); 
    if (target === 'reports') renderReports(); 
    if (target === 'accounts') renderAccounts();
    if (target === 'favorite') renderFavorites(); 
}

window.selectCanteen = function(canteenNumber) {
    selectedCanteen = canteenNumber;
    localStorage.setItem('selectedCanteen', canteenNumber); 
    
    document.getElementById('canteen-banner').classList.remove('hidden');
    document.getElementById('canteen-banner-text').innerText = `📍 Viewing Canteen ${canteenNumber}`;
    document.getElementById('switch-canteen-btn').classList.remove('hidden');
    
    window.nav('menu', document.getElementById('nav-menu'));
}

window.promptSwitchCanteen = function() {
    if (cart.length > 0) {
        if (!confirm("Switching canteens will empty your current cart. Proceed?")) return;
        // Wipes cart safely on switch
        cart = [];
        localStorage.removeItem(`cart_${currentUser.id}`);
        renderCart();
    }
    selectedCanteen = null;
    localStorage.removeItem('selectedCanteen');
    document.getElementById('canteen-banner').classList.add('hidden');
    window.nav('canteen-select', null);
}


// --- MENU & PRODUCT MANAGEMENT ---
window.openAddProduct = function() {
    document.getElementById('product-modal-title').innerText = "Add New Item";
    document.getElementById('edit-product-id').value = "";
    document.getElementById('new-p-name').value = "";
    document.getElementById('new-p-price').value = "";
    document.getElementById('new-p-stock').value = "";
    document.getElementById('new-p-img').value = "";
    document.getElementById('add-product-modal').classList.remove('hidden');
}

window.editProduct = function(id) {
    const p = products.find(x => x.id === id);
    if(!p) return;
    document.getElementById('product-modal-title').innerText = "Edit Item";
    document.getElementById('edit-product-id').value = p.id;
    document.getElementById('new-p-name').value = p.name;
    document.getElementById('new-p-price').value = p.price;
    document.getElementById('new-p-stock').value = p.stock;
    document.getElementById('new-p-img').value = p.img || "";
    document.getElementById('new-p-cat').value = p.category;
    document.getElementById('add-product-modal').classList.remove('hidden');
}

window.saveProduct = async function() { 
    try {
        const editId = document.getElementById('edit-product-id').value;
        const n = document.getElementById('new-p-name').value;
        const p = document.getElementById('new-p-price').value;
        const s = document.getElementById('new-p-stock').value;
        const c = document.getElementById('new-p-cat').value; 
        const i = document.getElementById('new-p-img').value;
        
        if(n && p) { 
            const productData = { 
                name: n, price: parseInt(p), stock: parseInt(s), category: c, img: i || 'https://placehold.co/70',
                canteen: currentUser.canteen || "1" 
            };
            if (editId) { 
                await updateDoc(doc(db, "products", editId), productData); 
                alert("Item Updated!"); 
            } else { 
                await addDoc(collection(db, "products"), productData); 
                alert("Item Added!"); 
            }
            document.getElementById('add-product-modal').classList.add('hidden'); 
        } else { alert("Please enter a name and price."); }
    } catch(err) { alert("Error saving item: " + err.message); }
}

window.updateStock = async function(id, val) { await updateDoc(doc(db, "products", id), { stock: parseInt(val) }); }
window.deleteProduct = async function(id) { if(confirm("Delete item completely?")) { await deleteDoc(doc(db, "products", id)); } }

window.renderMenu = function(term = "") {
    const container = document.getElementById('menu-container');
    container.innerHTML = "";
    if(!term) term = document.getElementById('search-bar').value.toLowerCase();
    
    const filtered = products.filter(p => 
        (p.category === currentCategory) && 
        (p.name.toLowerCase().includes(term)) &&
        ((p.canteen || "1") === selectedCanteen) 
    ).sort((a,b) => a.name.localeCompare(b.name));
    
    filtered.forEach(p => {
        let controls = "";
        let isFav = favorites.includes(p.id);

        if (currentUser.role === 'staff') {
            controls = `
            <div style="display:flex; gap:5px; margin-top:10px;">
                <input type="number" id="stock-${p.id}" value="${p.stock}" class="qty-input" style="width:50px" onchange="window.updateStock('${p.id}', this.value)">
                <button class="btn btn-outline" style="flex:1; padding:5px; font-size:10px;" onclick="window.editProduct('${p.id}')">Edit</button>
                <button class="btn btn-outline" style="color:red; border-color:red; padding:5px; font-size:10px;" onclick="window.deleteProduct('${p.id}')">Del</button>
            </div>`;
        } else {
            if(p.stock > 0) {
                controls = `
                <div class="qty-wrapper">
                    <button class="fav-btn ${isFav?'active':''}" onclick="window.toggleFav('${p.id}')">❤</button>
                    <input type="number" id="qty-${p.id}" class="qty-input" value="1" min="1">
                    <button class="btn btn-primary" onclick="window.addToCart('${p.id}', 'qty-${p.id}')" style="flex:1">Add</button>
                </div>`;
            } else {
                controls = `<button class="btn" disabled style="width:100%; margin-top:5px; background:#ddd; color:#888;">Out of Stock</button>`;
            }
        }
        
        container.innerHTML += `
        <div class="product-card">
            <img src="${p.img}" class="product-img">
            <div class="product-info">
                <h4>${p.name}</h4>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <p class="product-price" style="margin:0;">₱${p.price}</p>
                    <span style="font-size:10px; color:#666; font-weight:bold;">Stock: ${p.stock}</span>
                </div>
                ${controls}
            </div>
        </div>`;
    });
}

window.renderFavorites = function() {
    const container = document.getElementById('fav-container');
    container.innerHTML = "";
    if (favorites.length === 0) return container.innerHTML = "<p style='text-align:center;color:#999;margin-top:20px;'>No saved favorites.</p>";

    const favProducts = products.filter(p => favorites.includes(p.id) && ((p.canteen || "1") === selectedCanteen)).sort((a,b) => a.name.localeCompare(b.name));
                                
    if (favProducts.length === 0) {
         container.innerHTML = `<p style='text-align:center;color:#999;margin-top:20px; font-size:12px;'>You have favorites, but they are not sold in Canteen ${selectedCanteen}.</p>`;
         return;
    }

    favProducts.forEach(p => {
        let controls = "";
        if(p.stock > 0) {
            controls = `<div class="qty-wrapper"><button class="fav-btn active" onclick="window.toggleFav('${p.id}')">❤</button><input type="number" id="fav-qty-${p.id}" class="qty-input" value="1" min="1"><button class="btn btn-primary" onclick="window.addToCart('${p.id}', 'fav-qty-${p.id}')" style="flex:1">Add</button></div>`;
        } else {
            controls = `<div class="qty-wrapper"><button class="fav-btn active" onclick="window.toggleFav('${p.id}')">❤</button><button class="btn" disabled style="width:100%; background:#ddd; color:#888;">Out of Stock</button></div>`;
        }
        container.innerHTML += `<div class="product-card"><img src="${p.img}" class="product-img"><div class="product-info"><h4>${p.name}</h4><div style="display:flex; justify-content:space-between; align-items:center;"><p class="product-price" style="margin:0;">₱${p.price}</p><span style="font-size:10px; color:#666; font-weight:bold;">Stock: ${p.stock}</span></div>${controls}</div></div>`;
    });
}

window.toggleFav = function(id) {
    const idx = favorites.indexOf(id);
    if(idx !== -1) favorites.splice(idx, 1); else favorites.push(id);
    localStorage.setItem(`favs_${currentUser.id}`, JSON.stringify(favorites));
    if (!document.getElementById('view-favorite').classList.contains('hidden')) renderFavorites();
    if (!document.getElementById('view-menu').classList.contains('hidden')) renderMenu();
}


// --- CART & CHECKOUT LOGIC ---
window.addToCart = function(id, qtyInputId) {
    const qty = parseInt(document.getElementById(qtyInputId).value);
    const p = products.find(x => x.id === id);
    if (qty > p.stock) return alert(`Only ${p.stock} left.`);
    
    const existing = cart.find(x => x.id === id);
    if (existing) existing.qty += qty; 
    else cart.push({ ...p, qty: qty });
    
    // THE FIX: Saves Cart to Persistent Storage
    localStorage.setItem(`cart_${currentUser.id}`, JSON.stringify(cart));
    
    alert("Added!"); 
    document.getElementById(qtyInputId).value = 1;
}

// THE FIX: Safely Removes Item from Persistent Storage
window.removeFromCart = function(idx) {
    cart.splice(idx, 1);
    localStorage.setItem(`cart_${currentUser.id}`, JSON.stringify(cart));
    window.renderCart();
}

window.renderCart = function() {
    const container = document.getElementById('cart-container');
    let total = 0;
    
    if (cart.length === 0) { 
        container.innerHTML = "<p style='text-align:center;color:#999'>Tray Empty</p>"; 
        document.getElementById('cart-actions').classList.add('hidden'); 
        return; 
    }
    
    container.innerHTML = cart.map((item, idx) => { 
        total += item.price * item.qty; 
        return `
        <div class="product-card">
            <div class="product-info">
                <h4>${item.name}</h4><small>₱${item.price} x ${item.qty}</small>
            </div>
            <div>
                <strong style="color:#D32F2F">₱${item.price*item.qty}</strong>
                <button style="color:red;border:none;background:none;margin-left:10px" onclick="window.removeFromCart(${idx})">×</button>
            </div>
        </div>`; 
    }).join('');
    
    document.getElementById('cart-total').innerText = total;
    document.getElementById('cart-actions').classList.remove('hidden');
}

window.toggleGCash = function() {
    const method = document.getElementById('payment-method').value;
    if(method === 'GCash') {
        document.getElementById('gcash-details').classList.remove('hidden');
    } else {
        document.getElementById('gcash-details').classList.add('hidden');
    }
}

window.checkout = async function() {
    if(!confirm("Confirm Order?")) return;
    
    const method = document.getElementById('payment-method').value;
    const refNum = document.getElementById('gcash-ref').value.trim();
    if (method === 'GCash' && !refNum) return alert("Please enter your GCash Reference Number to proceed.");

    const d = new Date(); 
    const mm = String(d.getMonth() + 1).padStart(2, '0'); 
    const dd = String(d.getDate()).padStart(2, '0'); 
    const dateCode = `${mm}${dd}`; 
    const count = orders.filter(o => o.orderIdBase === dateCode).length; 
    const customId = `${dateCode}-${count + 1}`; 
    const total = document.getElementById('cart-total').innerText;
    
    await addDoc(collection(db, "orders"), { 
        customId: customId, orderIdBase: dateCode, items: cart, total: total, status: 'Pending', 
        user: `${currentUser.firstname} ${currentUser.lastname}`, lrn: currentUser.lrn, userId: currentUser.id, 
        canteen: selectedCanteen, paymentMethod: method, paymentRef: refNum, date: d.toLocaleString(), timestamp: Date.now() 
    });

    // THE FIX: Negative Stock Safety Check (`Math.max(0, ...)`)
    cart.forEach(async (c) => { 
        const p = products.find(p => p.id === c.id); 
        if(p) {
            let safeStock = Math.max(0, p.stock - c.qty);
            await updateDoc(doc(db, "products", c.id), { stock: safeStock }); 
        }
    });

    cart = []; 
    localStorage.removeItem(`cart_${currentUser.id}`); // Clear local storage cart
    document.getElementById('gcash-ref').value = ""; 
    renderCart(); 
    window.nav('orders', document.getElementById('nav-orders'));
}


// --- STAFF ORDER QUEUE & TRANSACTIONS ---
window.renderQueue = function() {
    const container = document.getElementById('queue-container');
    const userCanteen = currentUser.canteen || "1";
    
    const activeOrders = orders.filter(o => o.status !== 'Completed' && (o.canteen === userCanteen || (!o.canteen && userCanteen === "1")));
    
    if (activeOrders.length === 0) {
        container.innerHTML = "<p style='text-align:center;color:#999'>No active orders.</p>";
        return;
    }
    
    container.innerHTML = activeOrders.map(o => {
        let actionBtn = ""; let borderColor = "#ccc"; let statusColor = "#555";
        
        if (o.status === 'Pending') { 
            actionBtn = `<button class="btn btn-primary" style="flex:1;" onclick="window.updateStatus('${o.id}', 'Preparing')">Start Preparing</button>`; 
            borderColor = "#f44336"; statusColor = "#f44336"; 
        } else if (o.status === 'Preparing') { 
            actionBtn = `<button class="btn btn-primary" style="flex:1; background:#ff9800" onclick="window.updateStatus('${o.id}', 'Ready')">Mark Ready</button>`; 
            borderColor = "#ff9800"; statusColor = "#ff9800"; 
        } else if (o.status === 'Ready') { 
            actionBtn = `<button class="btn btn-primary" style="flex:1; background:#4caf50" onclick="window.updateStatus('${o.id}', 'Completed')">Complete</button>`; 
            borderColor = "#4caf50"; statusColor = "#4caf50"; 
        }

        let payBadge = o.paymentMethod === 'GCash' 
            ? `<span style="background:#1565C0; color:white; padding:2px 6px; border-radius:4px; font-size:10px;">📱 GCash: ${o.paymentRef}</span>`
            : `<span style="background:#4caf50; color:white; padding:2px 6px; border-radius:4px; font-size:10px;">💵 Cash</span>`;
        
        return `
        <div class="order-card" style="display:block; border-left: 5px solid ${borderColor}; padding:15px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <strong style="font-size:16px;">#${o.customId}</strong> 
                <span style="font-size:11px; font-weight:bold; color:${statusColor}; border: 1px solid ${statusColor}; padding:3px 8px; border-radius:10px; text-transform:uppercase;">${o.status}</span>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:14px; color:#1565C0; font-weight:bold;">👤 ${o.user}</div>
                ${payBadge}
            </div>
            
            <details style="margin-bottom:15px; background:#f9f9f9; padding:10px; border-radius:8px; border:1px solid #eee;">
                <summary style="font-size:12px; font-weight:bold; color:#555; cursor:pointer;">View Order Items (₱${o.total})</summary>
                <ul style="font-size:13px; padding-left:20px; color:#333; margin-top:8px; margin-bottom:0;">
                    ${o.items.map(i=>`<li>${i.name} <b style="color:#D32F2F">x${i.qty}</b></li>`).join('')}
                </ul>
            </details>

            <div style="display:flex; gap:10px;">
                ${actionBtn}
                <button class="btn btn-outline" style="padding:10px 15px;" onclick="window.printReceipt('${o.id}')">🖨️</button>
            </div>
        </div>`;
    }).join('');
}

window.renderTransactions = function() {
    const container = document.getElementById('transactions-container'); 
    const term = document.getElementById('transaction-search').value.toLowerCase(); 
    const userCanteen = currentUser.canteen || "1";
    
    const logs = orders.filter(o => (o.status === 'Completed') && (o.canteen === userCanteen || (!o.canteen && userCanteen === "1")) && (`${o.user} ${o.customId}`.toLowerCase().includes(term))); 
    
    if(logs.length === 0) {
        container.innerHTML = "<p style='text-align:center;color:#999'>No completed transactions found.</p>";
        return;
    }

    container.innerHTML = logs.map(o => {
        let payBadge = o.paymentMethod === 'GCash' 
            ? `<span style="color:#1565C0; font-weight:bold; font-size:10px;">📱 GCash: ${o.paymentRef}</span>`
            : `<span style="color:#4caf50; font-weight:bold; font-size:10px;">💵 Cash</span>`;

        return `
        <div class="order-card" style="display:block; padding:0;">
            <details style="padding:15px;">
                <summary>
                    <div style="display:flex; justify-content:space-between; width:100%">
                        <strong>#${o.customId}</strong>
                        <span style="font-size:10px;">${o.date}</span>
                    </div>
                </summary>
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="font-weight:bold;">${o.user} <span style="font-weight:normal; color:#666;">(${o.lrn})</span></span>
                        ${payBadge}
                    </div>
                    
                    <ul style="font-size:12px; padding-left:20px; color:#555; margin:5px 0;">
                        ${o.items.map(i => `<li>${i.name} x${i.qty}</li>`).join('')}
                    </ul>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-weight:bold; color:#D32F2F;">Total: ₱${o.total}</span>
                        <label style="display:flex; align-items:center; gap:5px; font-size:10px;">
                            <input type="checkbox" class="hist-check" value="${o.id}"> Select
                        </label>
                    </div>
                    
                    <div style="display:flex; gap:5px;">
                        <button class="btn btn-outline" style="flex:1; padding:10px 5px;" onclick="window.printReceipt('${o.id}')">🖨️</button>
                        <button class="btn btn-danger" style="flex:1.5;" onclick="window.openReportModal('${o.lrn}')">⚠️ Report</button>
                        <button class="btn btn-outline" style="flex:1; color:red; border-color:red; padding:10px 5px;" onclick="window.deleteLog('${o.id}')">🗑️ Del</button>
                    </div>
                </div>
            </details>
        </div>`
    }).join(''); 
}

window.updateStatus = async function(id, status) { await updateDoc(doc(db, "orders", id), { status: status }); }
window.deleteLog = async function(id) { if(confirm("Delete this transaction permanently?")) { await deleteDoc(doc(db, "orders", id)); } }

window.deleteBulkTransactionDate = async function() {
    const dateInput = document.getElementById('transaction-date-filter').value; 
    if(!dateInput) return alert("Select a date first.");
    const targetDate = new Date(dateInput).toDateString();
    const userCanteen = currentUser.canteen || "1";
    
    const toDelete = orders.filter(o => o.status === 'Completed' && (o.canteen === userCanteen || (!o.canteen && userCanteen === "1")) && new Date(o.timestamp).toDateString() === targetDate);
    if(toDelete.length === 0) return alert("No completed transactions found for this date.");

    if(confirm(`Delete ${toDelete.length} transactions from this date?`)) {
        const batch = writeBatch(db);
        toDelete.forEach(o => batch.delete(doc(db, "orders", o.id)));
        await batch.commit();
        alert("Deleted.");
    }
}

window.deleteSelectedTransactions = async function() {
    const checks = document.querySelectorAll('.hist-check:checked');
    if(checks.length === 0) return alert("No items selected.");
    if(confirm(`Delete ${checks.length} selected transactions?`)) {
        const batch = writeBatch(db);
        checks.forEach(c => batch.delete(doc(db, "orders", c.value)));
        await batch.commit();
        alert("Deleted.");
    }
}

// --- STUDENT ORDER HISTORY ---
window.renderStudentOrders = function() {
    const container = document.getElementById('student-orders-container');
    const myOrders = orders.filter(o => o.userId === currentUser.id);
    
    container.innerHTML = myOrders.map(o => `
        <div class="order-card" style="display:block; padding:0;">
            <details style="padding:15px;">
                <summary>
                    <span>Order #${o.customId} <b style="color:#1565C0; font-size:10px; margin-left:5px;">(Canteen ${o.canteen || '1'})</b></span>
                    <span style="font-size:12px; color:${o.status==='Pending'?'orange':'green'}">${o.status}</span>
                </summary>
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <p style="font-size:11px; color:#666;">${o.date} | Payment: ${o.paymentMethod || 'Cash'}</p>
                    <ul style="font-size:13px; padding-left:20px;">
                        ${o.items.map(i => `<li>${i.name} x${i.qty} (₱${i.price*i.qty})</li>`).join('')}
                    </ul>
                    <p style="text-align:right; font-weight:bold;">Total: ₱${o.total}</p>
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        ${o.status === 'Pending' ? `<button class="btn btn-danger" onclick="window.cancelOrder('${o.id}')">Cancel</button>` : ''}
                    </div>
                </div>
            </details>
        </div>`).join('');
}

window.cancelOrder = async function(id) { 
    if(confirm("Cancel this order?")) { 
        await deleteDoc(doc(db, "orders", id)); 
    } 
}

window.printReceipt = function(id) {
    const o = orders.find(x => x.id === id);
    if(!o) return;
    document.getElementById('print-id').innerText = "#" + o.customId;
    document.getElementById('print-date').innerText = o.date;
    
    let html = o.items.map(i => `<div style="display:flex; justify-content:space-between"><span>${i.name} x${i.qty}</span><span>₱${i.price*i.qty}</span></div>`).join('');
    html += `<hr><div style="display:flex; justify-content:space-between; font-size:10px; color:#666;"><span>Payment:</span><span>${o.paymentMethod || 'Cash'}</span></div>`;
    
    document.getElementById('print-items').innerHTML = html;
    document.getElementById('print-total').innerText = "Total: ₱" + o.total;
    window.print();
}


// --- DISCIPLINARY SYSTEM (STAFF & ADMIN) ---
window.openReportModal = function(lrn) {
    document.getElementById('report-lrn').value = lrn;
    document.getElementById('report-reason').value = "";
    document.getElementById('report-modal').classList.remove('hidden');
}

window.submitReport = async function() {
    try {
        const lrn = document.getElementById('report-lrn').value.trim();
        const reason = document.getElementById('report-reason').value.trim();
        
        if(!lrn || !reason) return alert("Please provide the issue.");
        
        const targetUser = users.find(u => u.lrn === lrn && (u.role === 'student' || u.role === 'teacher'));
        if(!targetUser) return alert("Error: No customer found with that ID in the system.");

        await addDoc(collection(db, "reports"), {
            reportedLrn: lrn,
            issue: reason,
            staffName: `${currentUser.firstname} ${currentUser.lastname}`,
            staffId: currentUser.id,
            status: 'Pending',
            timestamp: Date.now()
        });

        alert("Report sent to the Admin successfully.");
        document.getElementById('report-modal').classList.add('hidden');
    } catch(err) { 
        alert("Error submitting report: " + err.message); 
    }
}

window.renderReports = function() {
    const pendingContainer = document.getElementById('reports-pending-container');
    const actionedContainer = document.getElementById('reports-actioned-container');
    
    const pendingReports = reports.filter(r => r.status === 'Pending');
    const actionedReports = reports.filter(r => r.status === 'Reported');

    if(pendingReports.length === 0) {
        pendingContainer.innerHTML = "<p style='font-size:12px; color:#999; font-style:italic;'>No pending reports.</p>";
    } else {
        pendingContainer.innerHTML = pendingReports.map(r => `
        <div class="order-card" style="display:block; padding:15px; border-left: 5px solid #D32F2F; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong>LRN: ${r.reportedLrn}</strong>
                <span style="font-size:11px; font-weight:bold; color:red;">PENDING</span>
            </div>
            <p style="font-size:13px; margin:0 0 5px 0;"><b>Issue:</b> ${r.issue}</p>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <span style="font-size:11px; color:#666; margin:0;">By: ${r.staffName}</span>
                <span style="font-size:10px; color:#999;">${new Date(r.timestamp).toLocaleDateString()}</span>
            </div>
            <button class="btn btn-danger" style="width:100%; margin-top:10px;" onclick="window.openDisciplineModal('${r.reportedLrn}', '${r.id}')">Take Action</button>
        </div>`).join('');
    }

    if(actionedReports.length === 0) {
        actionedContainer.innerHTML = "<p style='font-size:12px; color:#999; font-style:italic;'>No actioned reports yet.</p>";
    } else {
        actionedContainer.innerHTML = actionedReports.map(r => `
        <div class="order-card" style="display:block; padding:15px; border-left: 5px solid #4caf50; opacity:0.8; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong>LRN: ${r.reportedLrn}</strong>
                <span style="font-size:11px; font-weight:bold; color:green;">ACTIONED</span>
            </div>
            <p style="font-size:13px; margin:0 0 5px 0;"><b>Issue:</b> ${r.issue}</p>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <span style="font-size:11px; color:#666; margin:0;">By: ${r.staffName}</span>
                <span style="font-size:10px; color:#999;">${new Date(r.timestamp).toLocaleDateString()}</span>
            </div>
            <button class="btn btn-outline" style="width:100%; margin-top:10px; border-color:green; color:green;" onclick="window.openDisciplineModal('${r.reportedLrn}', '${r.id}')">Update Action</button>
        </div>`).join('');
    }
}

window.openDisciplineModal = function(lrn, reportId) {
    const targetUser = users.find(u => u.lrn === lrn);
    if(!targetUser) return alert("This user no longer exists in the database.");
    
    document.getElementById('discipline-target-id').value = targetUser.id;
    document.getElementById('discipline-report-id').value = reportId;
    document.getElementById('discipline-lrn-display').innerText = lrn;
    
    document.getElementById('discipline-ban-duration').value = "0";
    document.getElementById('discipline-note-duration').value = "0";
    document.getElementById('discipline-message').value = targetUser.adminMessage || "";
    
    document.getElementById('discipline-modal').classList.remove('hidden');
}

window.saveDisciplineAction = async function() {
    try {
        const targetId = document.getElementById('discipline-target-id').value;
        const reportId = document.getElementById('discipline-report-id').value;
        const banVal = document.getElementById('discipline-ban-duration').value;
        const noteVal = document.getElementById('discipline-note-duration').value;
        const message = document.getElementById('discipline-message').value.trim();

        let banUntil = null;
        if (banVal === 'indefinite') banUntil = 'indefinite';
        else if (banVal !== '0') banUntil = Date.now() + (parseInt(banVal) * 24 * 60 * 60 * 1000); 

        let noteUntil = null;
        if (noteVal === 'indefinite') noteUntil = 'indefinite';
        else if (noteVal !== '0') noteUntil = Date.now() + (parseInt(noteVal) * 24 * 60 * 60 * 1000);

        await updateDoc(doc(db, "users", targetId), { 
            banUntil: banUntil, 
            noteUntil: noteUntil, 
            adminMessage: message 
        });

        if(reportId) {
            await updateDoc(doc(db, "reports", reportId), { status: 'Reported' });
        }

        alert("Disciplinary action saved! The student's access has been updated.");
        document.getElementById('discipline-modal').classList.add('hidden');
    } catch(err) { 
        alert("Error saving disciplinary action: " + err.message); 
    }
}


// --- ADMIN: ACCOUNTS MANAGEMENT ---
window.toggleRoleFields = function() {
    const role = document.getElementById('user-role').value;
    
    document.getElementById('id-block').classList.remove('hidden'); 
    
    document.getElementById('student-fields').classList.add('hidden');
    document.getElementById('teacher-fields').classList.add('hidden');
    document.getElementById('staff-fields').classList.add('hidden');
    
    if (role === 'student') { 
        document.getElementById('id-label').innerText = 'LRN (12 Digits)'; 
        document.getElementById('student-fields').classList.remove('hidden'); 
    } 
    else if (role === 'admin') { 
        document.getElementById('id-label').innerText = 'Unique ID Number'; 
    } 
    else if (role === 'teacher') { 
        document.getElementById('id-label').innerText = 'Unique ID Number (Auto-generates if empty)';
        document.getElementById('teacher-fields').classList.remove('hidden'); 
    } 
    else if (role === 'staff') { 
        document.getElementById('id-label').innerText = 'Unique ID Number (Auto-generates if empty)';
        document.getElementById('staff-fields').classList.remove('hidden'); 
    }
}

window.renderAccounts = function() {
    const container = document.getElementById('accounts-container');
    const term = document.getElementById('account-search').value.toLowerCase();
    
    let list = users.filter(u => `${u.lastname} ${u.firstname}`.toLowerCase().includes(term) || u.lrn.includes(term))
                    .sort((a,b) => a.lastname.localeCompare(b.lastname));
                    
    const groups = { 
        "Admins": list.filter(u => u.role === 'admin'), 
        "Teachers": list.filter(u => u.role === 'teacher'), 
        "Staff": list.filter(u => u.role === 'staff'), 
        "Grade 12": list.filter(u => u.role === 'student' && u.grade == '12'), 
        "Grade 11": list.filter(u => u.role === 'student' && u.grade == '11') 
    };
    
    let html = "";
    for(const [label, groupUsers] of Object.entries(groups)) {
        if(groupUsers.length > 0) {
            html += `<h4 style="margin:15px 0 5px; color:#1565C0; border-bottom:1px solid #ddd">${label}</h4>`;
            html += groupUsers.map(u => {
                let statusTag = "";
                if (u.banUntil === 'indefinite' || (u.banUntil && u.banUntil > Date.now())) {
                    statusTag = '<b style="color:red">[BANNED]</b>';
                }
                else if (u.noteUntil === 'indefinite' || (u.noteUntil && u.noteUntil > Date.now())) {
                    statusTag = '<b style="color:orange">[WARNED]</b>';
                }
                
                let displayInfo = u.section || u.role;
                if (u.role === 'staff') displayInfo = `Canteen ${u.canteen || '1'}`;
                if (u.role === 'teacher') displayInfo = `Grade ${u.grade} - ${u.section}`;
                
                return `
                <div class="account-card" style="justify-content:space-between; ${statusTag ? 'border-left: 4px solid red;' : ''}">
                    <div>
                        <strong>${u.lastname}, ${u.firstname}</strong>
                        <small style="color:#666">(${u.lrn})</small><br>
                        <small style="text-transform: capitalize;">${displayInfo} ${statusTag}</small>
                    </div>
                    <button class="btn btn-outline" onclick="window.editUser('${u.id}')" style="font-size:10px; padding:5px">Edit</button>
                </div>`;
            }).join('');
        }
    }
    container.innerHTML = html;
}

window.editUser = function(uId) {
    const u = users.find(x => x.id === uId);
    
    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('modal-title').innerText = "Edit User";
    document.getElementById('user-modal').classList.remove('hidden');
    
    document.getElementById('user-role').value = u.role;
    document.getElementById('user-fname').value = u.firstname;
    document.getElementById('user-mname').value = u.middlename || "";
    document.getElementById('user-lname').value = u.lastname;
    document.getElementById('user-pass').value = u.password;
    
    window.toggleRoleFields(); 
    
    document.getElementById('user-lrn').value = u.lrn || "";
    
    if(u.role === 'student') { 
        document.getElementById('student-grade').value = u.grade || "11"; 
        document.getElementById('student-section').value = u.section || ""; 
        document.getElementById('student-adviser').value = u.adviser || ""; 
    }
    if(u.role === 'teacher') { 
        document.getElementById('teacher-grade').value = u.grade || "11"; 
        document.getElementById('teacher-section').value = u.section || ""; 
        document.getElementById('teacher-cluster').value = u.cluster || "1"; 
    }
    if(u.role === 'staff') { 
        document.getElementById('staff-canteen').value = u.canteen || "1"; 
    }
}

window.saveUser = async function() {
    try {
        const editId = document.getElementById('edit-user-id').value;
        const role = document.getElementById('user-role').value;
        const fname = document.getElementById('user-fname').value.trim();
        const mname = document.getElementById('user-mname').value.trim();
        const lname = document.getElementById('user-lname').value.trim();
        const pass = document.getElementById('user-pass').value.trim();
        
        if(!fname || !lname || !pass) return alert("Fill all required fields.");
        
        let finalLRN = document.getElementById('user-lrn').value.trim();
        
        if (role === 'student') {
            if(!/^\d{12}$/.test(finalLRN)) return alert("LRN must be exactly 12 digits."); 
        } else {
            if (!finalLRN) {
                if (!editId && (role === 'teacher' || role === 'staff')) {
                    finalLRN = Math.floor(100000 + Math.random() * 900000).toString(); 
                } else {
                    return alert("Please enter an ID Number.");
                }
            }
        }

        if(role === 'teacher') { 
            const hasNumbers = /\d/; 
            if(hasNumbers.test(fname) || hasNumbers.test(lname) || (mname && hasNumbers.test(mname))) { 
                return alert("Teacher names cannot contain numbers."); 
            } 
        }

        const exists = users.find(u => u.lrn === finalLRN && u.id !== editId);
        if(exists) return alert("ID already exists in the system.");

        const existingData = editId ? users.find(u => u.id === editId) : {};

        const userData = { 
            role, lrn: finalLRN, firstname: fname, middlename: mname, lastname: lname, password: pass, 
            banUntil: existingData.banUntil || null, 
            noteUntil: existingData.noteUntil || null, 
            adminMessage: existingData.adminMessage || "" 
        };
        
        if(role === 'student') { 
            userData.grade = document.getElementById('student-grade').value; 
            userData.section = document.getElementById('student-section').value.trim(); 
            userData.adviser = document.getElementById('student-adviser').value.trim(); 
        } 
        else if (role === 'teacher') { 
            userData.grade = document.getElementById('teacher-grade').value; 
            userData.section = document.getElementById('teacher-section').value.trim(); 
            userData.cluster = document.getElementById('teacher-cluster').value; 
        } 
        else if (role === 'staff') { 
            userData.canteen = document.getElementById('staff-canteen').value; 
        }

        if(editId) { 
            await updateDoc(doc(db, "users", editId), userData); 
            alert("Account Updated!"); 
        } else { 
            await addDoc(collection(db, "users"), userData); 
            if (role === 'teacher' || role === 'staff') { 
                alert(`Account Created!\n\nIMPORTANT: Their Login ID is: ${finalLRN}\n\nMake sure to give them this number!`); 
            } else { 
                alert("Account Created!"); 
            } 
        }
        
        document.getElementById('user-modal').classList.add('hidden');
        
    } catch (error) { 
        alert("SYSTEM CRASH DETECTED: " + error.message); 
        console.error(error); 
    }
}

// --- EVENT LISTENERS ---
document.getElementById('login-btn').onclick = window.handleLogin;
document.getElementById('logout-btn').onclick = () => window.handleLogout();
document.getElementById('checkout-btn').onclick = window.checkout;

document.getElementById('add-user-btn').onclick = () => {
    document.getElementById('edit-user-id').value = "";
    document.getElementById('modal-title').innerText = "Add New User";
    document.getElementById('user-modal').classList.remove('hidden');
    
    ['user-lrn','user-fname','user-mname','user-lname','user-pass','student-section','student-adviser','teacher-section'].forEach(id => { 
        if(document.getElementById(id)) document.getElementById(id).value = ""; 
    });
    
    document.getElementById('user-role').value = "student";
    window.toggleRoleFields(); 
};

// Search bars
document.getElementById('search-bar').onkeyup = () => window.renderMenu();
document.getElementById('account-search').onkeyup = () => window.renderAccounts();
document.getElementById('transaction-search').onkeyup = () => window.renderTransactions();

// Category Tabs
document.querySelectorAll('.tab').forEach(t => { 
    t.onclick = function() { 
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); 
        this.classList.add('active'); 
        currentCategory = this.getAttribute('data-cat'); 
        window.renderMenu(); 
    }; 
});

// Footer Navigation
document.getElementById('nav-menu').onclick = () => window.nav('menu', document.getElementById('nav-menu'));
document.getElementById('nav-cart').onclick = () => window.nav('cart', document.getElementById('nav-cart'));
document.getElementById('nav-orders').onclick = () => window.nav('orders', document.getElementById('nav-orders'));
document.getElementById('nav-fav').onclick = () => window.nav('favorite', document.getElementById('nav-fav'));
document.getElementById('nav-queue').onclick = () => window.nav('queue', document.getElementById('nav-queue'));
document.getElementById('nav-transactions').onclick = () => window.nav('transactions', document.getElementById('nav-transactions'));
document.getElementById('nav-reports').onclick = () => window.nav('reports', document.getElementById('nav-reports'));
document.getElementById('nav-accounts').onclick = () => window.nav('accounts', document.getElementById('nav-accounts'));
document.getElementById('nav-profile').onclick = () => window.nav('profile', document.getElementById('nav-profile'));

// Mass Deletion Buttons
document.getElementById('bulk-delete-transaction-btn').onclick = window.deleteBulkTransactionDate;
document.getElementById('delete-selected-transaction-btn').onclick = window.deleteSelectedTransactions;

// QR Code
document.getElementById('qr-btn').onclick = () => { 
    document.getElementById('real-qr-code').src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.href}`; 
    document.getElementById('qr-modal').classList.remove('hidden'); 
};